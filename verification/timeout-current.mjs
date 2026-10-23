// Shipped settings domain + pi-ai adapter/SDK; isolated profile editor and fetch.
// Never reads or writes the user's profile, credentials, or network.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { runInCurrentRuntime, importCurrent } from './current-runtime.mjs'

runInCurrentRuntime(fileURLToPath(import.meta.url))
const { Context } = await importCurrent('@deepseek-ai/cordis')
const { SettingsForms } = await importCurrent('@deepseek-ai/dsh-settings')
const pi = await importCurrent('@deepseek-ai/dsh-llm-pi-ai')
const { nativeHarness, collect, openAiFixture, responsesFixture, anthropicFixture } = await import('./harness.mjs')
const originalFetch = globalThis.fetch
const reports = []
try {
  for (const api of ['openai-completions', 'openai-responses', 'anthropic-messages']) {
    const profile = { baseURL: api === 'anthropic-messages' ? 'https://timeout-fixture.invalid' : 'https://timeout-fixture.invalid/v1', api, models: [{ id: 'fixture-model', contextWindow: 10000, maxTokens: 256 }] }
    const { adapter, config } = nativeHarness(profile)
    const initial = structuredClone(config.providers.get())
    initial.backup = { ...initial.primary, displayName: 'Backup', streamIdleTimeoutMs: 700000 }
    let raw = { providers: initial }
    const entry = { id: 'fixture-entry', options: { id: 'llm-pi-ai', config: raw }, fiber: { uid: 'fixture-fiber', state: 2, runtime: pi, config, ctx: new Context() } }
    // Exercise the actual settings merge, schema, revisions and projection.
    // Only persistence/live propagation are replaced with an in-memory editor.
    const forms = Object.assign(Object.create(SettingsForms.prototype), {
      revisions: new Map(), presentations: new Map(),
      ownerContext: { emit() {}, configEditor: {
        entries: () => [entry],
        configuration: () => [{ entry, inherited: {}, override: raw }],
        async edit(target, change) {
          assert.equal(target, entry)
          const next = change(raw, {})
          const validated = pi.Config(next)
          raw = next
          entry.options.config = next
          // This is the owning runtime's internal propagation seam, test only.
          config.providers[Symbol.for('cosmokit.volatile.write')](validated.providers.get())
        },
      } },
    })
    const describe = () => forms.describe({ redactSecrets: true })[0]
    const save = ms => forms.update('llm-pi-ai', { providers: { primary: { streamIdleTimeoutMs: ms } } }, describe().revision)
    assert.equal(describe().value.providers.primary.streamIdleTimeoutMs, 300000)
    assert.equal(describe().applies, 'live')

    const fixture = (api === 'openai-completions' ? openAiFixture(true) : api === 'openai-responses' ? responsesFixture(true) : anthropicFixture(true)).replace(/^data: null\r?\n\r?\n/, '')
    let delay = 0, requests = 0, heartbeats = 0, started
    globalThis.fetch = async (input, init) => {
      assert.equal(new URL(input).hostname, 'timeout-fixture.invalid')
      requests++
      let timer, heartbeat, aborted
      const cleanup = () => { clearTimeout(timer); clearInterval(heartbeat); init.signal.removeEventListener('abort', aborted) }
      const body = new ReadableStream({
        start(controller) {
          aborted = () => { cleanup(); controller.error(init.signal.reason) }
          init.signal.addEventListener('abort', aborted, { once: true })
          if (init.signal.aborted) { aborted(); return }
          heartbeat = setInterval(() => { heartbeats++; controller.enqueue(new TextEncoder().encode(': heartbeat\n\n')) }, 20)
          timer = setTimeout(() => { cleanup(); controller.enqueue(new TextEncoder().encode(fixture)); controller.close() }, delay)
          started?.()
        },
        cancel() { cleanup() },
      })
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
    }
    const options = { provider: 'primary', model: 'fixture-model', messages: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Fixture.' }] }], maxTokens: 256 }
    // Warm lazy SDK imports before testing short timer values.
    assert.equal((await collect(adapter, options)).assembler.finish.kind, 'stop')
    await save(120)
    const revision = describe().revision
    delay = 350
    const fetched = new Promise(resolve => { started = resolve })
    const ongoing = assert.rejects(collect(adapter, options), error => error.code === 'TIMEOUT' && /after 120ms/.test(error.message))
    await fetched
    await save(1500)
    await ongoing
    assert.ok(heartbeats > 0, 'network heartbeats do not keep parsed output alive')
    assert.equal(describe().revision, revision + 1)
    assert.equal(describe().value.providers.primary.streamIdleTimeoutMs, 1500)
    assert.equal((await collect(adapter, options)).assembler.finish.kind, 'stop', 'next call uses the new timeout without rebuilding the adapter')
    assert.equal(requests, 3, 'no additional request or retry layer')
    assert.deepEqual(raw.providers.backup, initial.backup)
    assert.deepEqual(raw.providers.primary, { ...initial.primary, streamIdleTimeoutMs: 1500 })
    await assert.rejects(forms.update('llm-pi-ai', { providers: { primary: { streamIdleTimeoutMs: 900 } } }, revision), error => error.code === 'SETTINGS_CONFLICT')
    assert.equal(describe().value.providers.primary.streamIdleTimeoutMs, 1500)
    const report = { api, result: 'PASS', requests, checks: ['native default 300000ms', 'native settings partial merge preserves models, credential reference and other provider', '120ms timeout despite SSE heartbeats', 'ongoing call retains 120ms after live update', 'next call succeeds with 1500ms', 'stale revision rejected'] }
    reports.push(report)
    console.log(JSON.stringify(report))
  }
} finally { globalThis.fetch = originalFetch }
mkdirSync(new URL('./results/', import.meta.url), { recursive: true })
writeFileSync(new URL('./results/timeout-current.json', import.meta.url), JSON.stringify({ electron: process.versions.electron, node: process.version, reports, limitation: 'Native settings methods and adapter/SDK; profile persistence/live propagation and network are isolated test doubles. No live desktop RPC or profile was modified.' }, null, 2) + '\n', 'utf8')
