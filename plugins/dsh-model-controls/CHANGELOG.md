# Changelog

## 4.0.0 — review candidate

- Use the package name `dsh-model-controls` and settings ID `model-controls`. Install as a new plugin and configure it manually.
- Default unconfigured channels to native identity; remove global legacy User-Agent defaults.
- Distribute a self-contained npm tarball suitable for GitHub Release downloads.
- Keep provider definitions and native stream idle timeouts in Harness.


## 3.2.0 — review candidate

- Group channel selection, User-Agent and stream idle timeout in the upper settings card.
- Apply identity per native provider ID, including concurrent channels sharing one endpoint and provider-scoped model discovery.
- Keep channel drafts separate and preserve global retry edits while saving a channel.
- Report partial saves explicitly when identity succeeds but native timeout fails.
- Retain previous identity defaults for channels without an explicit override.
- Keep retries and continuation global, with their own save action.

## 3.1.0 — review candidate

- Rename the settings page to Model Request Controls / 模型请求控制.
- Default to the native User-Agent, with explicit Claude Code, Codex, pi and custom presets.
- Preserve provider URLs and authentication headers exactly as supplied by Harness.
- Keep all retry decisions in the native agent recovery flow, with visible counters and fixed configurable delays.
- Support finite or unlimited retries, and optional bounded continuation messages.
- Expose each provider's native stream idle timeout in seconds.
- Apply tool-schema and empty-stream-event normalization consistently across providers.
- Show contextual descriptions for the selected User-Agent and recovery modes.
- Include documentation, configuration examples, reproducible tests and a review package workflow.

These candidates have not been published. Version 4 changes package and settings identifiers.
