import { importRuntime } from './runtime.js'
import { installCompatibleFetch } from './transport.js'
import { installRequestRecovery } from './recovery.js'
import { installProviderContext } from './provider-context.js'
import { providerRequestSettings } from './user-agent.js'
import { recoveryLog } from './recovery-log.js'
import { homedir } from 'node:os'
import { join } from 'node:path'

const { default: z } = await importRuntime('@deepseek-ai/schemastery')
const { createUserMessage } = await importRuntime('@deepseek-ai/dsh-llm')

export const name = 'llm-compat'
export const inject = ['agents', 'llm']
const headerMode = () => z.union([
  z.const('native').description('原生（默认）'),
  z.const('claude-code').description('Claude Code'),
  z.const('codex').description('Codex'),
  z.const('pi').description('pi'),
  z.const('custom').description('自定义'),
]).default('native')
const customUserAgent = () => z.string().pattern(/^[\x21-\x7e][\x20-\x7e]*$/).default('custom-client/1.0')
export const Config = z.object({
  enabled: z.boolean().default(true).description('启用模型请求控制与统一重试；覆盖所有模型请求报错，手动停止除外').volatile(),
  headerMode: headerMode().description('旧版默认 User-Agent；未单独配置的渠道沿用此值').volatile(),
  customUserAgent: customUserAgent().description('旧版默认自定义 User-Agent').volatile(),
  providerHeaders: z.dict(z.object({
    headerMode: headerMode().description('该渠道的 User-Agent 模式'),
    customUserAgent: customUserAgent().description('该渠道的自定义 User-Agent'),
  })).default({}).description('按模型渠道 ID 保存请求身份；仅替换 User-Agent').volatile(),
  recoveryMode: z.union([
    z.const('retry').description('连续重试'),
    z.const('continue').description('重试耗尽后发送继续消息'),
  ]).default('retry').description('恢复模式').volatile(),
  maxRetries: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(5).description('额外重试次数（例如 60 显示 1/60；0 表示不重试）').volatile(),
  retryDelaySeconds: z.number().min(0.1).max(86400).default(2).description('每次重试的固定等待时间（秒）').volatile(),
  retryForever: z.boolean().default(false).description('连续重试模式下不限次数，直到成功或手动停止；开启后忽略次数上限').volatile(),
  maxAutoContinues: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(3).description('继续消息模式：每条手动消息最多自动继续次数；0 表示不发送').volatile(),
  continueDelaySeconds: z.number().min(0).max(86400).default(2).description('继续消息模式：失败轮次结束后，发送消息前等待时间（秒）').volatile(),
  continueMessage: z.string().default('请继续完成。').description('继续消息模式：自动发送的用户消息内容').role('textarea').volatile(),
})

export function apply(ctx, config) {
  const settings = () => Object.fromEntries(Object.keys(Config.dict).map(key => [key, config[key].get()]))
  const log = message => ctx.logger.info(`llm-compat: ${message}`)
  const homePath = ctx.get('dshHomePath')
  const record = recoveryLog(typeof homePath === 'function' ? homePath() : homePath ?? join(homedir(), '.dsh'))
  const recovery = installRequestRecovery(ctx, {
    config: settings, createUserMessage, log,
    record,
  })
  const providers = installProviderContext(ctx)
  const adapter = installCompatibleFetch({
    config: () => providerRequestSettings(settings(), providers.current()),
  })
  ctx.on('dispose', () => { recovery.dispose(); adapter.dispose(); providers.dispose() })
  const { continueMessage: _message, customUserAgent: _userAgent, providerHeaders: _providerHeaders, ...summary } = settings()
  try { record({ time: new Date().toISOString(), event: 'plugin-loaded', version: '3.2.0', ...summary }) }
  catch (error) { log(`recovery log unavailable: ${error.code ?? error.name}`) }
  ctx.logger.info('llm-compat v3.2.0: unified native request retries with visible progress and configurable continuation')
}
