import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const destination = join(root, 'dist')
const npm = process.env.npm_execpath
assert.ok(npm, 'Run through npm run pack:review')
execFileSync(process.execPath, [join(root, 'scripts/release-check.mjs')], { cwd: root, stdio: 'inherit' })
execFileSync('git', ['diff', '--quiet'], { cwd: root })
mkdirSync(destination, { recursive: true })
const [report] = JSON.parse(execFileSync(process.execPath, [npm, 'pack', './plugins/dsh-model-controls', '--ignore-scripts', '--json', '--pack-destination', destination], { cwd: root, encoding: 'utf8' }))
for (const file of report.files) assert.match(file.path, /^(?:lib\/[^/]+\.js|locale\/(?:en|zh)\.json|examples\/[^/]+\.yml|package\.json|cordis\.patch\.yml|README\.md|LICENSE|CHANGELOG\.md)$/)
const archive = readFileSync(join(destination, report.filename))
const manifest = { name: report.name, version: report.version, filename: report.filename, sha256: createHash('sha256').update(archive).digest('hex'), files: report.files, publication: 'not published' }
writeFileSync(join(destination, 'review-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({ filename: report.filename, sha256: manifest.sha256, files: report.files.length, publication: manifest.publication }))
const tree = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim()
const sourceName = `${report.name}-source-${report.version}.zip`
execFileSync('git', ['archive', '--format=zip', `--prefix=${report.name}-${report.version}/`, '-o', join(destination, sourceName), tree], { cwd: root })
const sourceManifest = { name: report.name, version: report.version, filename: sourceName, gitTree: tree,
  sha256: createHash('sha256').update(readFileSync(join(destination, sourceName))).digest('hex'), publication: 'not published' }
writeFileSync(join(destination, 'source-review-manifest.json'), JSON.stringify(sourceManifest, null, 2) + '\n', 'utf8')
console.log(JSON.stringify(sourceManifest))
