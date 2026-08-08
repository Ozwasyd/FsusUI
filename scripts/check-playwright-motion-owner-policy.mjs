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
  MOTION_FIXED_CELLS,
  MOTION_FIXED_NAMESPACES,
  MOTION_OWNER,
  loadMotionOwnerPlan,
} from './motion-playwright-plan.mjs'

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

const validateMotionWorkflowSource = (source) => {
  const failures = []
  if (!source.includes('playwright-motion:')) {
    failures.push('reusable workflow must define a playwright-motion job')
    return failures
  }
  const job = workflowJob(source, 'playwright-motion')
  if (!job) {
    failures.push('cannot extract playwright-motion job')
    return failures
  }
  if (/\n\s+(?:strategy|matrix):/u.test(job)) {
    failures.push('playwright-motion job must not use strategy/matrix')
  }
  if (!job.includes('motion-playwright-owner-run.mjs')) {
    failures.push('playwright-motion job must run motion-playwright-owner-run.mjs')
  }
  if (
    job.includes('pnpm test:view-transitions') ||
    job.includes('pnpm test:motion:ssr')
  ) {
    failures.push('playwright-motion job must not invoke full-config suite commands')
  }
  if (occurrences(job, 'playwright install --with-deps chromium') !== 1) {
    failures.push('playwright-motion job must install one fixed Chromium')
  }
  if (occurrences(job, 'playwright install --with-deps firefox') !== 1) {
    failures.push('playwright-motion job must install Firefox for non-PR groups')
  }
  if (occurrences(job, 'playwright install --with-deps webkit') !== 1) {
    failures.push('playwright-motion job must install WebKit for non-PR groups')
  }
  if (occurrences(job, "inputs.group != 'pr'") !== 2) {
    failures.push('Firefox/WebKit installs must be gated on group != pr')
  }
  if (!job.includes('playwright-motion-evidence-${{ inputs.group }}')) {
    failures.push('playwright-motion job must upload per-group evidence')
  }
  return failures
}

const deepClone = (value) => JSON.parse(JSON.stringify(value))

const registry = loadPlaywrightSuiteRegistry()
const owners = loadPlaywrightOwners()
validatePlaywrightSuiteRegistry(registry)

for (const group of ['main', 'nightly', 'release']) {
  const plan = loadMotionOwnerPlan(group)
  assert.deepEqual(plan.cells.map((cell) => cell.id), [...MOTION_FIXED_CELLS])
  assert.deepEqual(
    plan.cells.map((cell) => cell.artifactNamespace),
    MOTION_FIXED_CELLS.map((cellId) => MOTION_FIXED_NAMESPACES[cellId]),
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
assert.deepEqual(
  planOwnerCells(MOTION_OWNER, 'pr', registry, owners).cells.map((cell) => cell.id),
  ['motion-ssr/chromium'],
  'PR group must only run motion-ssr/chromium',
)

const reusableWorkflow = readSync('.github/workflows/_quality-playwright.yml')
const topWorkflow = readSync('.github/workflows/quality.yml')
const motionWorkflowFailures = validateMotionWorkflowSource(reusableWorkflow)
assert.deepEqual(
  motionWorkflowFailures,
  [],
  `_quality-playwright.yml motion policy failures: ${motionWorkflowFailures.join('; ')}`,
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
assert.ok(topWorkflow.includes('PR_PLAYWRIGHT_RESULT'), 'pr-fast must consume premerge-playwright result')

// ---- Negative workflow fixtures ----

expectFailure('missing webkit cell must fail policy', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'view-transitions')
  suite.cells = suite.cells.filter((cell) => cell.project !== 'webkit')
  const plan = planOwnerCells(MOTION_OWNER, 'main', mutated, owners)
  assertOwnerFixedCells(plan, [...MOTION_FIXED_CELLS])
})

expectFailure('workflow with only chromium install must be rejected', () => {
  const mutated = reusableWorkflow.replace(
    'playwright install --with-deps firefox',
    'playwright install --with-deps chromium',
  )
  const failures = validateMotionWorkflowSource(mutated)
  assert.equal(failures.length, 0)
  if (failures.length === 0) throw new Error('chromium-only workflow fixture was accepted')
})

expectFailure('unconditional firefox install must be rejected', () => {
  const mutated = reusableWorkflow.replace(
    "      - run: pnpm exec playwright install --with-deps firefox\n        if: ${{ inputs.group != 'pr' }}",
    '      - run: pnpm exec playwright install --with-deps firefox',
  )
  const failures = validateMotionWorkflowSource(mutated)
  if (failures.length === 0) throw new Error('unconditional firefox workflow fixture was accepted')
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

await import('./test-playwright-motion-owner.mjs')
console.log('[check-playwright-motion-owner-policy] passed')
