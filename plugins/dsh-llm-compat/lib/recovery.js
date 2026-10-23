import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

const AUTO_RPC_PREFIX = 'llm-compat:auto-continue:'
const POLICY_KEY = 'llm-compat:unified-v3'
const isAuto = message => message?.source?.kind === 'user' && message.source.rpcId?.startsWith(AUTO_RPC_PREFIX)

/** One native request-recovery policy, including failures after HTTP 200. */
export function installRequestRecovery(ctx, { config, createUserMessage, record = () => {}, log = () => {}, sleep = (ms, signal) => delay(ms, undefined, { signal }) }) {
  const chains = new WeakMap()
  const pending = new Map()
  const lifetime = new AbortController()
  const disposers = []
  const enabled = () => !lifetime.signal.aborted && config().enabled !== false
  const live = agent => ctx.agents.get(agent.id) === agent
  const note = data => { try { record({ time: new Date().toISOString(), ...data }) } catch (error) { log(`recovery log unavailable: ${error.code ?? error.name}`) } }
  const remove = agent => { pending.get(agent)?.controller.abort(); pending.delete(agent) }
  const chainFor = (agent, turn, step, provider) => {
    let chain = chains.get(agent)
    if (!chain || chain.turn !== turn || chain.step !== step || chain.provider !== provider) {
      const previous = agent.session.log.findLast(event => event.type === 'llm/retry' && event.data.policyKey === POLICY_KEY && event.data.turn === turn && event.data.step === step && event.data.provider === provider)
      chain = { agent, turn, step, provider, retry: previous?.data.retry ?? 0, retryId: previous?.data.retryId ?? randomUUID() }
      chains.set(agent, chain)
    }
    return chain
  }

  const wait = async (ms, signal) => {
    if (signal.aborted) return false
    try { await sleep(ms, signal); return !signal.aborted }
    catch (error) { if (signal.aborted) return false; throw error }
  }

  disposers.push(ctx.on('agent/request-error', async (payload, next) => {
    const { agent, turn, step, provider, failure, signal } = payload
    if (!enabled()) return next()
    if (!live(agent) || signal.aborted) return
    const settings = config()
    const chain = chainFor(agent, turn, step, provider)
    const forever = settings.recoveryMode === 'retry' && settings.retryForever
    if (forever || chain.retry < settings.maxRetries) {
      const retry = ++chain.retry
      const delayMs = settings.retryDelaySeconds * 1000
      const fusedSignal = AbortSignal.any([signal, lifetime.signal])
      agent.session.append('llm/retry', {
        retryId: chain.retryId, turn, step, provider, policyKey: POLICY_KEY,
        mode: forever ? 'always' : 'normal', retry,
        ...(!forever && { maxRetries: settings.maxRetries }), delayMs, failure,
      })
      note({ event: 'retry-scheduled', sessionId: agent.id, turn, step, retry, maxRetries: forever ? null : settings.maxRetries, delayMs, code: failure.code, status: failure.status })
      if (!await wait(delayMs, fusedSignal) || !enabled() || !live(agent)) return
      agent.session.append('llm/retry-started', { retryId: chain.retryId, turn, step, retry })
      return { kind: 'retry' }
    }
    note({ event: 'retry-exhausted', sessionId: agent.id, turn, step, retries: chain.retry, code: failure.code, status: failure.status })
    if (settings.recoveryMode === 'continue' && (agent.session.header.delegationDepth ?? 0) === 0) {
      remove(agent)
      pending.set(agent, { turn, step, retries: chain.retry, signal, controller: new AbortController(), settings: { ...settings } })
    }
    // Do not fall through into the provider's separate retry budget.
    return undefined
  }, { prepend: true }))

  const continuationCount = agent => {
    let count = 0
    for (let i = agent.session.log.length - 1; i >= 0; i--) {
      const event = agent.session.log[i]
      if (event.type === 'turn/end' && event.data.reason.kind === 'completed') break
      if (event.type !== 'user/message' || event.data.source.kind !== 'user') continue
      if (!isAuto(event.data)) break
      count++
    }
    return count
  }

  const continueAfterIdle = async (agent, state, terminalEvent) => {
    await agent.whenIdle()
    const clear = () => { if (pending.get(agent) === state) remove(agent) }
    const valid = () => pending.get(agent) === state && enabled() && config().recoveryMode === 'continue' && live(agent) && !state.signal.aborted && !state.controller.signal.aborted && agent.status === 'idle' && !agent.inbox.hasPending && agent.session.log.at(-1) === terminalEvent
    if (!valid()) { clear(); return }
    const count = continuationCount(agent)
    const maximum = state.settings.maxAutoContinues
    if (count >= maximum) {
      clear()
      note({ event: 'auto-continue-limit', sessionId: agent.id, turn: state.turn, maximum })
      return
    }
    const fusedSignal = AbortSignal.any([state.signal, state.controller.signal, lifetime.signal])
    if (!await wait(state.settings.continueDelaySeconds * 1000, fusedSignal) || !valid()) { clear(); return }
    const number = count + 1
    const message = createUserMessage({
      source: { kind: 'user', rpcId: AUTO_RPC_PREFIX + randomUUID(), clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      content: [{ type: 'text', text: `${state.settings.continueMessage}\n（模型请求控制插件自动发送：请求重试 ${state.retries} 次仍失败，自动继续 ${number}/${maximum}。）` }],
    })
    remove(agent)
    agent.followup(message)
    note({ event: 'auto-continue-sent', sessionId: agent.id, failedTurn: state.turn, messageId: message.id, number, maximum })
  }

  disposers.push(ctx.on('session/event', (session, event) => {
    const agent = ctx.agents.get(session.id)
    if (!agent || agent.session !== session) return
    if (event.type === 'agent/inbox/spliced' && event.data.inserted?.some(message => message.source.kind === 'user' && !isAuto(message)) ||
        event.type === 'user/message' && event.data.source.kind === 'user' && !isAuto(event.data)) remove(agent)
    if (event.type === 'step/start' || event.type === 'turn/end') chains.delete(agent)
    if (event.type !== 'turn/end') return
    const state = pending.get(agent)
    if (!state) return
    if (state.turn !== event.data.turn || event.data.reason.kind !== 'error') { remove(agent); return }
    void continueAfterIdle(agent, state, event).catch(error => {
      if (pending.get(agent) === state) remove(agent)
      note({ event: 'auto-continue-error', sessionId: agent.id, code: error.code ?? error.name })
    })
  }))
  disposers.push(ctx.on('agent/disposed', ({ agent }) => { remove(agent); chains.delete(agent) }))

  return {
    dispose() {
      lifetime.abort()
      for (const agent of pending.keys()) remove(agent)
      for (const dispose of disposers) dispose()
    },
  }
}
