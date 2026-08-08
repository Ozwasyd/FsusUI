#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlaywrightOwners,
} from './layout-playwright-plan.mjs'
import {
  validateCellReceipt,
} from './layout-playwright-verify.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'
import {
  MOTION_FIXED_CELLS,
  MOTION_FIXED_NAMESPACES,
  MOTION_OWNER,
  loadMotionOwnerPlan,
} from './motion-playwright-plan.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

for (const group of ['pr', 'main', 'nightly', 'release']) {
  const plan = planOwnerCells(MOTION_OWNER, group, registry, owners)
  assert.equal(plan.owner, MOTION_OWNER, `${group} plan owner`)
  assert.equal(plan.runtimeMode, 'native', `${group} runtime mode`)
  assert.ok(plan.digest, `${group} plan digest`)
}

for (const group of ['main', 'nightly', 'release']) {
  const plan = loadMotionOwnerPlan(group)
  assert.deepEqual(
    plan.cells.map((cell) => cell.id),
    [...MOTION_FIXED_CELLS],
    `${group} fixed cell matrix`,
  )
  assert.deepEqual(
    plan.cells.map((cell) => cell.artifactNamespace),
    MOTION_FIXED_CELLS.map((cellId) => MOTION_FIXED_NAMESPACES[cellId]),
    `${group} artifact namespaces must match the fixed issue namespace`,
  )
}

const prPlan = loadMotionOwnerPlan('pr')
assert.deepEqual(
  prPlan.cells.map((cell) => cell.id),
  ['motion-ssr/chromium'],
  'pr profile must select only motion-ssr chromium',
)

const schema = JSON.parse(
  readFileSync(
    resolve(root, 'spec/ci/playwright-motion-receipts.schema.json'),
    'utf8',
  ),
)
for (const key of [
  'schemaVersion',
  'owner',
  'gate',
  'suiteId',
  'cellId',
  'project',
  'dimensions',
  'commitSha',
  'workflowGroup',
  'run',
  'toolchain',
  'runtime',
  'config',
  'tests',
  'report',
  'status',
]) {
  assert.ok(schema.properties?.[key], `receipt schema must define ${key}`)
}
assert.ok(
  schema.properties.runtime.properties.runtimeMode.const === 'native',
  'motion receipt schema runtimeMode must be native',
)

// ---- Negative fixtures ----

expectFailure('missing webkit cell', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'view-transitions')
  suite.cells = suite.cells.filter((cell) => cell.project !== 'webkit')
  const plan = planOwnerCells(MOTION_OWNER, 'main', mutated, owners)
  assert.deepEqual(plan.cells.map((cell) => cell.id), [...MOTION_FIXED_CELLS])
})

expectFailure('motion-ssr expanded to three browsers', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'motion-ssr')
  suite.cells = ['chromium', 'firefox', 'webkit'].map((browser) => ({
    id: `motion-ssr/${browser}`,
    project: browser === 'chromium' ? 'default' : browser,
    dimensions: { browser, runtimeMode: 'ssr' },
  }))
  const plan = planOwnerCells(MOTION_OWNER, 'main', mutated, owners)
  assert.deepEqual(plan.cells.map((cell) => cell.id), [...MOTION_FIXED_CELLS])
})

expectFailure('chromium-only workflow matrix drift', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'view-transitions')
  suite.cells = suite.cells.filter((cell) => cell.project === 'chromium')
  const plan = planOwnerCells(MOTION_OWNER, 'main', mutated, owners)
  assert.deepEqual(plan.cells.map((cell) => cell.id), [...MOTION_FIXED_CELLS])
})

const mainPlan = loadMotionOwnerPlan('main')
const receiptFor = (cell, overrides = {}) => ({
  schemaVersion: 1,
  owner: MOTION_OWNER,
  gate: 'playwright-motion',
  suiteId: cell.suiteId,
  cellId: cell.id,
  project: cell.project,
  dimensions: {
    browser: cell.dimensions.browser,
    viewport: cell.dimensions.viewport ?? null,
    theme: cell.dimensions.theme ?? null,
    deviceScaleFactor: null,
  },
  commitSha: 'a'.repeat(40),
  workflowGroup: 'main',
  run: { id: 'local', attempt: '1' },
  toolchain: {
    node: 'v22',
    pnpm: '10.33.0',
    playwright: '1.59.1',
    chromiumRevision: 'chromium-1234',
    firefoxRevision: 'firefox-1456',
    webkitRevision: 'webkit-1978',
  },
  runtime: {
    runtimeMode: 'native',
    manifestDigest: 'b'.repeat(64),
    sourceFingerprint: 'c'.repeat(64),
  },
  config: { path: cell.config, sha256: 'd'.repeat(64) },
  tests: { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0 },
  report: {
    path: `.tmp/playwright-motion/reports/${cell.suiteId}/${cell.project}/report.json`,
    sha256: 'e'.repeat(64),
  },
  status: 'success',
  failureReason: null,
  startedAt: '2026-08-08T00:00:00.000Z',
  endedAt: '2026-08-08T00:01:00.000Z',
  ...overrides,
})
const allReceipts = mainPlan.cells.map(receiptFor)
validateCellReceipt(allReceipts[0], mainPlan.cells[0])
validateCellReceipt(
  receiptFor(mainPlan.cells[0], {
    toolchain: {
      node: 'v22',
      pnpm: '10.33.0',
      playwright: '1.59.1',
      chromiumRevision: 'chromium-1234',
    },
  }),
  mainPlan.cells[0],
)

expectFailure('receipt with null firefoxRevision rejected', () => {
  const receipt = receiptFor(mainPlan.cells[0], {
    toolchain: {
      node: 'v22',
      pnpm: '10.33.0',
      playwright: '1.59.1',
      chromiumRevision: 'chromium-1234',
      firefoxRevision: null,
    },
  })
  validateCellReceipt(receipt, mainPlan.cells[0])
})

expectFailure('receipt zero passed is fail-closed', () => {
  const receipt = receiptFor(mainPlan.cells[0], {
    tests: { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 },
  })
  validateCellReceipt(receipt, mainPlan.cells[0])
})

expectFailure('receipt composite browser rejected', () => {
  const receipt = receiptFor(mainPlan.cells[0], {
    dimensions: { browser: 'desktop-dark' },
  })
  validateCellReceipt(receipt, mainPlan.cells[0])
})

console.log('[playwright-motion-owner] fixtures ok')
