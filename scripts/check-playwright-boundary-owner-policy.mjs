#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
} from './layout-playwright-plan.mjs'
import {
  loadPlaywrightSuiteRegistry,
  validatePlaywrightSuiteRegistry,
} from './playwright-suites.mjs'
import {
  BOUNDARY_FIXED_CELLS,
  BOUNDARY_FIXED_NAMESPACES,
  BOUNDARY_OWNER,
  loadBoundaryOwnerPlan,
} from './boundary-playwright-plan.mjs'

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

const validateBoundaryWorkflowSource = (source) => {
  const failures = []
  if (!source.includes('playwright-boundary:')) {
    failures.push('reusable workflow must define a playwright-boundary job')
    return failures
  }
  const job = workflowJob(source, 'playwright-boundary')
  if (!job) {
    failures.push('cannot extract playwright-boundary job')
    return failures
  }
  if (/\n\s+(?:strategy|matrix):/u.test(job)) {
    failures.push('playwright-boundary job must not use strategy/matrix')
  }
  if (!job.includes('boundary-playwright-owner-run.mjs')) {
    failures.push('playwright-boundary job must run boundary-playwright-owner-run.mjs')
  }
  if (job.includes('pnpm audit:visual-boundaries')) {
    failures.push('playwright-boundary job must not invoke full-config suite commands')
  }
  if (occurrences(job, 'playwright install --with-deps chromium') !== 1) {
    failures.push('playwright-boundary job must install exactly one fixed Chromium')
  }
  if (occurrences(job, 'playwright install --with-deps webkit') !== 1) {
    failures.push('playwright-boundary job must install WebKit for non-PR groups')
  }
  if (occurrences(job, "inputs.group != 'pr'") !== 1) {
    failures.push('WebKit install must be gated on group != pr')
  }
  if (!job.includes('playwright-boundary-evidence-${{ inputs.group }}')) {
    failures.push('playwright-boundary job must upload per-group evidence')
  }
  return failures
}

const deepClone = (value) => JSON.parse(JSON.stringify(value))

const registry = loadPlaywrightSuiteRegistry()
const owners = loadPlaywrightOwners()
validatePlaywrightSuiteRegistry(registry)

for (const group of ['main', 'nightly', 'release']) {
  const plan = loadBoundaryOwnerPlan(group)
  assert.deepEqual(plan.cells.map((cell) => cell.id), [...BOUNDARY_FIXED_CELLS])
  assert.deepEqual(
    plan.cells.map((cell) => cell.artifactNamespace),
    BOUNDARY_FIXED_CELLS.map((cellId) => BOUNDARY_FIXED_NAMESPACES[cellId]),
    `${group} artifact namespaces must match the fixed issue namespace`,
  )
  for (const cell of plan.cells) {
    const projectFlags = cell.command.match(/--project=\S+/gu) ?? []
    assert.equal(projectFlags.length, 1, `${cell.id} must target exactly one project`)
    assert.ok(!/npm-run-all|\brun-[ps]\b/u.test(cell.command), `${cell.id} must not use npm-run-all passthrough`)
    assert.equal(
      cell.command.startsWith('pnpm exec playwright test --config='),
      true,
      `${cell.id} must invoke Playwright directly via pnpm exec`,
    )
  }
}

const reusableWorkflow = readSync('.github/workflows/_quality-playwright.yml')
const topWorkflow = readSync('.github/workflows/quality.yml')
const boundaryWorkflowFailures = validateBoundaryWorkflowSource(reusableWorkflow)
assert.deepEqual(
  boundaryWorkflowFailures,
  [],
  `_quality-playwright.yml boundary policy failures: ${boundaryWorkflowFailures.join('; ')}`,
)

for (const job of ['premerge-playwright', 'main-playwright', 'nightly-playwright', 'release-playwright']) {
  assert.ok(topWorkflow.includes(`${job}:`), `quality.yml must define ${job}`)
}
assert.equal(occurrences(topWorkflow, 'uses: ./.github/workflows/_quality-playwright.yml'), 4)

const premergePlaywrightBlock = topWorkflow.slice(topWorkflow.indexOf('premerge-playwright:'))
const premergePlaywrightJob = premergePlaywrightBlock.slice(0, premergePlaywrightBlock.search(/\n {2}[a-zA-Z0-9_-]+:\s*\n/))
assert.ok(
  /uses: \.\/\.github\/workflows\/_quality-playwright\.yml[\s\S]*?group: pr/u.test(premergePlaywrightJob),
  'premerge-playwright must run the PR registry group',
)

// ---- Negative workflow fixtures ----

expectFailure('missing webkit safe-area cell must fail policy', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'visual-boundary-audit')
  suite.cells = suite.cells.filter((cell) => cell.project !== 'safe-area-webkit')
  const plan = planOwnerCells(BOUNDARY_OWNER, 'main', mutated, owners)
  assertOwnerFixedCells(plan, [...BOUNDARY_FIXED_CELLS])
})

expectFailure('missing tiny-dark cell must fail policy', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'visual-boundary-audit')
  suite.cells = suite.cells.filter((cell) => cell.project !== 'tiny-dark')
  const plan = planOwnerCells(BOUNDARY_OWNER, 'main', mutated, owners)
  assertOwnerFixedCells(plan, [...BOUNDARY_FIXED_CELLS])
})

expectFailure('workflow with only chromium install must be rejected', () => {
  const mutated = reusableWorkflow.replace(
    'playwright install --with-deps webkit',
    'playwright install --with-deps chromium',
  )
  const failures = validateBoundaryWorkflowSource(mutated)
  if (failures.length === 0) throw new Error('chromium-only boundary workflow fixture was accepted')
})

expectFailure('unconditional webkit install must be rejected', () => {
  const mutated = reusableWorkflow.replace(
    "      - run: pnpm exec playwright install --with-deps webkit\n        if: ${{ inputs.group != 'pr' }}",
    '      - run: pnpm exec playwright install --with-deps webkit',
  )
  const failures = validateBoundaryWorkflowSource(mutated)
  if (failures.length === 0) throw new Error('unconditional webkit boundary workflow fixture was accepted')
})

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

console.log('[check-playwright-boundary-owner-policy] passed')
