#!/usr/bin/env node

import { spawn } from 'node:child_process'
import glob from 'fast-glob'
import {
  createCapacityPlan,
  createUnitMatrix,
  formatCapacitySummary,
  probeCapacityHost,
  serializeCapacityPlan,
} from './ci-capacity.mjs'

const unitTestFileCount = glob.sync(
  [
    'vue/packages/**/__tests__/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}',
    'vue/tests/boundary/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}',
  ],
  { ignore: ['**/node_modules/**'] },
).length
const plan = createCapacityPlan(probeCapacityHost(), process.env, {
  unitTestFileCount,
})
const matrix = createUnitMatrix(plan)

console.log(formatCapacitySummary(plan))

function runShard(entry) {
  return new Promise((resolve) => {
    const args = [
      './scripts/with-node-heap.mjs',
      'pnpm',
      'exec',
      'vitest',
      'run',
      '--config',
      'vue/vitest.config.ts',
    ]
    if (matrix.length > 1) args.push(`--shard=${entry.shard}`)
    const child = spawn('node', args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        FSUS_CI_CAPACITY_PLAN: serializeCapacityPlan(plan),
        FSUS_NODE_HEAP_PROFILE: 'unit',
        FSUS_VITEST_WORKERS: String(entry.workers),
      },
      shell: process.platform === 'win32',
    })
    child.on('error', (error) => {
      console.error(`[ci-capacity] failed to start Unit ${entry.shard}:`, error)
      resolve(1)
    })
    child.on('close', (code) => resolve(code ?? 1))
  })
}

const statuses = await Promise.all(matrix.map(runShard))
process.exitCode = statuses.some((status) => status !== 0) ? 1 : 0
