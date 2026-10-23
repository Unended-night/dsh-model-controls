import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readFileSync, mkdtempSync, rmSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createCompatibleFetch } from '../plugins/dsh-llm-compat/lib/transport.js'
import { nativeHarness, collect, fixtureTools, fixtureResponse, openAiFixture, anthropicFixture, responsesFixture } from './harness.mjs'

// Representative parameterless and optional tools, with no local tool capture.
const desktopTools = JSON.parse(readFileSync(new URL('./fixtures/tools.json', import.meta.url), 'utf8'))
for (const api of ['openai-completions', 'anthropic-messages', 'openai-responses']) test(`${api}: parameterless and optional tools retain explicit empty required arrays on the wire`, async () => {
  const original = globalThis.fetch
  const before = JSON.stringify(desktopTools)
  const { adapter } = nativeHarness({ baseURL: api === 'anthropic-messages' ? 'https://models.example.invalid' : 'https://models.example.invalid/v1', api, models: [{ id: 'fixture-model', contextWindow: 131072, maxTokens: 2048 }] })
  let sent
  const compat = createCompatibleFetch(async (_input, init) => {
    sent = JSON.parse(init.body).tools
    const goal = sent.find(tool => (tool.function?.name ?? tool.name) === 'get_goal')
    const parameters = goal.function?.parameters ?? goal.input_schema ?? goal.parameters
    if (!Array.isArray(parameters.required)) return new Response(JSON.stringify({ error: { message: 'Invalid schema for function get_goal: null is not of type array' } }), { status: 400 })
    return fixtureResponse(api === 'openai-completions' ? openAiFixture(true) : api === 'openai-responses' ? responsesFixture(true) : anthropicFixture(true))
  })
  globalThis.fetch = compat.fetch
  try {
    const result = await collect(adapter, { provider: 'primary', model: 'fixture-model', messages: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Read the fixture files.' }] }], tools: desktopTools, maxTokens: 1024, signal: AbortSignal.timeout(5000) })
    assert.equal(result.assembler.finish.kind, 'stop', result.assembler.finish.failure?.message)
    assert.equal(sent.length, 5)
    for (const name of ['get_goal', 'job_list', 'list_agents', 'load_workspace_dependencies']) {
      const tool = sent.find(tool => (tool.function?.name ?? tool.name) === name)
      assert.deepEqual((tool.function?.parameters ?? tool.input_schema ?? tool.parameters).required, [], name)
    }
    const read = sent.find(tool => (tool.function?.name ?? tool.name) === 'read')
    assert.deepEqual((read.function?.parameters ?? read.input_schema ?? read.parameters).required, ['file_path'])
    assert.equal(JSON.stringify(desktopTools), before, 'the host tool definitions must not be mutated')
  } finally { globalThis.fetch = original }
})

for (const api of ['openai-completions', 'anthropic-messages', 'openai-responses']) test(`${api}: interleaved tools, real SDK, durable records and tool-result replay`, async () => {
  const original = globalThis.fetch
  const requests = []
  const { adapter } = nativeHarness({ baseURL: api === 'anthropic-messages' ? 'https://models.example.invalid' : 'https://models.example.invalid/v1', api, models: [{ id: 'fixture-model', contextWindow: 131072, maxTokens: 2048 }] })
  const compat = createCompatibleFetch(async (input, init) => {
    const payload = JSON.parse(init.body)
    requests.push({ path: new URL(input).pathname, payload })
    return fixtureResponse(api === 'openai-completions' ? openAiFixture(requests.length > 1) : api === 'openai-responses' ? responsesFixture(requests.length > 1) : anthropicFixture(requests.length > 1))
  })
  globalThis.fetch = compat.fetch
  try {
    const messages = [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Read and list the fixtures.' }] }]
    const options = { provider: 'primary', model: 'fixture-model', messages, tools: fixtureTools, maxTokens: 1024, signal: AbortSignal.timeout(5000) }
    const first = await collect(adapter, options)
    assert.equal(first.assembler.finish.kind, 'tool-calls')
    const calls = first.restored.blocks().filter(block => block.type === 'tool-call')
    assert.equal(calls.length, 2)
    assert.deepEqual(calls.map(call => ({ name: call.name, args: JSON.parse(call.arguments) })), [
      { name: 'read_fixture', args: { path: '中文.txt' } }, { name: 'glob_fixture', args: { pattern: '**/*.md' } },
    ])
    assert.notEqual(calls[0].id, calls[1].id)
    messages.push(first.restored.message({ provider: 'primary', model: 'fixture-model', replayState: first.restored.replayState }))
    for (const call of calls) messages.push({ role: 'tool', toolCallId: call.id, source: { kind: 'tool', callId: call.id }, content: [{ type: 'text', text: call.name === 'read_fixture' ? '中文_ALPHA' : 'BETA_OK' }], isError: false })
    const second = await collect(adapter, options)
    assert.equal(second.assembler.finish.kind, 'stop')
    assert.match(second.assembler.blocks().map(block => block.text ?? '').join(''), /中文_ALPHA; BETA_OK/)
    const sent = requests[1].payload.messages ?? requests[1].payload.input
    if (api === 'openai-completions') {
      const used = sent.find(message => message.tool_calls)?.tool_calls
      const results = sent.filter(message => message.role === 'tool')
      assert.deepEqual(used.map(call => call.id), results.map(message => message.tool_call_id))
      assert.deepEqual(used.map(call => JSON.parse(call.function.arguments)), [{ path: '中文.txt' }, { pattern: '**/*.md' }])
    } else if (api === 'openai-responses') {
      const used = sent.filter(item => item.type === 'function_call'), results = sent.filter(item => item.type === 'function_call_output')
      assert.deepEqual(used.map(item=>item.call_id),results.map(item=>item.call_id))
      assert.deepEqual(used.map(item=>JSON.parse(item.arguments)),[{path:'中文.txt'},{pattern:'**/*.md'}])
    } else {
      const blocks = sent.flatMap(message => Array.isArray(message.content) ? message.content : [])
      const used = blocks.filter(block => block.type === 'tool_use'), results = blocks.filter(block => block.type === 'tool_result')
      assert.deepEqual(used.map(block => block.id), results.map(block => block.tool_use_id))
      assert.deepEqual(used.map(block => block.input), [{ path: '中文.txt' }, { pattern: '**/*.md' }])
    }
    assert.equal(compat.stats.nullHeartbeats, 2)
    assert.equal(requests.length, 2)
    assert.ok(requests.every(request => request.path === (api === 'openai-completions' ? '/v1/chat/completions' : api === 'openai-responses' ? '/v1/responses' : '/v1/messages')))
  } finally { globalThis.fetch = original }
})

test('plugin exposes bounded recovery defaults and restores fetch on disposal', async () => {
  const { Config, apply } = await import('../plugins/dsh-llm-compat/lib/index.js')
  const config = Config({})
  assert.equal(config.enabled.get(), true)
  assert.equal(config.headerMode.get(), 'native')
  assert.equal(config.maxRetries.get(), 5)
  assert.equal(config.recoveryMode.get(), 'retry')
  assert.equal(config.retryForever.get(), false)
  assert.equal(config.retryDelaySeconds.get(), 2)
  assert.equal(config.continueDelaySeconds.get(), 2)
  assert.equal(config.continueMessage.get(), '请继续完成。')
  assert.equal(config.maxAutoContinues.get(), 3)
  const before = globalThis.fetch
  const verificationRoot = fileURLToPath(new URL('./', import.meta.url))
  const temporaryHome = mkdtempSync(join(verificationRoot, 'recovery-test-home-'))
  let dispose
  try {
    apply({ get(name) { if(name==='dshHomePath') return () => temporaryHome }, agents: { get() {} }, logger: { info() {} }, on(event, fn) { if (event === 'dispose') dispose = fn; return () => {} } }, config)
    assert.notEqual(globalThis.fetch, before)
    const loaded = JSON.parse(readFileSync(join(temporaryHome, 'logs', 'llm-compat', `${new Date().toISOString().slice(0,10)}.jsonl`), 'utf8').trim())
    assert.equal(loaded.event, 'plugin-loaded')
    assert.equal(loaded.version, '3.1.0')
    assert.equal(loaded.maxRetries, 5)
    assert.equal(loaded.continueMessage, undefined)
    assert.equal(typeof dispose, 'function')
    dispose()
    assert.equal(globalThis.fetch, before)
  } finally {
    globalThis.fetch = before
    assert.equal(dirname(realpathSync(temporaryHome)),realpathSync(verificationRoot))
    rmSync(temporaryHome,{recursive:true})
  }
})

for (const api of ['openai-completions', 'anthropic-messages', 'openai-responses']) test(`${api}: HTTP failures retain their native category without SDK retries`, async () => {
  const original = globalThis.fetch
  let attempts = 0
  const { adapter } = nativeHarness({ baseURL: api === 'anthropic-messages' ? 'https://models.example.invalid' : 'https://models.example.invalid/v1', api, models: [{ id: 'fixture-model', contextWindow: 131072, maxTokens: 2048 }] })
  const compat = createCompatibleFetch(async () => {
    attempts++
    return new Response('<!doctype html><html>fixture upstream failure</html>', { status: 503, headers: { 'content-type': 'text/html' } })
  })
  globalThis.fetch = compat.fetch
  try {
    const result = await collect(adapter, { provider: 'primary', model: 'fixture-model', messages: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Hello.' }] }], tools: [], maxTokens: 32, signal: AbortSignal.timeout(5000) })
    assert.equal(result.assembler.finish.kind, 'error')
    assert.equal(result.assembler.finish.failure.code, 'SERVER')
    assert.match(result.assembler.finish.failure.message, /503/)
    assert.equal(attempts, 1)
  } finally { globalThis.fetch = original }
})
