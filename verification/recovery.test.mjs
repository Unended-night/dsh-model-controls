import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { installRequestRecovery } from '../plugins/dsh-model-controls/lib/recovery.js'
import { createCompatibleFetch } from '../plugins/dsh-model-controls/lib/transport.js'
import { importCurrent } from './current-runtime.mjs'
const { createUserMessage } = await importCurrent('@deepseek-ai/dsh-llm')

const fixtureFailure = { code: 'SERVER', status: 503, message: '503 <!doctype html><html>fixture upstream failure</html>' }
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture(overrides = {}, sleep) {
  const listeners = new Map(), agents = new Map(), facts = [], delays = []
  const settings = { enabled: true, recoveryMode: 'retry', maxRetries: 5, retryDelaySeconds: 2, retryForever: false, maxAutoContinues: 3, continueDelaySeconds: 2, continueMessage: '继续完成我的任务。', ...overrides }
  const ctx = { agents: { get: id => agents.get(id) }, on(name, fn, options) {
    const rows = listeners.get(name) ?? []; options?.prepend ? rows.unshift(fn) : rows.push(fn); listeners.set(name, rows)
    return () => { const index = rows.indexOf(fn); if (index >= 0) rows.splice(index, 1) }
  } }
  const emit = (name, ...args) => { for (const fn of [...(listeners.get(name) ?? [])]) fn(...args) }
  const waterfall = (name, arg, last = () => undefined) => {
    const rows = [...(listeners.get(name) ?? [])]
    const run = i => i === rows.length ? last() : rows[i](arg, () => run(i + 1))
    return run(0)
  }
  const install = () => installRequestRecovery(ctx, { config: () => settings, createUserMessage, record: fact => facts.push(fact), sleep: async (ms, signal) => { delays.push(ms); if (sleep) await sleep(ms, signal) } })
  let recovery = install()
  const makeAgent = (depth = 0) => {
    let done = Promise.withResolvers()
    const controller = new AbortController()
    const session = { id: randomUUID(), header: { delegationDepth: depth }, log: [] }
    const agent = { id: session.id, session, status: 'running', inbox: { hasPending: false }, messages: [],
      whenIdle: () => done.promise,
      idle() { agent.status = 'idle'; done.resolve() },
      start() { agent.status = 'running'; done = Promise.withResolvers() },
      followup(message) { agent.messages.push(message); append('agent/inbox/spliced', { inserted: [message] }); append('user/message', message) },
    }
    const append = (type, data) => { const event = { type, data }; session.log.push(event); emit('session/event', session, event); return event }
    session.append = append
    agents.set(agent.id, agent)
    const fail = (failure = fixtureFailure, turn = 1, step = 1, last) => waterfall('agent/request-error', { agent, turn, step, provider: 'primary', signal: controller.signal, failure }, last)
    const exhaust = async (turn = 1, failure = fixtureFailure) => {
      append('step/start', { turn, step: 1 })
      for (let i = 0; i <= settings.maxRetries; i++) {
        const result = await fail(failure, turn)
        assert.equal(result?.kind, i < settings.maxRetries ? 'retry' : undefined)
      }
      append('turn/end', { turn, reason: { kind: 'error', error: failure } })
    }
    return { agent, controller, append, fail, exhaust }
  }
  return { get recovery() { return recovery }, reload() { recovery.dispose(); recovery = install() }, makeAgent, settings, facts, delays, emit, waterfall, agents }
}

