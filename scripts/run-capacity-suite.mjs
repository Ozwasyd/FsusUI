#!/usr/bin/env node

import { spawn } from 'node:child_process'
import {
  countUnitTestFiles,
  formatCapacitySummary,
  resolveCapacityPlan,
} from './ci-capacity.mjs'

const suites = {
  'pr-fast': [
    'lint',
    'typecheck:affected',
    'tokens:check',
    'tokens:lint',
    'icons:check',
    'icons:lint',
    'governance:check',
    'check:consumer-contract',
    'check:ux-semantics',
    'check:design-source-drift',
    'check:foundation-style-boundary',
    'test:unit:affected',
    'build:package-smoke',
  ],
  full: [
    'lint',
    'typecheck',
    'tokens:check',
    'tokens:lint',
    'icons:check',
    'icons:lint',
    'conformance',
    'governance:check',
    'check:consumer-contract',
    'check:result-boundaries',
    'check:anti-ai-visual',
    'check:ux-semantics',
    'check:design-source-drift',
    'check:foundation-style-boundary',
    'check:focus-ring-contract',
    'check:theme-scale-contract',
    'check:form-state-contract',
    'check:upload-focus-contract',
    'check:popover-surface-contract',
    'check:cascader-popper-contract',
    'check:menu-popup-contract',
    'check:message-box-contract',
    'check:message-contract',
    'check:notification-contract',
    'check:viewport-safe-area-contract',
    '_test:unit:parallel',
    'build',
  ],
}

const suiteArgument = process.argv.find((argument) =>
  argument.startsWith('--suite='),
)
const suiteName = suiteArgument?.slice('--suite='.length)
if (!suiteName || !suites[suiteName]) {
  console.error(
    'Usage: node scripts/run-capacity-suite.mjs --suite=pr-fast|full',
  )
  process.exit(1)
}

const plan = resolveCapacityPlan({ unitTestFileCount: countUnitTestFiles() })
const capacity = plan.budgets.parallelLaneLimit

function taskWeight(task) {
  if (task === 'typecheck') return plan.lanes.typecheck
  if (task === '_test:unit:parallel')
    return plan.unitShards * plan.vitestWorkersPerShard
  if (task === 'typecheck:affected') return Math.min(2, plan.lanes.typecheck)
  if (task === 'test:unit:affected') return plan.vitestWorkersPerShard
  return 1
}

function isExclusive(task) {
  return task === '_test:unit:parallel' || task === 'build'
}

function createBatches(tasks) {
  const batches = []
  let current = []
  let weight = 0
  const flush = () => {
    if (current.length > 0) batches.push(current)
    current = []
    weight = 0
  }
  for (const task of tasks) {
    const nextWeight = taskWeight(task)
    if (isExclusive(task)) {
      flush()
      batches.push([task])
    } else {
      if (weight + nextWeight > capacity) flush()
      current.push(task)
      weight += nextWeight
    }
  }
  flush()
  return batches
}

function runTask(task) {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['run', task], {
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
    })
    child.on('error', (error) => {
      console.error(`[ci-capacity] failed to start ${task}:`, error)
      resolve(1)
    })
    child.on('close', (code) => resolve(code ?? 1))
  })
}

const batches = createBatches(suites[suiteName])
console.log(formatCapacitySummary(plan))
console.log(
  `[ci-capacity] ${suiteName} batches=${batches.map((batch) => batch.join('+')).join(',')}`,
)

let failed = false
for (const batch of batches) {
  const statuses = await Promise.all(batch.map(runTask))
  if (statuses.some((status) => status !== 0)) failed = true
}
process.exitCode = failed ? 1 : 0