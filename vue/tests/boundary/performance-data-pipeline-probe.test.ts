import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { it } from 'vitest'

it('runs the complete performance observation controls', () => {
  const root = path.resolve(import.meta.dirname, '../../..')
  execFileSync(
    process.execPath,
    ['--test', 'tests/performance-data-pipeline-probe.test.mjs'],
    { cwd: root, stdio: 'inherit' },
  )
}, 120_000)