for (const failure of [fixtureFailure, { code: 'AUTH', status: 401, message: 'Unauthorized' }, { code: 'INVALID_REQUEST', status: 400, message: 'Bad request' }, { code: 'TIMEOUT', message: 'Stream idle timeout' }, { code: 'QUOTA', status: 402, message: 'No quota' }, { code: 'RATE_LIMIT', status: 429, message: 'Limited' }, { code: 'SERVER', status: 503, message: 'Unavailable' }, { code: 'TRANSPORT', message: 'fetch failed' }, { code: 'UNKNOWN', message: 'SSE error after HTTP 200' }]) {
  test(`all model failures share the configured retry budget: ${failure.code}/${failure.status ?? 'stream'}`, async () => {
    const f = fixture(), a = f.makeAgent()
    try {
      let downstream = 0
      for (let i = 1; i <= 6; i++) {
        const result = await a.fail(failure, 1, 1, () => { downstream++; return { kind: 'retry' } })
        assert.equal(result?.kind, i <= 5 ? 'retry' : undefined)
      }
      assert.equal(downstream, 0)
      assert.deepEqual(f.delays, Array(5).fill(2000))
      assert.deepEqual(a.agent.session.log.filter(e => e.type === 'llm/retry').map(e => [e.data.retry, e.data.maxRetries]), [[1,5],[2,5],[3,5],[4,5],[5,5]])
    } finally { f.recovery.dispose() }
  })
}

test('60 retries expose the configured denominator and fixed fractional-second interval', async () => {
  const f = fixture({ maxRetries: 60, retryDelaySeconds: 1.25 }), a = f.makeAgent()
  try {
    await a.exhaust()
    const events = a.agent.session.log.filter(e => e.type === 'llm/retry')
    assert.equal(events.length, 60)
    assert.equal(events[4].data.retry, 5)
    assert.ok(events.every(e => e.data.maxRetries === 60 && e.data.delayMs === 1250))
    assert.equal(new Set(events.map(e => e.data.retryId)).size, 1)
    assert.equal(a.agent.messages.length, 0)
  } finally { f.recovery.dispose() }
})

test('unlimited retries exceed finite limit, emit infinity mode and stop on cancellation', async () => {
  const f = fixture({ maxRetries: 1, retryForever: true }), a = f.makeAgent()
  try {
    for (let i = 0; i < 8; i++) assert.equal((await a.fail()).kind, 'retry')
    const events = a.agent.session.log.filter(e => e.type === 'llm/retry')
    assert.ok(events.every(e => e.data.mode === 'always' && !('maxRetries' in e.data)))
    a.controller.abort()
    assert.equal(await a.fail(), undefined)
    assert.equal(f.delays.length, 8)
  } finally { f.recovery.dispose() }
})

test('zero retries still suppresses downstream policy', async () => {
  const f = fixture({ maxRetries: 0 }), a = f.makeAgent()
  try { await a.exhaust(); assert.deepEqual(f.delays, []); assert.equal(a.agent.messages.length, 0) }
  finally { f.recovery.dispose() }
})

test('continuation waits for idle and its own interval, with custom content and persisted source', async () => {
  const f = fixture({ recoveryMode: 'continue', maxRetries: 2, continueDelaySeconds: 9, continueMessage: '从断点继续\n保留已有结果' }), a = f.makeAgent()
  try {
    await a.exhaust()
    assert.equal(a.agent.messages.length, 0)
    a.agent.idle(); await tick()
    assert.equal(a.agent.messages.length, 1)
    assert.equal(a.agent.messages[0].role, 'user')
    assert.equal(a.agent.messages[0].source.kind, 'user')
    assert.match(a.agent.messages[0].content[0].text, /^从断点继续\n保留已有结果\n.*2.*1\/3/)
    assert.deepEqual(f.delays, [2000, 2000, 9000])
  } finally { f.recovery.dispose() }
})

test('continuation limit survives plugin reload; manual messages and completion reset it', async () => {
  const f = fixture({ recoveryMode: 'continue', maxRetries: 0 }), a = f.makeAgent()
  try {
    for (let turn = 1; turn <= 4; turn++) {
      a.agent.start(); await a.exhaust(turn); a.agent.idle(); await tick(); f.reload()
    }
    assert.equal(a.agent.messages.length, 3)
    assert.ok(f.facts.some(e => e.event === 'auto-continue-limit'))
    a.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '重新尝试' }] }))
    a.agent.start(); await a.exhaust(5); a.agent.idle(); await tick()
    assert.match(a.agent.messages.at(-1).content[0].text, /1\/3/)
    a.append('turn/end', { turn: 6, reason: { kind: 'completed' } })
    a.agent.start(); await a.exhaust(7); a.agent.idle(); await tick()
    assert.match(a.agent.messages.at(-1).content[0].text, /1\/3/)
  } finally { f.recovery.dispose() }
})

