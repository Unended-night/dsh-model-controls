# 模型请求控制 · Model Request Controls

DeepSeek Harness 的“模型请求控制”插件，当前版本 **3.1.0**。测试目标为 Harness 0.2.1-rc.2 / Node 22.19+。当前是未发布的审核候选；内部包名和配置 ID 保留，继续使用现有本机安装。

在 **设置 → 模型请求控制** 中选择 User-Agent、重试方式、次数和等待间隔。配置通过 Harness 原生 settings 接口保存到当前 profile；后续请求读取新配置，重启后继续应用。首次安装或修改插件源码后需要重启加载。

**保存配置无需重启。** 请求头在下一次请求时读取；重试次数、无限开关及间隔在下一次失败判定时读取，已开始的等待不重新计时。已经排队的自动继续沿用排队时的内容、间隔和次数上限；关闭总开关或切走继续模式会在发送前阻止该任务。保存不会自动重新启动已结束的失败任务。左侧循环双箭头图标表示请求恢复。

## 流空闲超时

在设置页下方的“流空闲超时”区域选择模型渠道，以秒填写等待上限，点击 **保存超时**。页面读取该渠道当前的原生值，未覆盖时默认为 **300 秒（5 分钟）**；例如填写 `600` 表示 10 分钟。可输入范围为 0.001～2147483.647 秒，不使用 0 表示关闭。

此项控制连续没有解析到文字、思考、工具调用等有效输出的时间，每次收到输出后重新计时；它不是整次请求的总时长。只有网络心跳也可能触发 `pi-ai stream idle timeout after 300000ms`。延长等待可以容许更长的输出间隔，但不会修复上游断流。

该区域通过原生 settings 接口单独保存 `llm-pi-ai.providers.<渠道 ID>.streamIdleTimeoutMs`，只提交所选渠道的超时字段，保留其他渠道、模型和凭据配置。它不受上方请求控制总开关影响，也不新增计时器或重试层。**后续新模型调用使用新值，无需重启；正在进行的调用保持原值。** 恢复原生默认值时填写 `300` 并保存。

## 两种恢复模式

- **连续重试（默认）**：同一次模型调用失败后，默认额外重试 5 次，每次等待 2 秒。可以修改次数、间隔，或开启无限重试直到成功或手动停止。
- **重试耗尽后发送继续消息**：先按配置重试；仍失败时，让原轮次结束，等待 Agent 空闲及指定间隔，再发送一条界面可见的用户消息。内容、间隔、最多自动继续次数均可配置。

原生 Agent 模型请求统一处理 HTTP 错误、连接错误和流式响应错误。手动停止不触发重试。重试使用原生 `llm/retry` 事件，消息页按配置显示进度，例如 `5/60`，无限模式显示 `5/∞`；首次请求不计入重试次数。重试预算按 Agent、轮次、步骤及提供商隔离，不与传输层重试叠加。

自动继续仅用于主会话，消息会标明插件来源和次数：

```text
请继续完成。
（模型请求控制插件自动发送：请求重试 5 次仍失败，自动继续 1/3。）
```

计数从会话记录恢复；手动新消息或成功完成后重新计数。取消、禁用、卸载、已有待处理消息或会话出现新动作时，会撤销待发送的消息。插件保留原始失败记录。重试不能保证修复持续的上游拒绝、无效密钥或额度问题。

**模型发现等没有原生 Agent 恢复流程的操作**：插件只执行一次 HTTP 调用并原样返回错误，不发送自动继续消息。宿主或 SDK 自身行为由其配置决定。所有插件重试决策集中于原生 Agent 失败事件，不按服务商或特殊状态码区分。

## User-Agent 选择

| 模式 | 行为 |
| --- | --- |
| 原生（默认） | 保留 Harness / SDK 的请求头 |
| Claude Code | 仅将 User-Agent 设为 `claude-cli/2.1.296 (external, sdk-cli)`，其余请求头保留 |
| Codex | 仅将 User-Agent 设为 `codex_cli_rs/0.162.1`，其余请求头保留 |
| pi | 仅将 User-Agent 设为 `pi (<平台> <系统版本>; <架构>)`，其余请求头保留 |
| 自定义 | 使用填写的非空、单行 ASCII User-Agent |

