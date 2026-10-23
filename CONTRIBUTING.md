# Contributing

Use Node.js 22.19 or newer. From the repository root:

```sh
npm ci --ignore-scripts
npm test
npx playwright install chromium
npm run test:ui
npm run check:release
npm run pack:review
```

The lockfile pins the published Harness libraries used by the tests. Tests use synthetic messages, tools, credentials and network responses. They must not call a real model endpoint. Browser tests run an isolated settings page and do not control a running desktop session.

`npm test` covers settings rendering, selected-mode descriptions, input validation, native header preservation, request scope, retries, cancellation, continuation limits, tool serialization and replay. `npm run test:ui` checks themed dropdowns, interaction and layout at narrow and wide widths. Generated reports belong in ignored `verification/results/`.

For integration tests against an installed desktop build, set `DSH_TEST_EXECUTABLE` to its executable. The helper derives the bundled runtime beside that executable; set `DSH_LLM_COMPAT_RUNTIME` explicitly if the installation has a different layout. Neither value belongs in a committed file.

```sh
node verification/recovery-current.mjs openai-responses
node verification/recovery-current.mjs openai-completions
node verification/recovery-current.mjs anthropic-messages
node verification/timeout-current.mjs
```

These scripts use the installed adapter and native agent machinery, with an in-memory configuration editor and simulated network. They do not verify real profile persistence or an upstream service's behavior. Do not claim otherwise in a change description.

Keep runtime changes small and provider-independent. Add a regression test for meaningful behavior changes. Document timing and cancellation semantics, and keep credentials, local paths, private conversations, runtime archives and captured production responses out of Git. Dependencies keep their own licenses and are not bundled into the plugin.
