# 兼容性与测试覆盖

## 支持范围

| 项目 | 已验证范围 |
| --- | --- |
| Harness 客户端 | Windows，0.2.1-rc.2 |
| 模型协议 | OpenAI Chat Completions、OpenAI Responses、Anthropic Messages |
| 界面语言 | 中文 |
| 自动化测试 | Ubuntu 24.04，Node 22 / 24；Windows 宿主集成 |

macOS/Linux 上的实际 Harness 使用、跨版本升级和真实模型服务未包含在当前验收范围内。自动化测试使用合成响应，不代表任意上游服务都可用。

## 测试覆盖

- 77 项功能测试，覆盖 User-Agent、重试预算、取消、自动继续、工具序列化和流式响应。
- 三种协议各 11 个原生重试场景，包括有限重试、无限重试和各类失败。
- 按渠道隔离身份，覆盖同地址并发请求、模型发现和配置合并。
- 流空闲超时的默认值、保存生效时机，以及仅有心跳时的超时行为。
- 设置页在 320、480、680 像素内容宽度下的布局、下拉选择、选项联动和保存。
- 独立安装包的本地路径安装、HTTP 下载、同版本重装和卸载。
- 4.0.0 Release 附件的匿名下载、SHA-256 校验和 GitHub HTTPS 链接安装。

运行方法见 [贡献指南](../CONTRIBUTING.md)，最新结果见 [GitHub Actions](https://github.com/Unended-night/dsh-model-controls/actions)。