这些预设统一只设置 User-Agent，不附加 Claude 专属会话、Anthropic beta、Stainless 或 x-app 字段，也不根据 x-api-key 拼接额外的 Authorization。若原请求已包含这些字段，保留其原值。不自动识别服务商、轮换身份或从错误正文猜测客户端；请在 Harness 中填写正确地址和认证配置。

User-Agent 模式下方的说明随当前选项即时更新；自定义模式额外显示输入框。恢复模式也分别说明“连续重试”与“重试耗尽后发送继续消息”的行为。切换仅编辑草稿，点击保存后应用。

选择 User-Agent 不会切换模型协议或替换认证信息。模型、凭据、Messages / Chat Completions / Responses 协议、工具调用和历史重放继续由原生 `llm-pi-ai` 处理。

### 模型地址与认证

在 Harness 的模型设置中按所选协议填写基础地址。以下是当前测试版本的标准路径示例，域名仅为占位符：

| 协议 | 基础地址示例 | SDK 发起请求的路径 |
| --- | --- | --- |
| Anthropic Messages | `https://models.example.invalid` | `/v1/messages` |
| OpenAI Chat Completions | `https://models.example.invalid/v1` | `/v1/chat/completions` |
| OpenAI Responses | `https://models.example.invalid/v1` | `/v1/responses` |

实际服务可能使用其他前缀，应以服务接口说明为准。当前 Anthropic SDK 会追加 `/v1/messages`；若基础地址已带 `/v1`，请求可能成为 `/v1/v1/messages`。插件不再修正地址或补充认证头，请同时检查协议、基础地址和 Harness 中的凭据配置。反复重试不会修正这些配置错误。

## 通用请求规范化

只处理带 Harness User-Agent、使用 GET/POST、路径以 models、messages、chat/completions 或 responses 结尾的模型 API 请求，网页工具和其他请求不在范围内。规则对所有渠道和五种身份模式一致执行，不检查域名，不改写 URL。

- 工具对象 schema 缺省 required 时补空数组，语义仍是无必填字段；已有约束及普通用户数据保留。只处理序列化 JSON，不缓冲不透明上传流。正文改变时移除失效的 Content-Length，由 HTTP 实现计算长度。
- 成功 SSE 中独立的 data: null 转成注释，其他文本和事件保留，取消信号继续传递。注释不作为有效输出延长原生超时；单事件缓冲有大小上限。
- HTTP 错误原样返回，不读取正文识别服务商，不进行传输层重试。

原生模式仅表示保留原生身份，总开关开启时仍有统一恢复与通用规范化。关闭总开关时请求交给宿主，宿主自己的重试仍可能生效。

Claude Code 预设为 claude-cli/2.1.296 (external, sdk-cli)，Codex 为 codex_cli_rs/0.162.1，pi 格式包含当前平台、系统版本和架构。固定版本来自开发时核对，不宣称始终最新。这些预设不代表运行了相应客户端，不增加账户权限。

## 配置字段

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| enabled | true | 启用请求控制与统一恢复策略 |
| headerMode | native | User-Agent 模式 |
| customUserAgent | custom-client/1.0 | 自定义模式的 UA |
| recoveryMode | retry | retry 或 continue |
| maxRetries | 5 | 额外重试次数；0 表示不重试 |
| retryDelaySeconds | 2 | 固定重试间隔，0.1～86400 秒 |
| retryForever | false | 连续重试模式下忽略次数上限 |
| maxAutoContinues | 3 | 每条手动消息最多自动继续次数；0 表示不发送 |
| continueDelaySeconds | 2 | 发送继续消息前等待，0～86400 秒 |
| continueMessage | 请继续完成。 | 自动消息的自定义正文 |

