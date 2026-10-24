# 安装、更新与卸载

插件包名为 `dsh-model-controls`，设置页名称为“模型请求控制”，配置 ID 为 `model-controls`。源码位于 [GitHub 仓库](https://github.com/Unended-night/dsh-model-controls)，安装包位于 [Releases](https://github.com/Unended-night/dsh-model-controls/releases)。

## 安装包

下载 [dsh-model-controls-4.0.0.tgz](https://github.com/Unended-night/dsh-model-controls/releases/download/v4.0.0/dsh-model-controls-4.0.0.tgz)，或复制其下载链接。开发者也可使用 `npm run pack:review` 生成本地 `.tgz`。包内包含运行源码，无需构建或执行安装脚本。

不要把 GitHub 自动生成的 Source code ZIP 当作安装包：仓库根目录是测试工作区，实际插件位于 `plugins/dsh-model-controls/`。也不要直接把这个仓库的 Git 地址作为插件安装源。

## 在 Harness 中安装

1. 打开侧边栏的插件管理页，进入安装入口。
2. 输入 `.tgz` 的完整本地路径，或正式 Release 中该资源的 HTTPS 下载链接。
3. 安装并启用“模型请求控制”，完成后重启 Harness。
4. 在“设置 → 模型请求控制”里选择渠道，配置 User-Agent 与流空闲超时；按需配置全局重试与自动继续。

普通设置保存后无需重启。新安装、更新插件文件后重启一次。安装到 profile 的包不再链接开发源码，编辑源码不会改变已经安装的版本。

## 命令行方式

确认当前安装提供 `dsh` 命令。Windows Desktop 使用应用随附的 `resources/runtime/cli/bin/dsh.cmd`；不要误用另一套 Harness 的 CLI。先完全退出 Harness，再运行：

```sh
dsh plugin --profile desktop add "https://github.com/Unended-night/dsh-model-controls/releases/download/v4.0.0/dsh-model-controls-4.0.0.tgz" --ignore-scripts
```

也可把下载链接替换为本地安装包的完整路径。宿主命令会调用随附 pnpm、检查版本要求，并自动注册包的 bundle。包的 `private: true` 阻止误发 npm，不阻止安装 `.tgz`，发布到 GitHub Releases 时可以保留。

## 从旧开发版切换

先移除旧插件，再安装新包，避免两个插件同时包装请求。4.0 使用新包名和设置 ID，不自动读取旧插件的设置；重新配置即可。仅删除旧插件自己的配置条目，不删除其他插件、模型渠道或认证信息。原生 `llm-pi-ai` 中的超时继续保留。

## 更新与卸载

更新前保存已修改的设置，退出 Harness，先移除当前包，再安装新版本的 `.tgz`，然后重新启动。也可以在宿主插件管理页执行移除、安装，并按提示重启。使用明确的版本链接，不依赖 `latest` 自动变动。跨版本升级尚未验证。

```sh
dsh plugin --profile desktop remove dsh-model-controls
```

卸载插件不会主动清除原生渠道的流空闲超时；如需恢复默认，在卸载前把相应渠道设置为 `300` 秒。宿主可能保留插件配置覆盖项，是否需要清理以当前宿主提示为准；不要删除整个 profile。

## 验证范围

发布包的安装验证脚本使用隔离的合成 profile，并调用已安装宿主的包管理、bundle 合成和配置 schema；不访问真实模型或读取日常 profile。它覆盖本地路径安装、HTTP 包下载、同版本重装、配置保留和卸载。该自动测试不代表实际 GitHub 下载验收；跨版本升级、其他操作系统和插件市场上架仍需后续验收。

```sh
npm run pack:review
# 先设置 DSH_TEST_EXECUTABLE 为已安装的 Harness 可执行文件
node verification/install-current.mjs dist/dsh-model-controls-4.0.0.tgz
```
