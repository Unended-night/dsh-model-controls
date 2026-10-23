import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

// File plugins can live outside the installation. Resolve host packages from
// the running Harness, without copying or patching its application archive.
export async function importRuntime(specifier) {
  const resources = process.resourcesPath ?? join(dirname(process.execPath), 'resources')
  const roots = [
    process.env.DSH_LLM_COMPAT_RUNTIME,
    join(resources, 'app.asar', 'dsh'),
    join(resources, 'app.asar.unpacked', 'dsh'),
  ].filter(Boolean)
  const failures = []
  for (const root of roots) {
    try {
      const require = createRequire(join(root, 'package.json'))
      return await import(pathToFileURL(require.resolve(specifier)).href)
    } catch (error) { failures.push(error.code ?? error.name) }
  }
  try { return await import(specifier) } catch {}
  throw new Error(`llm-compat: cannot resolve ${specifier} from the Harness runtime (${failures.join(', ')})`)
}
