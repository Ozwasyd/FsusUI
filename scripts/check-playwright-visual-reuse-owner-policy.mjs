#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadPlaywrightOwners,
} from './layout-playwright-plan.mjs'
import {
  loadPlaywrightSuiteRegistry,
  validatePlaywrightSuiteRegistry,
} from './playwright-suites.mjs'
import {
  VISUAL_REUSE_FIXED_CELLS,
  loadVisualReuseOwnerPlan,
} from './visual-reuse-playwright-plan.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readSync = (relative) => readFileSync(resolve(root, relative), 'utf8')

const workflowJob = (source, name) =>
  source.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
      'u',
    ),
  )?.[1] ?? ''

const occurrences = (value, fragment) =>
  value.split(fragment).length - 1

const validateReuseWorkflowSource = (source) => {
  const failures = []
  if (!source.includes('visual-runtime-reuse:')) {
    failures.push('reusable workflow must define a visual-runtime-reuse job')
    return failures
  }
  const job = workflowJob(source, 'visual-runtime-reuse')
  if (!job) {
    failures.push('cannot extract visual-runtime-reuse job')
    return failures
  }
  if (/\n\s+(?:strategy|matrix):/u.test(job)) {
    failures.push('visual-runtime-reuse job must not use strategy/matrix')
  }
  if (!job.includes('visual-reuse-playwright-owner-run.mjs')) {
    failures.push('visual-runtime-reuse job must run visual-reuse-playwright-owner-run.mjs')
  }
  if (
    job.includes('pnpm test:visual:reuse')
  ) {
    failures.push('visual-runtime-reuse job must not invoke full-config suite commands')
  }
  // Must install Chromium-only — no Firefox or WebKit
  if (occurrences(job, 'playwright install --with-deps chromium') !== 1) {
    failures.push('visual-runtime-reuse job must install one fixed Chromium')
  }
  if (job.includes('playwright install --with-deps firefox')) {
    failures.push('visual-runtime-reuse job must not install Firefox')
  }
  if (job.includes('playwright install --with-deps webkit')) {
    failures.push('visual-runtime-reuse job must not install WebKit')
  }
  if (!job.includes('visual-runtime-reuse-evidence-${{ inputs.group }}')) {
    failures.push('visual-runtime-reuse job must upload per-group evidence')
  }
  return failures
}

const deepClone = (value) => JSON.parse(JSON.stringify(value))

const registry = loadPlaywrightSuiteRegistry()
const owners = loadPlaywrightOwners()
validatePlaywrightSuiteRegistry(registry)

for (const group of ['main', 'nightly', 'release', 'pr']) {
  const plan = loadVisualReuseOwnerPlan(group)
  assert.deepEqual(plan.cells.map((cell) => cell.id), [...VISUAL_REUSE_FIXED_CELLS])
  assert.equal(plan.runtimeMode, 'prepared-reuse', `${group} runtime mode must be prepared-reuse`)
  for (const cell of plan.cells) {
    assert.equal(cell.dimensions.browser, 'chromium', `${cell.id} must be Chromium only`)
  }
}

const reusableWorkflow = readSync('.github/workflows/_quality-playwright.yml')
const reuseWorkflowFailures = validateReuseWorkflowSource(reusableWorkflow)
assert.deepEqual(
  reuseWorkflowFailures,
  [],
  `_quality-playwright.yml visual-runtime-reuse policy failures: ${reuseWorkflowFailures.join('; ')}`,
)

// Negative workflow fixtures
function expectFailure(label, fn) {
  let failed = false
  let message = ''
  try {
    fn()
  } catch (error) {
    failed = true
    message = error instanceof Error ? error.message : String(error)
  }
  assert.equal(failed, true, `${label}: expected failure`)
  assert.ok(message.length > 0, `${label}: empty error`)
}

expectFailure('missing desktop-light cell must fail policy', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'visual-runtime-reuse')
  suite.cells = suite.cells.filter((cell) => cell.project !== 'desktop-light')
  loadVisualReuseOwnerPlan('main', mutated, owners)
})

expectFailure('workflow with firefox install must be rejected', () => {
  const mutated = reusableWorkflow.replace(
    'playwright install --with-deps chromium',
    'playwright install --with-deps firefox',
  )
  const failures = validateReuseWorkflowSource(mutated)
  if (failures.length === 0) throw new Error('firefox-only workflow fixture was accepted')
})

await import('./test-playwright-visual-reuse-owner.mjs')
console.log('[check-playwright-visual-reuse-owner-policy] passed')
