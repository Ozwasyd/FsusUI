/**
 * Compatibility wrapper for the old stroke-icon generator.
 *
 * FsusUI icons now use packages/icons-svg as the single visual source of truth.
 * This keeps older local workflows working without reintroducing Lucide-shaped
 * 24px stroke icons.
 */

import { spawnSync } from 'node:child_process'

const result = spawnSync(
  'pnpm',
  ['run', '-C', 'packages/icons-vue', 'build:generate'],
  {
    stdio: 'inherit',
  },
)

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
