#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlaywrightOwners,
} from './layout-playwright-plan.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'
import {
  VISUAL_REUSE_FIXED_CELLS,
  VISUAL_REUSE_OWNER,
  loadVisualReuseOwnerPlan,
} from './visual-reuse-playwright-plan.mjs'

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

const deepClone = (value) => JSON.parse(JSON.stringify(value))

const registry = loadPlaywrightSuiteRegistry()
const owners = loadPlaywrightOwners()
validatePlaywrightOwners(owners, registry)

const reuseOwner = owners.owners[VISUAL_REUSE_OWNER]
assert.ok(reuseOwner, 'visual-runtime-reuse owner must be registered')
assert.equal(reuseOwner.runtimeMode, 'prepared-reuse', 'visual-runtime-reuse runtimeMode must be prepared-reuse')
assert.deepEqual(reuseOwner.suiteIds, ['visual-runtime-reuse'], 'visual-runtime-reuse must run only visual-runtime-reuse suite')
assert.equal(reuseOwner.gate, 'visual-runtime-reuse', 'visual-runtime-reuse gate must be visual-runtime-reuse')

for (const group of ['pr', 'main', 'nightly', 'release']) {
  const plan = planOwnerCells(VISUAL_REUSE_OWNER, group, registry, owners)
  assert.equal(plan.owner, VISUAL_REUSE_OWNER, `${group} plan owner`)
  assert.equal(plan.runtimeMode, 'prepared-reuse', `${group} runtime mode`)
  assert.ok(plan.digest, `${group} plan digest`)
}

for (const group of ['main', 'nightly', 'release', 'pr']) {
  const plan = loadVisualReuseOwnerPlan(group)
  assert.deepEqual(
    plan.cells.map((cell) => cell.id),
    [...VISUAL_REUSE_FIXED_CELLS],
    `${group} fixed cell matrix`,
  )
  for (const cell of plan.cells) {
    assert.equal(cell.dimensions.browser, 'chromium', `${cell.id} must use Chromium only`)
    assert.ok(
      cell.artifactNamespace.startsWith('visual-runtime-reuse-'),
      `${cell.id} namespace must start with visual-runtime-reuse-`,
    )
    assert.equal(
      cell.command.startsWith('pnpm exec playwright test --config='),
      true,
      `${cell.id} must invoke Playwright directly via pnpm exec`,
    )
  }
}

// visual-runtime-reuse must not count toward product browser coverage
const reuseRegistry = registry.suites.find((suite) => suite.id === 'visual-runtime-reuse')
assert.ok(reuseRegistry, 'visual-runtime-reuse must be in registry')
assert.equal(
  reuseRegistry.countsTowardProductBrowserCoverage,
  false,
  'visual-runtime-reuse must not count toward product browser coverage',
)

// Negative fixtures
expectFailure('missing desktop-light cell must fail policy', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'visual-runtime-reuse')
  suite.cells = suite.cells.filter((cell) => cell.project !== 'desktop-light')
  loadVisualReuseOwnerPlan('main', mutated, owners)
})

expectFailure('non-chromium cell must be rejected (product coverage is false)', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'visual-runtime-reuse')
  suite.cells = [
    { id: 'visual-runtime-reuse/desktop-light', project: 'desktop-light', dimensions: { browser: 'chromium', viewport: 'desktop', theme: 'light', runtimeMode: 'reuse' } },
    { id: 'visual-runtime-reuse/firefox-only', project: 'firefox-only', dimensions: { browser: 'firefox', viewport: 'desktop', theme: 'light', runtimeMode: 'reuse' } },
  ]
  loadVisualReuseOwnerPlan('main', mutated, owners)
})

// The plan system validates runtimeMode against the allowlist, not per-owner expectations.
// Verify the positive case: owner reports prepared-reuse.
