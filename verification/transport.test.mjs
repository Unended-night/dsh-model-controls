import test from 'node:test'
import assert from 'node:assert/strict'
import { createCompatibleFetch, filterNullSse, installCompatibleFetch } from '../plugins/dsh-model-controls/lib/transport.js'
import { USER_AGENTS } from '../plugins/dsh-model-controls/lib/user-agent.js'

const headers = { 'user-agent': 'deepseek-harness/0.2.1', 'x-api-key': 'fixture-key', 'anthropic-beta': 'native-feature', 'x-stainless-timeout': '45' }
const request = { method: 'POST', headers, body: '{}' }

test('all provider URLs, paths, query strings and native credentials are preserved', async () => {
  const seen = []
  const compat = createCompatibleFetch(async (input, init) => { seen.push({ input, init }); return new Response('{}') })
  for (const url of ['https://models.example.invalid/messages?version=test', 'http://localhost:1234/v1/v1/messages', 'https://proxy.example.invalid/custom/prefix/responses']) {
    await compat.fetch(url, request)
    assert.equal(seen.at(-1).input, url)
    assert.deepEqual([...new Headers(seen.at(-1).init.headers)], [...new Headers(headers)])
    assert.equal(seen.at(-1).init.body, '{}')
  }
  compat.deactivate()
})

test('every failure returns intact after one attempt, without changing User-Agent or consuming the error body', async () => {
  for (const status of [400, 401, 403, 408, 429, 500, 503]) {
    let calls = 0
    const failure = new Response('unsupported client: example failure', { status })
    const compat = createCompatibleFetch(async (_input, init) => { calls++; assert.deepEqual([...new Headers(init.headers)], [...new Headers(headers)]); return failure })
    assert.equal(await compat.fetch('https://models.example.invalid/v1/models', { headers }), failure)
    assert.equal(calls, 1)
    assert.equal(failure.bodyUsed, false)
    assert.equal(await failure.text(), 'unsupported client: example failure')
    compat.deactivate()
  }
})

test('Claude changes only User-Agent without adding or overwriting other fields', async () => {
  const compat = createCompatibleFetch(async (_input, init) => {
    assert.deepEqual([...new Headers(init.headers)], [...new Headers({ ...headers, 'user-agent': USER_AGENTS['claude-code'] })])
    return new Response('{}')
  }, { config: () => ({ headerMode: 'claude-code' }) })
  await compat.fetch('https://models.example.invalid/v1/messages', request)
  assert.equal(headers['user-agent'], 'deepseek-harness/0.2.1')
  compat.deactivate()
})

test('unrelated requests and disabled controls are passed through intact', async () => {
  let seen
  const original = async (input, init) => { seen = { input, init }; return new Response('{}') }
  const compat = createCompatibleFetch(original)
  for (const [url, init] of [
    ['https://models.example.invalid/v1/models', { headers: { 'user-agent': 'web-tool' } }],
    ['https://models.example.invalid/article', request],
    ['https://models.example.invalid/v1/models', { ...request, method: 'DELETE' }],
  ]) {
    await compat.fetch(url, init)
    assert.equal(seen.input, url); assert.equal(seen.init, init)
  }
  const disabled = createCompatibleFetch(original, { config: () => ({ enabled: false }) })
  await disabled.fetch('https://models.example.invalid/v1/messages', request)
  assert.equal(seen.init, request)
  compat.deactivate(); disabled.deactivate()
})

test('opaque Request bodies preserve bytes, URL and cancellation without replay', async () => {
  const abort = new AbortController()
  let calls = 0
  const compat = createCompatibleFetch(async (input, init) => {
    calls++
    const actual = new Request(input, init)
    assert.equal(actual.url, 'https://models.example.invalid/v1/v1/messages')
    assert.equal(await actual.text(), '{"text":"中文"}')
    abort.abort()
    assert.equal(actual.signal.aborted, true)
    return new Response('failure', { status: 503 })
  })
  const result = await compat.fetch(new Request('https://models.example.invalid/v1/v1/messages', { ...request, body: '{"text":"中文"}', signal: abort.signal }))
  assert.equal(calls, 1); assert.equal(await result.text(), 'failure')
  compat.deactivate()
})

test('pre-aborted requests never reach upstream and disposal aborts active requests', async () => {
  let calls = 0, signal
  const compat = createCompatibleFetch(async (_input, init) => { calls++; signal = init.signal; return new Response('{}') })
  await assert.rejects(compat.fetch('https://models.example.invalid/v1/messages', { ...request, signal: AbortSignal.abort() }), { name: 'AbortError' })
  assert.equal(calls, 0)
  await compat.fetch('https://models.example.invalid/v1/messages', request)
  compat.deactivate(); assert.equal(signal.aborted, true)
})

test('network and mid-stream errors are propagated without another attempt', async () => {
  for (const stream of [false, true]) {
    let calls = 0
    const compat = createCompatibleFetch(async () => {
      calls++
      if (!stream) throw new TypeError('fixture network error')
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"text":"partial"}\n\n')); setImmediate(() => controller.error(new Error('fixture stream error'))) } }), { headers: { 'content-type': 'text/event-stream' } })
    })
    await assert.rejects(async () => (await compat.fetch('https://models.example.invalid/v1/messages', request)).text(), /fixture .* error/)
    assert.equal(calls, 1); compat.deactivate()
  }
})

test('null SSE events normalize for every mode while preserving UTF-8, text, done and cancellation', async () => {
  const source = 'data: null\r\n\r\nevent: ping\r\ndata: {"text":"中文 null"}\r\n\r\ndata: [DONE]\r\n\r\n'
  for (const headerMode of ['native', 'claude-code', 'codex', 'pi', 'custom']) {
    const compat = createCompatibleFetch(async () => new Response(source, { headers: { 'content-type': 'text/event-stream' } }), { config: () => ({ headerMode, customUserAgent: 'Test/1.0' }) })
    assert.equal(await (await compat.fetch('https://models.example.invalid/v1/messages', request)).text(), source.replace('data: null', ': gateway heartbeat'))
    assert.equal(compat.stats.nullHeartbeats, 1); compat.deactivate()
  }
  let cancelled = false
  await filterNullSse(new Response(new ReadableStream({ cancel() { cancelled = true } }), { headers: { 'content-type': 'text/event-stream' } })).body.cancel()
  await new Promise(resolve => setImmediate(resolve)); assert.equal(cancelled, true)
})

test('disposal restores fetch without clobbering a later wrapper', () => {
  const original = globalThis.fetch
  try {
    const first = installCompatibleFetch(); first.dispose(); assert.equal(globalThis.fetch, original)
    const second = installCompatibleFetch()
    const later = async () => new Response('{}')
    globalThis.fetch = later; second.dispose(); assert.equal(globalThis.fetch, later)
  } finally { globalThis.fetch = original }
})
