import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export function writeFreshnessReport(outputPath, report, root = process.cwd()) {
  if (!outputPath) return
  const resolved = path.resolve(root, outputPath)
  mkdirSync(path.dirname(resolved), { recursive: true })
  writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`)
}
