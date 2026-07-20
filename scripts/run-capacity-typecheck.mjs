#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { formatCapacitySummary, resolveCapacityPlan } from './ci-capacity.mjs'

const noCache = process.argv.includes('--no-cache')
const plan = resolveCapacityPlan()

console.log(formatCapacitySummary(plan))
console.log(
  `[ci-capacity] typecheck batches=${plan.typecheckBatches.map((batch) => batch.join('+')).join(',')}`,
)

function runTask(name) {
  return new Promise((resolve) => {
    const script = `typecheck:${name}${noCache ? ':no-cache' : ''}`
    const child = spawn('pnpm', ['run', script], {
      stdio: 'inherit',
      env: {
        ...process.env,
        FSUS_NODE_HEAP_PROFILE: 'typecheck',
      },
      shell: process.platform === 'win32',
    })
    child.on('error', (error) => {
      console.error(`[ci-capacity] failed to start ${script}:`, error)
      resolve(1)
    })
    child.on('close', (code) => resolve(code ?? 1))
  })
}

let failed = false
for (const batch of plan.typecheckBatches) {
  const statuses = await Promise.all(batch.map(runTask))
  if (statuses.some((status) => status !== 0)) failed = true
}

process.exitCode = failed ? 1 : 0
