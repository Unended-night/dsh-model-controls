import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { importCurrent, runInCurrentRuntime } from './current-runtime.mjs'
import { installProviderContext } from '../plugins/dsh-model-controls/lib/provider-context.js'
import { installCompatibleFetch } from '../plugins/dsh-model-controls/lib/transport.js'
import { providerRequestSettings, USER_AGENTS } from '../plugins/dsh-model-controls/lib/user-agent.js'
import { collect, fixtureResponse, openAiFixture, responsesFixture, anthropicFixture } from './harness.mjs'

if (process.argv.includes('--host')) runInCurrentRuntime(fileURLToPath(import.meta.url), ['--host'])
const { Context } = await importCurrent('@deepseek-ai/cordis')
const { default: Llm } = await importCurrent('@deepseek-ai/dsh-llm')
const pi = await importCurrent('@deepseek-ai/dsh-llm-pi-ai')

test('provider settings isolate channel identities and default unconfigured routes to native', () => {
  const settings = { headerMode: 'codex', providerHeaders: { primary: { headerMode: 'native' }, backup: { headerMode: 'custom', customUserAgent: 'Backup/1' } } }
  assert.equal(providerRequestSettings(settings, 'primary').headerMode, 'native')
  assert.equal(providerRequestSettings(settings, 'backup').customUserAgent, 'Backup/1')
  assert.equal(providerRequestSettings(settings, 'unconfigured').headerMode, 'native')
  assert.equal(providerRequestSettings(settings, undefined).headerMode, 'native')
  assert.equal(providerRequestSettings(settings, '').headerMode, 'native')
})

