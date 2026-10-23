import test from 'node:test'
import assert from 'node:assert/strict'
import { createCompatibleFetch } from '../plugins/dsh-llm-compat/lib/transport.js'
import { USER_AGENTS, selectedUserAgent } from '../plugins/dsh-llm-compat/lib/user-agent.js'

for (const headerMode of ['native', 'claude-code', 'codex', 'pi', 'custom']) test(`${headerMode}: explicit headers and auth survive HTTP failure retries`, async () => {
  const settings = { headerMode, customUserAgent: 'ExampleClient/3.0 (desktop)', maxRetries: 2 }
  const expected = { native: 'deepseek-harness/0.2.1', ...USER_AGENTS, custom: settings.customUserAgent }[headerMode]
  const original = { 'user-agent': 'deepseek-harness/0.2.1', authorization: 'Bearer fixture-key', 'x-api-key': 'fixture-anthropic-key', 'anthropic-beta': 'native-feature', 'anthropic-version': 'native-version', 'x-stainless-timeout': '45', 'x-stainless-retry-count': '7', 'x-stainless-runtime': 'native-runtime', 'x-app': 'native-app', 'x-claude-code-session-id': 'native-session', 'content-type': 'application/json', accept: 'text/event-stream' }
  const seen = []
  const compat = createCompatibleFetch(async (_input, init) => { seen.push(new Headers(init.headers)); return new Response('<!doctype html><html>fixture upstream failure</html>', { status: 503 }) }, { config: () => settings })
  try {
    for (let i = 0; i < 3; i++) {
      const response = await compat.fetch('https://models.example.invalid/v1/responses', { method: 'POST', body: '{}', headers: original })
      await response.text()
    }
    assert.equal(seen.length, 3)
    for (const headers of seen) {
      assert.equal(headers.get('user-agent'), expected)
      assert.equal(headers.get('authorization'), original.authorization)
      assert.equal(headers.get('x-api-key'), original['x-api-key'])
      assert.equal(headers.get('x-stainless-timeout'), '45')
      const expectedHeaders = new Headers({ ...original, 'user-agent': expected })
      assert.deepEqual([...headers], [...expectedHeaders])
    }
  } finally { compat.deactivate() }
})

test('custom UA rejects header injection, empty strings and unsupported Unicode', () => {
  for (const customUserAgent of ['', ' ', 'x\r\nAuthorization: secret', '你好']) {
    assert.throws(() => selectedUserAgent({ headerMode: 'custom', customUserAgent }), /User-Agent/)
  }
})

test('UA settings are read on every new request and never rewrite unrelated web requests', async () => {
  const settings = { headerMode: 'codex' }, seen = []
  const compat = createCompatibleFetch(async (_input, init) => { seen.push(new Headers(init.headers).get('user-agent')); return new Response('{}') }, { config: () => settings })
  try {
    const init = { headers: { 'user-agent': 'deepseek-harness/0.2.1' } }
    await compat.fetch('https://models.example.invalid/v1/models', init)
    settings.headerMode = 'native'
    await compat.fetch('https://models.example.invalid/v1/models', init)
    settings.headerMode = 'custom'; settings.customUserAgent = 'MyClient/9'
    await compat.fetch('https://models.example.invalid/v1/models', init)
    await compat.fetch('https://example.org/article', init)
    await compat.fetch('https://models.example.invalid/v1/models', { headers: { 'user-agent': 'web-tool' } })
    assert.deepEqual(seen, [USER_AGENTS.codex, 'deepseek-harness/0.2.1', 'MyClient/9', 'deepseek-harness/0.2.1', 'web-tool'])
  } finally { compat.deactivate() }
})
