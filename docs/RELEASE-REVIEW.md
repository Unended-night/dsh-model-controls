# 发布维护指南

插件采用 MIT 许可证，通过 [GitHub Releases](https://github.com/Unended-night/dsh-model-controls/releases) 分发。`package.json` 保留 `private: true`，以禁止误发到 npm；这不影响安装 Release 中的 `.tgz`。

## 发布流程

1. 更新版本号和 Changelog，核对使用说明与实际行为。
2. 按 [贡献指南](../CONTRIBUTING.md) 运行检查并生成安装包。
3. 核对安装包仅包含运行源码、元数据、使用说明、许可证和配置示例。
4. 确认目标提交的 [GitHub Actions](https://github.com/Unended-night/dsh-model-controls/actions) 检查通过。
5. 为该提交创建版本标签和 Release，上传安装包、源码 ZIP 和 SHA-256 清单。
6. 使用匿名下载核对文件完整性，并验证公开安装链接。

不要移动已经公开的版本标签或替换同版本安装包。修复已发布的运行代码时，应发布新的版本。

支持范围和测试覆盖见 [兼容性与测试覆盖](VALIDATION.md)。安全问题通过 [私密漏洞报告](https://github.com/Unended-night/dsh-model-controls/security/advisories/new) 提交。
