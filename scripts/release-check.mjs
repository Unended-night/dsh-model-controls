import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
const packageRoot = 'plugins/dsh-model-controls/'
const pkg = JSON.parse(readFileSync(new URL('../' + packageRoot + 'package.json', import.meta.url), 'utf8'))
assert.equal(pkg.private, true, 'npm publishing stays disabled; distribute tarballs through GitHub Releases')
assert.equal(pkg.license, 'MIT')
assert.equal(pkg.name, 'dsh-model-controls', 'use the public installation identifier')
const allowed = ['lib', 'locale', 'cordis.patch.yml', 'README.md', 'LICENSE', 'CHANGELOG.md', 'examples']
assert.deepEqual([...pkg.files].sort(), [...allowed].sort())
for (const required of ['README.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'package-lock.json', 'docs/RELEASE-REVIEW.md', 'docs/INSTALLATION.md', packageRoot + 'README.md', packageRoot + 'LICENSE']) assert.ok(files.includes(required), 'missing staged file: ' + required)
const forbidden = []
for (let i = 2; i < process.argv.length; i += 2) {
  assert.equal(process.argv[i], '--forbid')
  assert.ok(process.argv[i + 1], 'expected a regular expression')
  forbidden.push(new RegExp(process.argv[i + 1], 'i'))
}
for (const file of files) {
  assert.doesNotMatch(file, /(?:^|\/)(node_modules|host|results|backups|dist)(?:\/|$)|\.(?:zip|tgz|bundle|asar)$/i, 'private/generated path: ' + file)
  const content = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  // Concrete local drive paths and common secret formats do not belong in sources.
  assert.doesNotMatch(content, /\b[A-Za-z]:[\\/](?:Users|soft_ware|Python_self_studying)[\\/]|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----|\bsk-[A-Za-z0-9]{24,}/, 'private content: ' + file)
  for (const pattern of forbidden) assert.ok(!pattern.test(file) && !pattern.test(content), 'forbidden release content: ' + file)
}
const client = readFileSync(new URL('../' + packageRoot + 'lib/client.js', import.meta.url), 'utf8')
const index = readFileSync(new URL('../' + packageRoot + 'lib/index.js', import.meta.url), 'utf8')
const transport = readFileSync(new URL('../' + packageRoot + 'lib/transport.js', import.meta.url), 'utf8')
assert.match(index, /default\('native'\)/)
assert.match(index, new RegExp("version: '" + pkg.version.replaceAll('.', '\\.') + "'"))
assert.doesNotMatch(index, /z\.const\('auto'\)/)
assert.match(client, /原生（默认）/)
assert.doesNotMatch(transport, /\.hostname\b|\.host\b|canonical|IDENTITY_REFUSAL|set\(['"]authorization['"]/i)
console.log(JSON.stringify({ result: 'PASS', files: files.length, package: pkg.name, version: pkg.version, distribution: 'GitHub Releases tarball' }))
