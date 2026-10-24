import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, delimiter } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { importCurrent, runInCurrentRuntime, runtimeRoot } from './current-runtime.mjs'

runInCurrentRuntime(fileURLToPath(import.meta.url), process.argv.slice(2))
assert.ok(process.argv[2], 'Pass the candidate .tgz path')
const archive = resolve(process.argv[2])
const { runPluginCommand } = await importCurrent('@deepseek-ai/dsh-plugin-manager/operations')
const { loadProfileDirectory, composeEntries } = await importCurrent('@deepseek-ai/dsh-app-boot')
const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-model-controls-install-')))
const dir = join(temporary, 'profiles', 'review')
mkdirSync(dir, { recursive: true })
const manifestPath = join(dir, 'package.json')
writeFileSync(manifestPath, JSON.stringify({ name: 'model-controls-install-review', private: true, dsh: { profile: { bundles: [] } } }))
writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
writeFileSync(join(dir, 'cordis.patch.yml'), '[]\n')
const support = join(process.resourcesPath, 'runtime')
const options = {
  command: process.execPath,
  args: ['--expose-internals', join(support, 'primary-runtime/dependencies/pnpm/bin/pnpm.mjs')],
  env: { ELECTRON_RUN_AS_NODE: '1', DSH_HOME: temporary, PATH: join(support, 'bin') + delimiter + process.env.PATH },
  execution: 'service', outputBytes: 4096, lockWaitMs: 10000, idleTimeoutMs: 30000,
}
const context = { profile: 'review', dir, home: temporary, cwd: temporary, installAnchor: join(runtimeRoot, 'package.json') }
const manifest = () => JSON.parse(readFileSync(manifestPath, 'utf8'))
const compose = () => {
  const profile = loadProfileDirectory('dsh', dir, context.installAnchor)
  assert.deepEqual(profile.skippedBundles, [])
  return composeEntries([...profile.layers.map(layer => layer.patches), profile.patches])
}
const run = async args => {
  const result = await runPluginCommand(context, args, options)
  assert.equal(result.exitCode, 0, result.output)
}
const checkInstalled = async () => {
  assert.deepEqual(manifest().dsh.profile.bundles, ['dsh-model-controls'])
  const entries = compose()
  assert.equal(entries.length, 1)
  assert.equal(entries[0].id, 'model-controls')
  assert.equal(entries[0].name, 'dsh-model-controls')
  const installed = join(dir, 'node_modules/dsh-model-controls')
  assert.ok(realpathSync(installed).startsWith(temporary + '\\') || realpathSync(installed).startsWith(temporary + '/'))
  const pkg = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
  assert.equal(pkg.name, 'dsh-model-controls')
  const { Config, apply } = await import(pathToFileURL(join(installed, 'lib/index.js')).href)
  const config = Config(entries[0].config ?? {})
  assert.equal(config.enabled.get(), true)
  assert.deepEqual(config.providerHeaders.get(), {})
  const { Context } = await importCurrent('@deepseek-ai/cordis')
  const { default: Llm } = await importCurrent('@deepseek-ai/dsh-llm')
  const ctx = new Context()
  new Llm(ctx)
  let dispose
  const before = globalThis.fetch
  try {
    apply({ llm: ctx.llm, agents: { get() {} }, get: key => key === 'dshHomePath' ? () => temporary : undefined,
      logger: { info() {} }, on(event, listener) { if (event === 'dispose') dispose = listener; return () => {} } }, config)
    assert.notEqual(globalThis.fetch, before)
  } finally { dispose?.() }
  assert.equal(globalThis.fetch, before)
  assert.match(readFileSync(join(installed, 'lib/client.js'), 'utf8'), /id: 'dsh-model-controls'/)
  return pkg.version
}
let downloads = 0
const server = createServer((_request, response) => {
  downloads++
  response.setHeader('content-type', 'application/octet-stream')
  response.end(readFileSync(archive))
})
try {
  await run(['add', archive, '--ignore-scripts', '--offline'])
  const version = await checkInstalled()
  console.log('PASS local tarball: dependency, bundle, host import, lifecycle and client module')
  writeFileSync(join(dir, 'cordis.patch.yml'), '- id: model-controls\n  config:\n    maxRetries: 12\n')
  await run(['remove', 'dsh-model-controls'])
  assert.equal(manifest().dependencies?.['dsh-model-controls'], undefined)
  assert.ok(!manifest().dsh.profile.bundles.includes('dsh-model-controls'))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const url = `http://127.0.0.1:${server.address().port}/dsh-model-controls-${version}.tgz`
  await run(['add', url, '--ignore-scripts'])
  assert.ok(downloads > 0)
  await checkInstalled()
  assert.equal(compose()[0].config.maxRetries, 12)
  console.log('PASS HTTP tarball: downloaded, reinstalled and retained same-ID config')
  await run(['remove', 'dsh-model-controls'])
  assert.equal(manifest().dependencies?.['dsh-model-controls'], undefined)
  assert.ok(!manifest().dsh.profile.bundles.includes('dsh-model-controls'))
  console.log('PASS uninstall: removed dependency and bundle selection')
} finally {
  server.closeAllConnections()
  if (server.listening) await new Promise(resolve => server.close(resolve))
  assert.equal(dirname(realpathSync(temporary)), realpathSync(tmpdir()))
  assert.ok(temporary.includes('dsh-model-controls-install-'))
  rmSync(temporary, { recursive: true })
}
