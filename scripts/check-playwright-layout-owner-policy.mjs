#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadPlaywrightSuiteRegistry,
  validatePlaywrightSuiteRegistry,
} from './playwright-suites.mjs'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlanIsolation,
} from './layout-playwright-plan.mjs'
import {
  validateCellReceipt,
  verifyOwnerReceipts,
} from './layout-playwright-verify.mjs'
import {
  createImpactPlan,
  loadOwnershipRegistry,
} from './render-performance-impact.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readSync = (relative) => readFileSync(path.join(root, relative), 'utf8')

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

const workflowJob = (source, name) =>
  source.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
      'u',
    ),
  )?.[1] ?? ''

const occurrences = (value, fragment) =>
  value.split(fragment).length - 1

const validateLayoutWorkflowSource = (source) => {
  const failures = []
  if (!source.includes('playwright-layout:')) {
    failures.push('reusable workflow must define a playwright-layout job')
    return failures
  }
  const job = workflowJob(source, 'playwright-layout')
  if (!job) {
    failures.push('cannot extract playwright-layout job')
    return failures
  }
  if (/\n\s+(?:strategy|matrix):/u.test(job)) {
    failures.push('playwright-layout job must not use strategy/matrix')
  }
  if (!job.includes('layout-playwright-owner-run.mjs')) {
    failures.push('playwright-layout job must run layout-playwright-owner-run.mjs')
  }
  if (!job.includes('--skip-prepare')) {
    failures.push('playwright-layout job must pass --skip-prepare after one runtime prepare')
  }
  if (
    job.includes('pnpm test:dom-layout') ||
    job.includes('pnpm test:geometry:smoke')
  ) {
    failures.push('playwright-layout job must not invoke full-config suite commands')
  }
  if (occurrences(source, 'prepare-visual-runtime.mjs') !== 2) {
    failures.push('runtime must be prepared exactly twice in the reusable workflow (layout + boundary)')
  }
  if (occurrences(job, 'playwright install --with-deps chromium') !== 1) {
    failures.push('playwright-layout job must install one fixed Chromium')
  }
  if (!job.includes('playwright-layout-evidence-${{ inputs.group }}')) {
    failures.push('playwright-layout job must upload per-group evidence')
  }
  return failures
}

const deepClone = (value) => JSON.parse(JSON.stringify(value))

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
  toolchain: { node: 'v22.0.0', pnpm: '10.33.0', playwright: '1.59.1', chromiumRevision: 'chromium-1234' },
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

const registry = loadPlaywrightSuiteRegistry()
const owners = loadPlaywrightOwners()
validatePlaywrightSuiteRegistry(registry)

const mainPlan = planOwnerCells('playwright-layout', 'main', registry, owners)
const nightlyPlan = planOwnerCells('playwright-layout', 'nightly', registry, owners)
const releasePlan = planOwnerCells('playwright-layout', 'release', registry, owners)
const prPlan = planOwnerCells('playwright-layout', 'pr', registry, owners)

