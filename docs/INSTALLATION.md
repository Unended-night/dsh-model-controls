# 安装、更新与卸载

## 安装插件

1. 打开 DeepSeek Harness 的**插件管理**页面，进入安装入口。
2. 粘贴下面的下载链接，安装并启用“模型请求控制”。
3. 重启 Harness，打开 **设置 → 模型请求控制**。

```text
https://github.com/Unended-night/dsh-model-controls/releases/download/v4.0.0/dsh-model-controls-4.0.0.tgz
```

也可以在 [Releases](https://github.com/Unended-night/dsh-model-controls/releases) 下载 `dsh-model-controls-4.0.0.tgz`，再用文件的完整路径安装。请选择 `.tgz` 插件包；Source code ZIP 是源码。

首次安装或更新后需要重启一次，平时保存配置无需重启。插件直接使用 Harness 中已有的模型渠道，无需在插件内重新填写 API Key。

目前已在 Windows 的 Harness **0.2.1-rc.2** 上验证。其他系统的实际 Harness 安装尚未验证。

## 更新

1. 保存已经修改的设置。
2. 在插件管理页移除当前插件。
3. 使用新版本 Release 中的 `.tgz` 安装包重新安装，按宿主提示重启。
4. 打开插件设置，检查渠道和恢复参数。

已验证同版本重装时保留配置。跨版本升级请先阅读对应版本的发布说明，并记录重要设置。

## 卸载

在 Harness 插件管理页移除“模型请求控制”，按提示重启。

卸载不会主动清除各渠道的流空闲超时。需要恢复默认值时，在卸载前把相应渠道设为 **300 秒**并保存。

## 命令行安装

如果你已配置 Harness 的 `dsh` 命令，也可通过命令行安装。操作前完全退出 Harness。

```sh
dsh plugin --profile desktop add "https://github.com/Unended-night/dsh-model-controls/releases/download/v4.0.0/dsh-model-controls-4.0.0.tgz" --ignore-scripts
```

卸载命令：

```sh
dsh plugin --profile desktop remove dsh-model-controls
```

[使用说明](../plugins/dsh-model-controls/README.md) · [问题反馈](https://github.com/Unended-night/dsh-model-controls/issues)
