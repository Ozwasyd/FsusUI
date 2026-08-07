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
  verifyOwnerReceipts,
} from './layout-playwright-verify.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIXED_CELLS = Object.freeze([
  'dom-layout/desktop-light',
  'dom-layout/mobile-light',
  'dom-layout/desktop-dark',
  'dom-layout/mobile-dark',
  'geometry-smoke/chromium',
])

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
  const plan = planOwnerCells('playwright-layout', group, registry, owners)
  assert.equal(plan.owner, 'playwright-layout', `${group} plan owner`)
  assert.equal(plan.runtimeMode, 'prepared-preview', `${group} runtime mode`)
  assert.ok(plan.digest, `${group} plan digest`)
}

for (const group of ['main', 'nightly', 'release']) {
  const plan = planOwnerCells('playwright-layout', group, registry, owners)
  assert.deepEqual(
    plan.cells.map((cell) => cell.id),
    [...FIXED_CELLS],
    `${group} fixed cell matrix`,
  )
}

const prPlan = planOwnerCells('playwright-layout', 'pr', registry, owners)
assert.deepEqual(
  prPlan.cells.map((cell) => cell.id),
  ['geometry-smoke/chromium'],
  'pr profile must select only geometry smoke',
)

const schema = JSON.parse(
  readFileSync(
    resolve(root, 'spec/ci/playwright-layout-receipts.schema.json'),
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

// ---- Negative fixtures ----

expectFailure('unknown device', () => {
  const mutated = deepClone(owners)
  mutated.owners['playwright-layout'].deviceByProject[
    'dom-layout/desktop-light'
  ] = 'Not A Device'
  validatePlaywrightOwners(mutated, registry)
})

expectFailure('unparameterized namespace', () => {
  const mutated = deepClone(owners)
  mutated.owners['playwright-layout'].artifactNamespace['dom-layout'] =
    'fixed-name'
  validatePlaywrightOwners(mutated, registry)
})

expectFailure('missing fixed geometry cell', () => {
  const mutatedRegistry = deepClone(registry)
  const suite = mutatedRegistry.suites.find(
    (entry) => entry.id === 'geometry-smoke',
  )
  suite.cells = []
  const plan = planOwnerCells(
    'playwright-layout',
    'main',
    mutatedRegistry,
    owners,
  )
  assert.equal(plan.cells.length, 4)
})

const mainPlan = planOwnerCells('playwright-layout', 'main', registry, owners)
const receiptFor = (cell) => ({
  schemaVersion: 1,
  owner: 'playwright-layout',
  gate: 'playwright-layout',
  suiteId: cell.suiteId,
  cellId: cell.id,
  project: cell.project,
  dimensions: {
    browser: cell.dimensions.browser,
    viewport: cell.dimensions.viewport,
    theme: cell.dimensions.theme,
    deviceScaleFactor: cell.dimensions.deviceScaleFactor,
  },
  commitSha: 'a'.repeat(40),
  workflowGroup: 'main',
  run: { id: 'local', attempt: '1' },
  toolchain: { node: 'v22', pnpm: '10.33.0', playwright: '1.59.1' },
  runtime: {
    runtimeMode: 'prepared-preview',
    manifestDigest: 'b'.repeat(64),
    sourceFingerprint: 'c'.repeat(64),
  },
  config: { path: cell.config, sha256: 'd'.repeat(64) },
  tests: { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0 },
  report: {
    path: `.tmp/playwright-layout/reports/${cell.suiteId}/${cell.project}/report.json`,
    sha256: 'e'.repeat(64),
  },
  status: 'success',
  failureReason: null,
  startedAt: '2026-08-08T00:00:00.000Z',
  endedAt: '2026-08-08T00:01:00.000Z',
})
const allReceipts = mainPlan.cells.map(receiptFor)
validateCellReceipt(allReceipts[0], mainPlan.cells[0])

expectFailure('receipt missing tests', () => {
  const receipt = deepClone(allReceipts[0])
  delete receipt.tests
  validateCellReceipt(receipt, mainPlan.cells[0])
})

expectFailure('receipt zero passed is fail-closed', () => {
  const receipt = deepClone(allReceipts[0])
  receipt.tests = { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 }
  validateCellReceipt(receipt, mainPlan.cells[0])
})

expectFailure('receipt composite browser rejected', () => {
  const receipt = deepClone(allReceipts[0])
  receipt.dimensions.browser = 'desktop-dark'
  validateCellReceipt(receipt, mainPlan.cells[0])
})

const verification = verifyOwnerReceipts(
  'playwright-layout',
  'main',
  allReceipts,
  mainPlan,
)
assert.equal(verification.failed, false)
assert.equal(verification.summary.cells.length, 5)

console.log('[playwright-layout-owner] fixtures ok')
