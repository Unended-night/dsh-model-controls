import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const executable = process.env.DSH_TEST_EXECUTABLE
export const runtimeRoot = process.env.DSH_MODEL_CONTROLS_RUNTIME
  ? resolve(process.env.DSH_MODEL_CONTROLS_RUNTIME)
  : process.versions.electron ? join(process.resourcesPath, 'app.asar', 'dsh')
    : fileURLToPath(new URL('../', import.meta.url))
export function runInCurrentRuntime(file, args = []) {
  if (process.versions.electron) return
  if (!executable) throw new Error('Set DSH_TEST_EXECUTABLE to the installed Harness executable for host integration tests.')
  const result = spawnSync(executable, [file, ...args], {
    encoding: 'utf8', windowsHide: true, timeout: 180000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_MODEL_CONTROLS_RUNTIME: process.env.DSH_MODEL_CONTROLS_RUNTIME ?? join(dirname(executable), 'resources', 'app.asar', 'dsh') },
  })
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}
export const currentRequire = createRequire(join(runtimeRoot, 'package.json'))
export const importCurrent = specifier => import(pathToFileURL(currentRequire.resolve(specifier)).href)
