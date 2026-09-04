import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

// Motion governance pipeline. Runs:
//   1. The motion package's vitest suite, which already exercises
//      `assertEveryPresetHasGovernanceMetadata` and the
//      `validateMotionPresetUsage` / `validateMotionAdoptionMapping`
//      asserts in governance.ts.
//   2. The check-motion-adoption script, which validates the
//      app-level adoption mapping fixture against the allowed
//      preset list.
//   3. A static scan for component-level "I disabled motion" code
//      paths that bypass the governance module — see the inline
//      checks below.
const steps = [
  {
    name: 'motion tests',
    cmd: 'node',
    args: [
      './scripts/with-node-heap.mjs',
      'vitest',
      'run',
      '--config',
      'vue/vitest.config.ts',
      'vue/packages/motion',
    ],
  },
  {
    name: 'motion adoption fixture',
    cmd: 'node',
    args: [
      './scripts/with-node-heap.mjs',
      'node',
      './scripts/check-motion-adoption.mjs',
      'vue/packages/motion/__tests__/fixtures/fsusblog-motion-adoption.json',
    ],
  },
  {
    name: 'legacy transition semantic registry',
    cmd: 'node',
    args: ['./scripts/check-legacy-transition-motion.mjs'],
  },
  {
    name: 'legacy transition mutation corpus',
    cmd: 'node',
    args: ['./scripts/test-legacy-transition-motion.mjs'],
  },
]

let failed = false
for (const step of steps) {
  console.log(`\n[motion-governance] ${step.name}`)
  const result = spawnSync(step.cmd, step.args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    failed = true
    break
  }
}

if (failed) process.exit(1)

console.log(
  '\n[motion-governance] all checks passed (presets, adoption, runtime invariants).',
)
