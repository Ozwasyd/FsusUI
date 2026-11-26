#!/usr/bin/env node

import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  collectConfigSources,
  validatePlaywrightSuiteRegistry,
} from './playwright-suites.mjs'
import {
  planOwnerCells,
  validatePlanIsolation,
} from './layout-playwright-plan.mjs'
import {
  validateCellReceipt,
  verifyOwnerReceipts,
} from './layout-playwright-verify.mjs'
import {
  assertMissingCellRejected,
  assertOwnerPlans,
  assertTopWorkflowPlaywrightJobs,
  countOccurrences,
  deepClone,
  expectThrows,
  loadPlaywrightPolicyContext,
  readRepoText,
  repoRoot,
  validatePlaywrightOwnerWorkflow,
} from './lib/playwright-owner-policy-core.mjs'

const FIXED_CELLS = [
  'dom-layout/desktop-light',
  'dom-layout/mobile-light',
  'dom-layout/desktop-dark',
  'dom-layout/mobile-dark',
  'geometry-smoke/chromium',
]
const FIXED_NAMESPACES = {
  'dom-layout/desktop-light': 'playwright-layout-dom-desktop-light',
  'dom-layout/mobile-light': 'playwright-layout-dom-mobile-light',
  'dom-layout/desktop-dark': 'playwright-layout-dom-desktop-dark',
  'dom-layout/mobile-dark': 'playwright-layout-dom-mobile-dark',
  'geometry-smoke/chromium': 'playwright-layout-geometry-chromium',
}

const validateLayoutWorkflow = (source) =>
  validatePlaywrightOwnerWorkflow(source, {
    jobName: 'playwright-layout',
    ownerScript: 'layout-playwright-owner-run.mjs',
    forbiddenCommands: ['pnpm test:dom-layout', 'pnpm test:geometry:smoke'],
    requiredBrowsers: ['chromium'],
    extraChecks: [
      (job) =>
        !job.includes('--skip-prepare')
          ? 'playwright-layout job must pass --skip-prepare after one runtime prepare'
          : null,
      (_job, fullSource) =>
        countOccurrences(fullSource, 'prepare-visual-runtime.mjs') !== 2
          ? 'runtime must be prepared exactly twice in the reusable workflow (layout + boundary)'
          : null,
    ],
  })

const hex64 = (character = 'a') => character.repeat(64)
const hex40 = (character = 'b') => character.repeat(40)

const makeReceipt = (cell, overrides = {}) => ({
  schemaVersion: 1,
  owner: 'playwright-layout',
  gate: 'playwright-layout',
  suiteId: cell.suiteId,
  cellId: cell.id,
  project: cell.project,
  dimensions: {
    browser: 'chromium',
    viewport: cell.dimensions.viewport,
    theme: cell.dimensions.theme,
    deviceScaleFactor: cell.dimensions.deviceScaleFactor,
  },
  commitSha: hex40(),
  workflowGroup: 'main',
  run: { id: 'local', attempt: '1' },
  toolchain: {
    node: 'v22.0.0',
    pnpm: '10.33.0',
    playwright: '1.59.1',
    chromiumRevision: 'chromium-1234',
  },
  runtime: {
    runtimeMode: 'prepared-preview',
    manifestDigest: hex64('c'),
    sourceFingerprint: hex64('d'),
  },
  config: { path: cell.config, sha256: hex64('e') },
  tests: { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0 },
  report: { path: `${cell.reportDirectory}/report.json`, sha256: hex64('f') },
  status: 'success',
  failureReason: null,
  startedAt: '2026-08-08T00:00:00.000Z',
  endedAt: '2026-08-08T00:01:00.000Z',
  ...overrides,
})

const { registry, owners, reusableWorkflow, topWorkflow } =
  loadPlaywrightPolicyContext()

const plans = assertOwnerPlans({
  loadPlan: (group) => planOwnerCells('playwright-layout', group, registry, owners),
  fixedCells: FIXED_CELLS,
  fixedNamespaces: FIXED_NAMESPACES,
  checkIsolation: true,
})
const mainPlan = plans.get('main')
const prPlan = planOwnerCells('playwright-layout', 'pr', registry, owners)
assert.deepEqual(
  prPlan.cells.map((cell) => cell.id),
  ['geometry-smoke/chromium'],
)

const layoutWorkflowFailures = validateLayoutWorkflow(reusableWorkflow)
assert.deepEqual(
  layoutWorkflowFailures,
  [],
  `_quality-playwright.yml policy failures: ${layoutWorkflowFailures.join('; ')}`,
)
assert.ok(
  validateLayoutWorkflow(
    reusableWorkflow.replace(
      'layout-playwright-owner-run.mjs',
      'playwright test --config=vue/playwright.dom-layout.config.ts',
    ),
  ).length > 0,
  'negative full-config fixture must fail',
)
assert.ok(
  validateLayoutWorkflow(
    reusableWorkflow.replace(
      '    timeout-minutes: 120',
      '    strategy:\n      fail-fast: false\n      matrix:\n        project: [desktop-light]\n    timeout-minutes: 120',
    ),
  ).length > 0,
  'matrix workflow fixture must be rejected',
)

