# 发布检查与维护

首个公开版本为 **4.0.0**，展示名为 **模型请求控制 / Model Request Controls**。包名 `dsh-model-controls`，配置 ID `model-controls`。使用新插件身份安装，不迁移旧开发版设置。

本轮已完成的检查及未验证范围见 [验收记录](VALIDATION.md)。

源码仓库为 [Unended-night/dsh-model-controls](https://github.com/Unended-night/dsh-model-controls)。使用 MIT 许可证，通过 GitHub Releases 分发独立 `.tgz` 安装包；见 [安装说明](INSTALLATION.md)。`private: true` 保留以禁止误发 npm；它不影响 GitHub 分发。仓库不存储发布凭据。

## 审核内容

1. 核对 README 的实际功能、默认值、重试范围、超时生效时机与限制。
2. 在当前本机安装重启后检查渠道选择、五种身份选项、合并后的渠道卡片与配置持久化。
3. 审阅 `npm run pack:review` 生成的压缩包、文件清单和 SHA-256。包内应只有运行源码、语言元数据、bundle 注册、许可证、说明和示例。
4. 提交使用维护者本人确认的 GitHub noreply 邮箱。核对许可证署名与 [私密安全报告入口](https://github.com/Unended-night/dsh-model-controls/security/advisories/new)。
5. 核对安装验收记录，限定首批支持版本和系统；跨平台与实际 GitHub 下载另行验收。
6. 发布前检查目标提交的 CI 结果；为该提交创建版本标签和 Release，上传安装包、源码 ZIP 与清单，随后匿名下载并核对 SHA-256。不要移动已经公开的版本标签或替换同版本安装包。

## 可复现的检查

```sh
npm ci --ignore-scripts
npm test
npx playwright install chromium
npm run test:ui
npm run check:release
npm run pack:review
```

`check:release` 检查 Git 索引中的待发布文件、必要文档、默认模式、包内容边界、个人路径和凭据形态。可通过 `--forbid <正则表达式>` 增加项目审核用词检查。请先暂存拟公开文件，使检查覆盖本次新增文件。

`.github/workflows/ci.yml` 在 Node 22/24 上测试并生成构件，不自动发布。远程运行结果见 [GitHub Actions](https://github.com/Unended-night/dsh-model-controls/actions)；本地测试成功不等于 CI 已运行。

## 本地资料与公开历史

旧的开发安装脚本、运行时副本、测试输出和桌面诊断资料保留在本机且被 Git 忽略，不进入源代码历史或分发包。清理前快照另存于仓库外的本地恢复 bundle。公开时使用清理后的分支或 `git archive` 导出的源码，不打包整个本机工作目录，也不复制本地 `.git`、reflog 或恢复备份。

## 已知边界

- 原生默认只表示保留原生 User-Agent；启用总开关时仍有统一恢复与通用请求规范化。
- 模型发现没有插件内部自动重试；宿主或 SDK 自身的行为由其配置决定。
- 本地安装包验证不能代替实际公开链接验证；检查匿名下载和完整性后再宣布发布完成。
- 当前自定义设置页为中文；英文元数据不代表完整英文界面。
- User-Agent 与超时按渠道配置；重试和自动继续保持全局。未配置的渠道使用原生 User-Agent。
- 预设标识不能证明客户端身份、增加账户权限、修复认证或替代服务端配置。
