import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runInCurrentRuntime, importCurrent, currentRequire } from './current-runtime.mjs'
import { installRequestRecovery } from '../plugins/dsh-model-controls/lib/recovery.js'
import { createCompatibleFetch } from '../plugins/dsh-model-controls/lib/transport.js'
import { installProviderContext } from '../plugins/dsh-model-controls/lib/provider-context.js'
import { USER_AGENTS, providerRequestSettings } from '../plugins/dsh-model-controls/lib/user-agent.js'
import { fixtureResponse, openAiFixture, responsesFixture, anthropicFixture } from './harness.mjs'

runInCurrentRuntime(fileURLToPath(import.meta.url), process.argv.slice(2))
const api = process.argv[2] ?? 'openai-responses'
const { Context } = await importCurrent('@deepseek-ai/cordis')
const { SessionStore, Session } = await importCurrent('@deepseek-ai/dsh-session')
const { default: SessionProjections } = await importCurrent('@deepseek-ai/dsh-session-projection')
const { default: Llm, createUserMessage } = await importCurrent('@deepseek-ai/dsh-llm')
const pi = await importCurrent('@deepseek-ai/dsh-llm-pi-ai')
// Expose the shipped private driver only in this isolated test process. Every
// dependency resolves to the currently installed archive; that archive is read-only.
let source = fs.readFileSync(currentRequire.resolve('@deepseek-ai/dsh-agent-loop'), 'utf8')
source = source.replace(/from "([^"]+)"/g, (_, name) => `from ${JSON.stringify(name.startsWith('node:') ? name : pathToFileURL(currentRequire.resolve(name)).href)}`)
source += '\nexport { ReactLoopAgent, inboxProjectionDefinition };\n'
const { ReactLoopAgent, inboxProjectionDefinition, turnBoundaryProjectionDefinition } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