test('retry count survives plugin reload and resets at a new step', async () => {
  const f = fixture({ maxRetries: 1 }), a = f.makeAgent()
  try {
    await a.fail(); f.reload()
    assert.equal(await a.fail(), undefined)
    a.append('step/start', { turn: 1, step: 2 })
    assert.equal((await a.fail(fixtureFailure, 1, 2)).kind, 'retry')
  } finally { f.recovery.dispose() }
})

test('concurrent agents have independent budgets; subagents retry but never send user continuations', async () => {
  const f = fixture({ recoveryMode: 'continue', maxRetries: 1 }), a = f.makeAgent(), b = f.makeAgent(), child = f.makeAgent(1)
  try {
    await Promise.all([a.exhaust(), b.exhaust(), child.exhaust()])
    a.agent.idle(); b.agent.idle(); child.agent.idle(); await tick()
    assert.equal(a.agent.messages.length, 1); assert.equal(b.agent.messages.length, 1); assert.equal(child.agent.messages.length, 0)
    assert.equal(f.facts.filter(e => e.event === 'retry-scheduled').length, 3)
  } finally { f.recovery.dispose() }
})

for (const mode of ['cancel', 'disable', 'change-mode', 'dispose', 'agent-dispose', 'new-user', 'pending-inbox', 'new-event']) test(`pending continuation is suppressed after ${mode}`, async () => {
  const f = fixture({ recoveryMode: 'continue', maxRetries: 0 }), a = f.makeAgent()
  try {
    await a.exhaust()
    if (mode === 'cancel') a.controller.abort()
    if (mode === 'disable') f.settings.enabled = false
    if (mode === 'change-mode') f.settings.recoveryMode = 'retry'
    if (mode === 'dispose') f.recovery.dispose()
    if (mode === 'agent-dispose') f.emit('agent/disposed', { agent: a.agent })
    if (mode === 'new-user') a.append('agent/inbox/spliced', { inserted: [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'New instruction' }] })] })
    if (mode === 'pending-inbox') a.agent.inbox.hasPending = true
    if (mode === 'new-event') a.append('request/context', {})
    a.agent.idle(); await tick(); assert.equal(a.agent.messages.length, 0)
  } finally { f.recovery.dispose() }
})

for (const action of ['stop', 'unload']) test(`${action} aborts a running retry wait promptly`, async () => {
  let entered
  const ready = new Promise(resolve => { entered = resolve })
  const f = fixture({}, async (_ms, signal) => { entered(); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })) }), a = f.makeAgent()
  try {
    const waiting = a.fail(); await ready
    if (action === 'stop') a.controller.abort(); else f.recovery.dispose()
    assert.equal(await waiting, undefined)
    assert.equal(a.agent.session.log.filter(e => e.type === 'llm/retry-started').length, 0)
  } finally { f.recovery.dispose() }
})

test('disabled recovery delegates to the native policy', async () => {
  const f = fixture({ enabled: false }), a = f.makeAgent()
  try { assert.equal(await a.fail(fixtureFailure, 1, 1, () => 'native'), 'native') }
  finally { f.recovery.dispose() }
})

test('HTTP attempts match the visible retry budget without hidden transport retries', async () => {
  const f = fixture({ maxRetries: 2 }), a = f.makeAgent()
  let calls = 0
  const compat = createCompatibleFetch(async () => { calls++; return new Response('fixture failure', { status: 503 }) })
  try {
    for (let i = 0; i < 3; i++) {
      const response = await compat.fetch('https://models.example.invalid/v1/responses', { method: 'POST', body: '{}', headers: { 'user-agent': 'deepseek-harness/0.2.1' } })
      assert.equal(response.status, 503)
      assert.equal((await a.fail())?.kind, i < 2 ? 'retry' : undefined)
    }
    assert.equal(calls, 3)
    assert.deepEqual(f.delays, [2000, 2000])
  } finally { compat.deactivate(); f.recovery.dispose() }
})