assertTopWorkflowPlaywrightJobs(topWorkflow, {
  requirePremergePrGroup: true,
  requirePrResultConsumption: true,
})

for (const [label, configPath] of [
  ['dom-layout', 'vue/playwright.dom-layout.config.ts'],
  ['geometry', 'vue/playwright.geometry.config.ts'],
]) {
  const graphSource = collectConfigSources(repoRoot, configPath).join('\n')
  assert.ok(
    graphSource.includes('FSUS_PLAYWRIGHT_EXTERNAL_SERVER'),
    `${label} config must honor FSUS_PLAYWRIGHT_EXTERNAL_SERVER`,
  )
  assert.ok(
    /(?:useExternalServer|externalServer)\s*\?\s*\{\}\s*:\s*\{\s*webServer:/u.test(
      graphSource,
    ) || graphSource.includes('webServer: externalServer ? undefined :'),
    `${label} config must disable its own webServer when external server is set`,
  )
}
const geometrySource = collectConfigSources(
  repoRoot,
  'vue/playwright.geometry.config.ts',
).join('\n')
assert.ok(
  geometrySource.includes("name: 'default'"),
  'geometry config must declare explicit default project for single-cell execution',
)
assert.ok(
  geometrySource.includes("browserName: 'chromium'"),
  'geometry project must stay chromium',
)

assert.ok(
  readRepoText('vue/tests/dom-layout/mobile-dom-layout.spec.ts').includes(
    "'../../../scripts/test-parallelism'",
  ),
  'dom-layout spec must import root test-parallelism correctly',
)
assert.ok(
  readRepoText('vue/tests/geometry/upstream-evidence.spec.ts').includes(
    'process.env.FSUS_PLAYWRIGHT_EXTERNAL_SERVER',
  ),
  'geometry upstream evidence must honor external server',
)

const schema = JSON.parse(
  readRepoText('spec/ci/playwright-layout-receipts.schema.json'),
)
for (const key of [
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
  assert.ok(schema.properties[key], `receipt schema must define ${key}`)
}

assertMissingCellRejected({
  label: 'missing mobile-dark cell',
  registry,
  owners,
  owner: 'playwright-layout',
  suiteId: 'dom-layout',
  project: 'mobile-dark',
  fixedCells: FIXED_CELLS,
})

expectThrows('project misreported as browser', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'dom-layout')
  suite.cells[0].dimensions.browser = 'desktop-dark'
  validatePlaywrightSuiteRegistry(mutated, repoRoot)
})

await import('./test-playwright-layout-owner.mjs')
console.log('[check-playwright-layout-owner-policy] passed')

const sharedReportPlan = deepClone(mainPlan)
sharedReportPlan.cells[1].reportDirectory =
  sharedReportPlan.cells[0].reportDirectory
assert.ok(
  validatePlanIsolation(sharedReportPlan).length > 0,
  'plan isolation must reject a shared report directory',
)

expectThrows('geometry zero tests success receipt', () => {
  const cell = mainPlan.cells.find(
    (entry) => entry.id === 'geometry-smoke/chromium',
  )
  validateCellReceipt(
    makeReceipt(cell, {
      tests: { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 },
    }),
    cell,
  )
})

const redReceipts = FIXED_CELLS.map((cellId, index) => {
  const cell = mainPlan.cells.find((entry) => entry.id === cellId)
  return index === 4
    ? makeReceipt(cell, {
        status: 'failure',
        tests: { total: 1, passed: 0, failed: 1, skipped: 0, flaky: 0 },
        report: null,
        failureReason: 'fixture red cell',
      })
    : makeReceipt(cell)
})
const redAggregate = verifyOwnerReceipts(
  'playwright-layout',
  'main',
  redReceipts,
  mainPlan,
)
assert.equal(redAggregate.failed, true, 'one red cell must fail the owner aggregate')
assert.equal(
  redAggregate.summary.cells.length,
  5,
  'red aggregate must still summarize all cells',
)

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'fsusui-layout-policy-'))
try {
  const manifestPath = path.join(tempRoot, 'manifest.json')
  await writeFile(
    manifestPath,
    JSON.stringify({ sourceFingerprint: hex64('d'), schemaVersion: 1 }, null, 2),
  )
  const staleReceipts = FIXED_CELLS.map((cellId, index) => {
    const cell = mainPlan.cells.find((entry) => entry.id === cellId)
    return index === 3
      ? makeReceipt(cell, {
          runtime: {
            runtimeMode: 'prepared-preview',
            manifestDigest: hex64('9'),
            sourceFingerprint: hex64('d'),
          },
        })
      : makeReceipt(cell)
  })
  const staleResult = verifyOwnerReceipts(
    'playwright-layout',
    'main',
    staleReceipts,
    mainPlan,
    { runtimeManifestPath: manifestPath },
  )
  assert.equal(
    staleResult.failed,
    true,
    'stale runtime digest must fail the owner aggregate',
  )
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

console.log('[check-playwright-layout-owner] policy ok')