const ctx = new Context()
new SessionStore(ctx)
new SessionProjections(ctx)
new Llm(ctx)
ctx.sessionProjections.register(inboxProjectionDefinition)
ctx.sessionProjections.register(turnBoundaryProjectionDefinition)
const registry = new Map()
ctx.provide('agents')
ctx.provide('systemPrompt')
ctx.set('agents', { get: id => registry.get(id), withInitiator: (_agent, fn) => fn() })
ctx.set('systemPrompt', { refreshContext: assembly => assembly, assemble: async () => ({ sections: [], contexts: [], variables: {}, tools: [] }) })
const piConfig = pi.Config({ providers: { primary: { apiKeyEnv: 'TEST_FIXTURE_KEY', baseURL: api === 'anthropic-messages' ? 'https://models.example.invalid' : 'https://models.example.invalid/v1', api, models: [{ id: 'fixture-model', contextWindow: 10000, maxTokens: 256 }] } } })
// The adapter owns real serialization, SDK streaming and error classification.
let adapter
pi.apply({ fiber: { entry: { options: { id: 'llm-pi-ai' } } }, inject() {}, on() {}, logger: ctx.logger,
  get: name => name === 'credentials' ? { resolve: async () => ({ value: 'fixture-key' }) } : undefined,
  llm: { registerAdapter(_routes, value) { adapter = value; return Object.assign(() => {}, { replace() {} }) }, registerConfigurableProviders() { return Object.assign(() => {}, { replace() {} }) }, registerModelDiscovery() {} },
}, piConfig)
ctx.llm.registerAdapter(['primary'], adapter)
const nativeRetry = await importCurrent('@deepseek-ai/dsh-llm-retry')
nativeRetry.apply(ctx)
const scenarios = [
  { name: 'retry60', mode: 'retry', maximum: 60, failures: Array(60).fill(503), requests: 61, messages: 1, retries: 60 },
  { name: 'all-errors', mode: 'retry', maximum: 11, failures: [400,401,402,403,503,408,429,500,503,'network','stream'], requests: 12, messages: 1, retries: 11 },
  { name: 'limit', mode: 'retry', maximum: 3, persistent: true, requests: 4, messages: 1, retries: 3 },
  { name: 'continue', mode: 'continue', maximum: 2, failures: [503,503,503], requests: 4, messages: 2, retries: 2 },
  { name: 'continue-limit', mode: 'continue', maximum: 1, persistent: true, requests: 6, messages: 3, retries: 3 },
  { name: 'forever', mode: 'retry', maximum: 1, forever: true, failures: Array(7).fill(503), requests: 8, messages: 1, retries: 7 },
  ...['native', 'claude-code', 'codex', 'pi', 'custom'].map(headerMode => ({ name: 'headers-' + headerMode, headerMode, mode: 'retry', maximum: 2, failures: [503], requests: 2, messages: 1, retries: 1 })),
]
const reports = []
for (const scenario of scenarios) {
  const settings = { enabled: true, headerMode: 'native', providerHeaders: { primary: { headerMode: scenario.headerMode ?? 'native', customUserAgent: 'ExampleClient/3.0' } }, recoveryMode: scenario.mode, maxRetries: scenario.maximum, retryDelaySeconds: 1.25, retryForever: !!scenario.forever, maxAutoContinues: 2, continueDelaySeconds: 3.5, continueMessage: '继续完成测试任务，保留已完成结果。' }
  const records = [], requests = [], delays = []
  let nativeHeaders
  const recovery = installRequestRecovery(ctx, { config: () => settings, createUserMessage, record: fact => records.push(fact), sleep: async ms => { delays.push(ms) } })
  const providerContext = installProviderContext(ctx)
  const original = globalThis.fetch
  const compat = createCompatibleFetch(async (input, init) => {
    const headers = new Headers(init.headers)
    const selected = settings.providerHeaders.primary
    const expected = selected.headerMode === 'custom' ? selected.customUserAgent : USER_AGENTS[selected.headerMode]
    if (selected.headerMode === 'native') assert.match(headers.get('user-agent'), /deepseek-harness/i)
    else assert.equal(headers.get('user-agent'), expected)
    const expectedHeaders = new Headers(nativeHeaders)
    if (selected.headerMode !== 'native') expectedHeaders.set('user-agent', expected)
    assert.deepEqual([...headers], [...expectedHeaders], 'preserve every SDK header except the selected User-Agent')
    assert.equal(headers.has('x-claude-code-session-id'), false)
    assert.equal(headers.has('x-app'), false)
    requests.push({ url: String(input), userAgent: headers.get('user-agent'), session: headers.get('x-claude-code-session-id'), retry: headers.get('x-stainless-retry-count'), body: JSON.parse(init.body) })
    assert.ok(requests.length <= scenario.requests, 'hidden or stacked retries')
    const failure = scenario.persistent ? 503 : scenario.failures[requests.length - 1]
    if (failure === 'network') throw new TypeError('fixture network failure')
    if (failure === 'stream') {
      // A successful HTTP response whose body fails while the native SDK reads it.
      return new Response(new ReadableStream({ start(controller) { controller.error(new Error('fixture SSE connection lost')) } }), { headers: { 'content-type': 'text/event-stream' } })
    }
    if (failure === 503) return new Response('<!doctype html><html>fixture upstream failure</html>', { status: 503 })
    if (failure) return Response.json({ error: { message: 'fixture HTTP failure', type: 'fixture_error' } }, { status: failure })
    return fixtureResponse(api === 'openai-responses' ? responsesFixture(true) : api === 'anthropic-messages' ? anthropicFixture(true) : openAiFixture(true))
  }, { config: () => providerRequestSettings(settings, providerContext.current()) })
  globalThis.fetch = (input, init) => { nativeHeaders = new Headers(init.headers); return compat.fetch(input, init) }
  const session = ctx.sessions.create('recovery-current-' + scenario.name, { meta: { cwd: process.cwd() } })
  const agent = new ReactLoopAgent(ctx, session.id, { provider: 'primary', model: 'fixture-model', maxTokens: 256 }, session)
  registry.set(agent.id, agent)
  try {
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Complete fixture task.' }], source: { kind: 'user' } }))
    // Allow the post-idle continuation to enqueue each new native turn.
    for (let i = 0; i < 5; i++) { await agent.whenIdle(); await new Promise(resolve => setImmediate(resolve)) }
    const messages = session.log.filter(event => event.type === 'user/message')
    const retries = session.log.filter(event => event.type === 'llm/retry')
    const started = session.log.filter(event => event.type === 'llm/retry-started')
    assert.equal(messages.length, scenario.messages, scenario.name)
    assert.equal(requests.length, scenario.requests, scenario.name)
    assert.equal(retries.length, scenario.retries, scenario.name)
    assert.equal(started.length, scenario.retries, scenario.name)
    assert.ok(retries.every(e => e.data.policyKey === 'model-controls:unified-v3' && e.data.delayMs === 1250))
    assert.ok(retries.every(e => scenario.forever ? e.data.mode === 'always' : e.data.mode === 'normal' && e.data.maxRetries === scenario.maximum))
    assert.equal(delays.filter(d => d === 1250).length, scenario.retries)
    assert.equal(delays.filter(d => d === 3500).length, scenario.messages - 1)
    assert.equal(compat.stats.requests, scenario.requests)
    if (scenario.name === 'retry60') assert.deepEqual([retries[4].data.retry, retries[4].data.maxRetries], [5,60])
    for (const event of messages.slice(1)) {
      assert.equal(event.data.role, 'user'); assert.equal(event.data.source.kind, 'user')
      assert.ok(event.data.content[0].text.startsWith(settings.continueMessage))
    }
    const last = session.log.filter(e => e.type === 'turn/end').at(-1).data.reason.kind
    assert.equal(last, scenario.persistent ? 'error' : 'completed', scenario.name)
    const restored = Session.create(session.id, JSON.parse(JSON.stringify(session.log)), session.header)
    assert.equal(restored.deriveMessages().filter(m => m.role === 'user').length, scenario.messages)
    const report = { name: scenario.name, result: 'PASS', requests: requests.length, retries: retries.map(e => e.data), messages: messages.map(e => e.data), records, terminal: last }
    reports.push(report)
    console.log(JSON.stringify({ result: 'PASS', api, scenario: scenario.name, requests: requests.length, retries: retries.length, userMessages: messages.length }))
  } finally { recovery.dispose(); compat.deactivate(); providerContext.dispose(); globalThis.fetch = original; registry.delete(agent.id); await agent.scope.dispose() }
}
fs.mkdirSync(new URL('./results/', import.meta.url), { recursive: true })
fs.writeFileSync(new URL(`./results/recovery-v3-${api}.json`, import.meta.url), JSON.stringify({ runtime: process.versions.electron, node: process.version, api, scenarios: reports }, null, 2) + '\n', 'utf8')