for (const api of ['openai-completions', 'openai-responses', 'anthropic-messages']) test(`${api}: same-address concurrent channels retain identities through the real SDK and discovery`, async () => {
  const ctx = new Context()
  const llm = new Llm(ctx)
  const previousDiscovery = llm.discoverModels
  const scope = installProviderContext(ctx)
  const profile = { apiKeyEnv: 'FIXTURE_KEY', baseURL: api === 'anthropic-messages' ? 'https://models.example.invalid' : 'https://models.example.invalid/v1', api, models: [{ id: 'fixture-model', contextWindow: 10000, maxTokens: 256 }] }
  const config = pi.Config({ providers: { primary: profile, backup: { ...profile } } })
  pi.apply({ fiber: { entry: { options: { id: 'llm-pi-ai' } } }, inject() {}, on() {}, logger: ctx.logger,
    get: name => name === 'credentials' ? { resolve: async () => ({ value: 'fixture-key' }) } : undefined,
    llm: ctx.llm,
  }, config)
  const settings = { enabled: true, headerMode: 'native', providerHeaders: { primary: { headerMode: 'codex' }, backup: { headerMode: 'custom', customUserAgent: 'Backup/1' } } }
  const seen = []
  const original = globalThis.fetch
  const fixture = api === 'openai-completions' ? openAiFixture(true) : api === 'openai-responses' ? responsesFixture(true) : anthropicFixture(true)
  globalThis.fetch = async (input, init) => {
    const provider = scope.current()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(scope.current(), provider)
    seen.push({ provider, ua: new Headers(init.headers).get('user-agent'), path: new URL(input).pathname })
    assert.equal(new Headers(init.headers).get(api === 'anthropic-messages' ? 'x-api-key' : 'authorization'), api === 'anthropic-messages' ? 'fixture-key' : 'Bearer fixture-key')
    return new URL(input).pathname.endsWith('/models') ? Response.json({ data: [{ id: 'fixture-model' }] }) : fixtureResponse(fixture)
  }
  const transport = installCompatibleFetch({ config: () => providerRequestSettings(settings, scope.current()) })
  const options = provider => ({ provider, model: 'fixture-model', messages: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Fixture.' }] }], maxTokens: 256 })
  try {
    for (const result of await Promise.all(['primary', 'backup'].map(provider => collect(ctx.llm, options(provider))))) assert.equal(result.assembler.finish.kind, 'stop')
    assert.deepEqual(new Map(seen.map(row => [row.provider, row.ua])), new Map([['primary', USER_AGENTS.codex], ['backup', 'Backup/1']]))
    assert.equal(scope.current(), undefined, 'consumer is outside the route context')
    settings.providerHeaders.primary = { headerMode: 'native' }
    await collect(ctx.llm, options('primary'))
    assert.match(seen.at(-1).ua, /deepseek-harness/)
    await Promise.all(['primary', 'backup'].map(provider => ctx.llm.discoverModels('llm-pi-ai', { provider, baseURL: profile.baseURL, api })))
    const discovery = seen.filter(row => row.path.endsWith('/models'))
    assert.equal(discovery.length, 2)
    assert.match(discovery.find(row => row.provider === 'primary').ua, /deepseek-harness/)
    assert.equal(discovery.find(row => row.provider === 'backup').ua, 'Backup/1')
  } finally {
    transport.dispose(); globalThis.fetch = original; scope.dispose()
  }
  assert.equal(llm.discoverModels, previousDiscovery)
  assert.equal(Object.hasOwn(llm, 'discoverModels'), false)
})

test('lazy iteration and early cleanup run in the route while the consumer remains outside it', async () => {
  const ctx = new Context()
  new Llm(ctx)
  const scope = installProviderContext(ctx)
  let cleaned
  try {
    const stream = ctx.waterfall(ctx.llm, 'llm/stream', { provider: 'primary' }, () => (async function* () {
      try {
        assert.equal(scope.current(), 'primary')
        yield 1
        assert.fail('closed stream must not advance')
      } finally { cleaned = scope.current() }
    })())
    for await (const item of stream) { assert.equal(item, 1); assert.equal(scope.current(), undefined); break }
    assert.equal(cleaned, 'primary')
    assert.equal(scope.current(), undefined)
  } finally { scope.dispose() }
})

if (process.versions.electron) test('native settings merge one channel identity without replacing other channels or global recovery', async () => {
  const { SettingsForms } = await importCurrent('@deepseek-ai/dsh-settings')
  const plugin = await import('../plugins/dsh-model-controls/lib/index.js')
  let raw = { maxRetries: 60, providerHeaders: { backup: { headerMode: 'custom', customUserAgent: 'Backup/1' } } }
  const config = plugin.Config(raw)
  const entry = { id: 'fixture-entry', options: { id: 'model-controls', config: raw }, fiber: { uid: 'fixture-fiber', state: 2, runtime: plugin, config, ctx: new Context() } }
  const forms = Object.assign(Object.create(SettingsForms.prototype), {
    revisions: new Map(), presentations: new Map(),
    ownerContext: { emit() {}, configEditor: {
      entries: () => [entry], configuration: () => [{ entry, inherited: {}, override: raw }],
      async edit(target, change) {
        assert.equal(target, entry)
        const next = change(raw, {})
        const validated = plugin.Config(next)
        raw = next; entry.options.config = next
        config.providerHeaders[Symbol.for('cosmokit.volatile.write')](validated.providerHeaders.get())
      },
    } },
  })
  const initial = forms.describe({ redactSecrets: true })[0]
  assert.equal(initial.applies, 'live')
  await forms.update('model-controls', { providerHeaders: { primary: { headerMode: 'claude-code', customUserAgent: 'Primary/1' } } }, initial.revision)
  assert.deepEqual(raw.providerHeaders.backup, { headerMode: 'custom', customUserAgent: 'Backup/1' })
  assert.equal(raw.maxRetries, 60)
  assert.equal(raw.headerMode, undefined)
  assert.equal(config.providerHeaders.get().primary.headerMode, 'claude-code')
  assert.equal(forms.describe({ redactSecrets: true })[0].value.providerHeaders.primary.customUserAgent, 'Primary/1')
  await assert.rejects(forms.update('model-controls', { providerHeaders: { primary: { headerMode: 'native' } } }, initial.revision), error => error.code === 'SETTINGS_CONFLICT')
  assert.equal(config.providerHeaders.get().primary.headerMode, 'claude-code')
})
