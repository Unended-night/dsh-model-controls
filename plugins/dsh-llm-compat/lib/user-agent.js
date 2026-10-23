import { platform, release, arch } from 'node:os'

// User-Agent sampled from the official Claude Code 2.1.296 CLI locally.
// Other sampled headers are intentionally not part of the preset.
const CLAUDE_USER_AGENT = 'claude-cli/2.1.296 (external, sdk-cli)'

// Codex CLI version from the installed official @openai/codex package.
// This preset identifies the client family; it is not a full Codex header capture.
// pi's format follows @earendil-works/pi-ai/dist/utils/pi-user-agent.js.
export const USER_AGENTS = Object.freeze({
  'claude-code': CLAUDE_USER_AGENT,
  codex: 'codex_cli_rs/0.162.1',
  pi: `pi (${platform()} ${release()}; ${arch()})`,
})

export function selectedUserAgent(settings) {
  if (settings.headerMode !== 'custom') return USER_AGENTS[settings.headerMode]
  const value = settings.customUserAgent
  if (typeof value !== 'string' || !/^[\x21-\x7e][\x20-\x7e]*$/.test(value)) {
    throw new Error('自定义 User-Agent 必须是非空的单行 ASCII HTTP 请求头值')
  }
  return value
}