次数接受非负安全整数。保存仅提交编辑字段，并带上读取到的 revision；发生配置冲突时保留当前草稿并提示重新读取。旧版 `autoContinue` 开关由 `recoveryMode` 取代。

设置页按“总开关 → 请求身份 → 失败处理 → 自动继续”分组，下方为独立保存的“流空闲超时”，使用宿主主题颜色。选项会即时联动，保存后应用：关闭总开关时禁用请求身份和恢复配置，但仍可重新开启和保存；原生流空闲超时可继续编辑。开启不限重试次数时禁用次数上限；重试次数为 0 时禁用重试间隔；自动继续次数为 0 时禁用发送间隔和消息内容。被禁用的数值保留，切回后可继续编辑。无限重试只在连续重试模式生效，不影响继续消息模式的有限次数。

需要写 YAML 时，只覆盖 bundle 已注册的条目，不另行 insert：

```yaml
- id: llm-compat
  config:
    recoveryMode: retry
    maxRetries: 60
    retryDelaySeconds: 2
    headerMode: native
```

模型地址和 API Key 在 Harness 的模型设置中管理，不放进插件代码。恢复摘要记录到 Harness home 的 `logs/llm-compat/YYYY-MM-DD.jsonl`，每个 UTC 日文件最多约 5MB；不记录继续消息正文或自定义 UA。

## 保存时机与限制

| 设置 | 生效时机 |
| --- | --- |
| User-Agent | 保存后的下一次 HTTP 请求 |
| 重试次数、间隔、不限次数 | 下一次失败判定；已开始的等待不重计时 |
| 自动继续正文、间隔、次数 | 下一次排队任务；已排队任务保留原快照 |
| 总开关和恢复模式 | 关闭或切走继续模式后，继续消息会在发送前停止 |
| 流空闲超时 | 后续新模型调用；进行中的调用保留原快照 |

重试重新发起模型调用，自动继续增加真实会话消息，均可能增加请求量和费用。不保证无缝续写或业务副作用幂等；设置有限次数并核对重复操作。保存不会重启已结束的失败任务。不同渠道的超时草稿独立，切换不隐式保存。

## 验证与发布状态

源码仓库根目录执行 npm ci --ignore-scripts、npm test；安装 Playwright Chromium 后执行 npm run test:ui。测试使用公开依赖和合成数据，覆盖原生认证保留、五种身份、统一预算、取消、自动继续、工具序列化与三种协议回放。另有已安装宿主的隔离集成测试。

这些检查不等于真实上游验收，也不保证所有第三方插件组合。当前自定义设置页为中文，英文仅用于元数据。公开安装、跨平台升级和卸载将在发布审核后验证；本次不改变现有本机安装。

配置示例见 [请求控制](examples/request-controls.yml) 与 [流空闲超时](examples/stream-timeout.yml)。它们是已有条目的覆盖片段，不是完整 profile；不要重复注册插件或覆盖原有凭据。

## 文件结构

| 文件 | 职责 |
| --- | --- |
| lib/index.js | 配置 schema、安装和卸载 |
| lib/client.js | 设置页、配置读取和保存 |
| lib/recovery.js | 原生统一重试、可见进度、自动继续 |
| lib/transport.js | 请求范围、单次调用及 SSE 规范化 |
| lib/user-agent.js | Claude Code、Codex、pi 及自定义 User-Agent |
| lib/schema.js | 工具 schema 的 required 补齐 |
| lib/recovery-log.js | 有大小上限的恢复摘要 |
| lib/runtime.js | 从运行中的 Harness 解析官方库 |
| cordis.patch.yml、locale/ | bundle 注册及插件说明 |

插件没有构建步骤，不修改 Harness 应用归档。测试可用 `DSH_LLM_COMPAT_RUNTIME` 指定官方依赖根目录。

源码采用 [MIT 许可证](LICENSE)，依赖保留各自许可证。不发送遥测；本地摘要包含会话标识、次数、间隔和错误类别，不记录 API Key、模型请求正文、自定义 User-Agent 或继续消息正文。
