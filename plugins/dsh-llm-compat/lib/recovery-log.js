import fs from 'node:fs'
import path from 'node:path'

/** Small metadata-only daily log; cap output without deleting user files. */
export function recoveryLog(root) {
  return fact => {
    const directory = path.join(root, 'logs', 'llm-compat')
    const file = path.join(directory, `${fact.time.slice(0, 10)}.jsonl`)
    fs.mkdirSync(directory, { recursive: true })
    if (fs.existsSync(file) && fs.statSync(file).size >= 5 * 1024 * 1024) return
    fs.appendFileSync(file, JSON.stringify(fact) + '\n', 'utf8')
  }
}