for (const plan of [mainPlan, nightlyPlan, releasePlan]) {
  assertOwnerFixedCells(plan, FIXED_CELLS)
  assert.deepEqual(
    plan.cells.map((cell) => cell.artifactNamespace),
    FIXED_CELLS.map((cellId) => FIXED_NAMESPACES[cellId]),
    `${plan.group} artifact namespaces must match the fixed issue namespace`,
  )
  assert.deepEqual(validatePlanIsolation(plan), [], `${plan.group} plan must isolate reports/output`)
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
assert.deepEqual(prPlan.cells.map((cell) => cell.id), ['geometry-smoke/chromium'])

const reusableWorkflow = readSync('.github/workflows/_quality-playwright.yml')
const topWorkflow = readSync('.github/workflows/quality.yml')
const layoutWorkflowFailures = validateLayoutWorkflowSource(reusableWorkflow)
assert.deepEqual(layoutWorkflowFailures, [], `_quality-playwright.yml policy failures: ${layoutWorkflowFailures.join('; ')}`)
assert.ok(
  validateLayoutWorkflowSource(
    reusableWorkflow.replace(
      'layout-playwright-owner-run.mjs',
      'playwright test --config=vue/playwright.dom-layout.config.ts',
    ),
  ).length > 0,
  'negative full-config fixture must fail',
)

for (const job of ['premerge-playwright', 'main-playwright', 'nightly-playwright', 'release-playwright']) {
  assert.ok(topWorkflow.includes(`${job}:`), `quality.yml must define ${job}`)
}
assert.equal(occurrences(topWorkflow, 'uses: ./.github/workflows/_quality-playwright.yml'), 4)
const premergePlaywrightBlock = topWorkflow.slice(topWorkflow.indexOf('premerge-playwright:'))
const premergePlaywrightJob = premergePlaywrightBlock.slice(0, premergePlaywrightBlock.search(/\n {2}[a-zA-Z0-9_-]+:\s*\n/))
assert.ok(
  /uses: \.\/\.github\/workflows\/_quality-playwright\.yml[\s\S]*?group: pr/u.test(premergePlaywrightJob),
  'premerge-playwright must run the PR registry group (geometry-smoke only)',
)
assert.ok(!premergePlaywrightJob.includes('group: main'), 'premerge-playwright must not run the main registry group')
assert.ok(topWorkflow.includes('PR_PLAYWRIGHT_RESULT'), 'pr-fast must consume premerge-playwright result')
assert.ok(/needs:[\s\S]*premerge-playwright/u.test(topWorkflow), 'pr-fast must need premerge-playwright')

const domLayoutConfig = readSync('vue/playwright.dom-layout.config.ts')
const geometryConfig = readSync('vue/playwright.geometry.config.ts')
for (const [label, source] of [
  ['dom-layout', domLayoutConfig],
  ['geometry', geometryConfig],
]) {
  assert.ok(source.includes('FSUS_PLAYWRIGHT_EXTERNAL_SERVER'), `${label} config must honor FSUS_PLAYWRIGHT_EXTERNAL_SERVER`)
  assert.ok(source.includes('...(externalServer ? {} : { webServer:'), `${label} config must disable its own webServer when external server is set`)
}
assert.ok(geometryConfig.includes("name: 'default'"), 'geometry config must declare explicit default project for single-cell execution')
assert.ok(geometryConfig.includes("browserName: 'chromium'"), 'geometry project must stay chromium')

const domLayoutSpec = readSync('vue/tests/dom-layout/mobile-dom-layout.spec.ts')
const geometrySpec = readSync('vue/tests/geometry/upstream-evidence.spec.ts')
assert.ok(domLayoutSpec.includes("'../../../scripts/test-parallelism'"), 'dom-layout spec must import root test-parallelism correctly')
assert.ok(geometrySpec.includes('process.env.FSUS_PLAYWRIGHT_EXTERNAL_SERVER'), 'geometry upstream evidence must honor external server')

const ownership = await loadOwnershipRegistry(root)
const changeSet = [
  '.github/workflows/quality.yml',
  '.github/workflows/_quality-playwright.yml',
  'scripts/layout-playwright-plan.mjs',
  'scripts/layout-playwright-runner.mjs',
  'scripts/layout-playwright-owner-run.mjs',
  'scripts/layout-playwright-verify.mjs',
  'scripts/check-playwright-layout-owner-policy.mjs',
  'scripts/test-playwright-layout-owner.mjs',
  'scripts/playwright-suites.mjs',
  'scripts/test-playwright-suites.mjs',
  'spec/ci/pr-render-performance-ownership.json',
  'spec/ci/playwright-owners.json',
  'spec/ci/playwright-layout-receipts.schema.json',
  'vue/playwright.dom-layout.config.ts',
  'vue/playwright.geometry.config.ts',
  'vue/tests/dom-layout/mobile-dom-layout.spec.ts',
  'vue/tests/geometry/upstream-evidence.spec.ts',
  'tests/fixtures/render-performance-impact-plan/cases.json',
  '.gitignore',
]
const impactPlan = createImpactPlan({ changedFiles: changeSet, registry: ownership, baseRef: 'policy-base' })
assert.equal(impactPlan.scope, 'skip', 'playwright-layout change set must be skip-safe for the render gate')

const schema = JSON.parse(readSync('spec/ci/playwright-layout-receipts.schema.json'))
for (const key of ['commitSha', 'workflowGroup', 'run', 'toolchain', 'runtime', 'config', 'tests', 'report', 'status']) {
  assert.ok(schema.properties[key], `receipt schema must define ${key}`)
}

// ---- Negative fixtures ----
expectFailure('missing mobile-dark cell', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'dom-layout')
  suite.cells = suite.cells.filter((cell) => cell.project !== 'mobile-dark')
  assertOwnerFixedCells(
    planOwnerCells('playwright-layout', 'main', mutated, owners),
    FIXED_CELLS,
  )
})

expectFailure('project misreported as browser', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'dom-layout')
  suite.cells[0].dimensions.browser = 'desktop-dark'
  validatePlaywrightSuiteRegistry(mutated, root)
})

const matrixWorkflow = reusableWorkflow.replace(
  'layout-playwright-owner-run.mjs',
  'playwright test --config=vue/playwright.dom-layout.config.ts',
)
assert.ok(
  validateLayoutWorkflowSource(matrixWorkflow).length > 0,
  'full-config workflow fixture must be rejected',
)
const matrixJob = reusableWorkflow.replace(
  '    timeout-minutes: 120',
  '    strategy:\n      fail-fast: false\n      matrix:\n        project: [desktop-light]\n    timeout-minutes: 120',
)
assert.ok(
  validateLayoutWorkflowSource(matrixJob).length > 0,
  'matrix workflow fixture must be rejected',
)

await import('./test-playwright-layout-owner.mjs')
console.log('[check-playwright-layout-owner-policy] passed')

const sharedReportPlan = deepClone(mainPlan)
sharedReportPlan.cells[1].reportDirectory = sharedReportPlan.cells[0].reportDirectory
assert.ok(
  validatePlanIsolation(sharedReportPlan).length > 0,
  'plan isolation must reject a shared report directory',
)

expectFailure('geometry zero tests success receipt', () => {
  const cell = mainPlan.cells.find((entry) => entry.id === 'geometry-smoke/chromium')
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
const redAggregate = verifyOwnerReceipts('playwright-layout', 'main', redReceipts, mainPlan)
assert.equal(redAggregate.failed, true, 'one red cell must fail the owner aggregate')
assert.equal(redAggregate.summary.cells.length, 5, 'red aggregate must still summarize all cells')

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
      ? makeReceipt(cell, { runtime: { runtimeMode: 'prepared-preview', manifestDigest: hex64('9'), sourceFingerprint: hex64('d') } })
      : makeReceipt(cell)
  })
  const staleResult = verifyOwnerReceipts(
    'playwright-layout',
    'main',
    staleReceipts,
    mainPlan,
    { runtimeManifestPath: manifestPath },
  )
  assert.equal(staleResult.failed, true, 'stale runtime digest must fail the owner aggregate')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

console.log('[check-playwright-layout-owner] policy ok')
