# 模型请求控制 · Model Request Controls

DeepSeek Harness 插件：集中配置模型请求的 **User-Agent、可见重试、自动继续消息和流空闲超时**。

当前为 **3.2.0 发布审核候选**，尚未公开发布。本机开发安装继续使用现有目录链接；内部包名仍为 `dsh-llm-compat`。

- 在同一张渠道卡片中配置 User-Agent 与流空闲超时；身份可选原生、Claude Code、Codex、pi 或自定义。
- 同一次模型调用失败后按次数和间隔重试，消息页显示原生进度。
- 可选在重试耗尽后发送可见的继续消息，设置正文、间隔和次数上限。
- 按渠道配置原生流空闲超时，保存后用于后续新调用。
- 对工具 schema 和流中的独立空事件做通用规范化。

插件不识别特定服务商、不改写地址或认证、不根据错误内容自动切换客户端标识。地址、协议、模型和凭据由用户在 Harness 中配置。

## 文档

- [使用说明、默认值和边界](plugins/dsh-llm-compat/README.md)
- [配置示例](plugins/dsh-llm-compat/examples/request-controls.yml)
- [发布审核与待定事项](docs/RELEASE-REVIEW.md)
- [本轮验收结果与限制](docs/VALIDATION.md)
- [开发和测试](CONTRIBUTING.md)
- [安全与隐私](SECURITY.md)
- [版本记录](plugins/dsh-llm-compat/CHANGELOG.md)
- [MIT 许可证](LICENSE)

## 开发验证

需要 Node.js 22.19 或更新版本。锁文件固定公开测试依赖，不包含 Harness 应用归档或本机 profile。

```sh
npm ci --ignore-scripts
npm test
npx playwright install chromium
npm run test:ui
npm run check:release
npm run pack:review
```

最后一个命令只在本地 `dist/` 生成审阅包和文件清单，不发布。公开安装渠道在审核后另行确定。

| 目录 | 内容 |
| --- | --- |
| `plugins/dsh-llm-compat/` | 运行源码、bundle 注册、说明和示例 |
| `verification/` | 自动测试、合成样本及独立浏览器验证 |
| `scripts/` | 内容检查和审阅包生成 |
| `docs/` | 审核与验收说明 |
| `.github/workflows/` | 测试及构件生成，不含发布步骤 |

本机诊断输出、运行时副本和开发安装脚本被 Git 忽略，现有安装流程不在本轮调整。
