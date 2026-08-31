#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CONFORMANCE_FIXED_CELLS,
  CONFORMANCE_FIXED_NAMESPACES,
  CONFORMANCE_OWNER,
  loadConformanceOwnerPlan,
} from './conformance-playwright-plan.mjs'
import {
  CONFORMANCE_IDENTITY_SOURCES,
  validateConformanceReceipt,
} from './conformance-playwright-runner.mjs'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
} from './layout-playwright-plan.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const shaFile = (file) => sha256(readFileSync(resolve(root, file)))
const clone = (value) => JSON.parse(JSON.stringify(value))

const workflowJob = (source, name) =>
  source.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
      'u',
    ),
  )?.[1] ?? ''

const expectFailure = (label, fn) => {
  assert.throws(fn, undefined, label)
}

const registry = loadPlaywrightSuiteRegistry()
const owners = loadPlaywrightOwners()
const suite = registry.suites.find(
  (entry) => entry.id === 'web-interaction-conformance',
)
assert.ok(suite, 'web-interaction-conformance suite is required')
assert.equal(suite.command, 'pnpm test:conformance:web-interaction')
assert.deepEqual(
  suite.cells.map((cell) => cell.id),
  [...CONFORMANCE_FIXED_CELLS],
)
for (const group of ['main', 'nightly', 'release']) {
  const plan = loadConformanceOwnerPlan(group)
  assert.deepEqual(
    plan.cells.map((cell) => cell.id),
    [...CONFORMANCE_FIXED_CELLS],
  )
  assert.deepEqual(
    plan.cells.map((cell) => cell.artifactNamespace),
    CONFORMANCE_FIXED_CELLS.map(
      (cellId) => CONFORMANCE_FIXED_NAMESPACES[cellId],
    ),
  )
  for (const cell of plan.cells) {
    assert.equal((cell.command.match(/--project=\S+/gu) ?? []).length, 1)
  }
}

const workflow = read('.github/workflows/_quality-playwright.yml')
const job = workflowJob(workflow, CONFORMANCE_OWNER)
assert.ok(job, 'playwright-conformance workflow owner is required')
assert.ok(!/\n\s+(?:strategy|matrix):/u.test(job), 'outer matrix is forbidden')
assert.ok(job.includes('conformance-playwright-owner-run.mjs'))
assert.ok(!job.includes('pnpm test:conformance:web-interaction'))
for (const browser of ['chromium', 'firefox', 'webkit']) {
  assert.equal(
    job.split(`playwright install --with-deps ${browser}`).length - 1,
    1,
    `${browser} must be installed exactly once`,
  )
}
assert.ok(job.includes('uses: ./.github/actions/readiness-manifest'))
assert.ok(job.includes('gate: playwright-conformance'))
assert.ok(job.includes('playwright-receipts:'))
assert.ok(job.includes('playwright-plan:'))
assert.ok(job.includes('--impact-plan'))
assert.ok(job.includes('needs: playwright-pr-impact-plan'))
assert.ok(!job.includes('continue-on-error'))
const prReadiness = workflowJob(workflow, 'playwright-pr-readiness')
assert.ok(prReadiness.includes('playwright-conformance'))

const mutatedRegistry = clone(registry)
mutatedRegistry.suites.find(
  (entry) => entry.id === 'web-interaction-conformance',
).cells = suite.cells.filter((cell) => cell.project !== 'webkit')
expectFailure('missing WebKit cell fails', () => {
  const plan = planOwnerCells(
    CONFORMANCE_OWNER,
    'main',
    mutatedRegistry,
    owners,
  )
  assertOwnerFixedCells(plan, [...CONFORMANCE_FIXED_CELLS])
})

mkdirSync(resolve(root, '.tmp'), { recursive: true })
const scratch = mkdtempSync(resolve(root, '.tmp/conformance-policy-'))
try {
  const commitSha = 'a'.repeat(40)
  const browser = 'chromium'
  const trace = {
    schema: 'fsusui.interaction.v2',
    scenario: 'scenario.v2.el-button.focus',
    contract: CONFORMANCE_IDENTITY_SOURCES.contract,
    contractRegistry: {
      source: CONFORMANCE_IDENTITY_SOURCES.contract,
      schemaVersion: 2,
      registryVersion: '2.0.0',
    },
    baseline: 'b'.repeat(40),
    browser,
    browserIdentity: { name: browser, project: browser, version: '1' },
    candidate: commitSha,
    runtime: { component: 'ElButton', mount: 'vue', realBrowser: true },
    nativeImeEvidence: { automated: false, issueRefs: ['#319', '#320'] },
    steps: [
      {
        index: 0,
        action: 'focus',
        target: 'ElButton.primary',
        scenario: 'scenario.v2.el-button.focus',
        contract: 'component-v2.el-button',
        baseline: 'b'.repeat(40),
        candidate: commitSha,
        browserIdentity: { name: browser, project: browser, version: '1' },
        actual: { focusTarget: 'Save draft' },
        expected: { focusTarget: 'Save draft' },
        passed: true,
        artifact: 'trace.json',
      },
    ],
  }
  const tracePath = resolve(scratch, 'trace.json')
  writeFileSync(tracePath, `${JSON.stringify(trace)}\n`)
  const traceRelative = relative(root, tracePath)
  const traceSha = shaFile(traceRelative)
  const receipt = {
    commitSha,
    dimensions: { browser },
    tests: { total: 1, passed: 1, failed: 0, skipped: 0 },
    toolchain: { chromiumRevision: 'chromium-1' },
    conformance: {
      contractHash: shaFile(CONFORMANCE_IDENTITY_SOURCES.contract),
      vueBaselineHash: shaFile(CONFORMANCE_IDENTITY_SOURCES.vueBaseline),
      scenarioRegistryHash: shaFile(
        CONFORMANCE_IDENTITY_SOURCES.scenarioRegistry,
      ),
      runnerHash: shaFile(CONFORMANCE_IDENTITY_SOURCES.runner),
      browserRevision: 'chromium-1',
      representativeComponents: ['ElButton'],
      scenarioCount: 1,
      actionStepCount: 1,
      traceSchema: 'fsusui.interaction.v2',
      traceVersion: 2,
      traceBrowsers: [browser],
      traceCandidates: [commitSha],
      traceDigest: sha256(traceSha),
      traces: [{ path: traceRelative, sha256: traceSha }],
      nativeImeAutomated: false,
      nativeImeEvidenceReferences: ['#319', '#320'],
    },
  }
  const cell = loadConformanceOwnerPlan('main').cells[0]
  assert.equal(validateConformanceReceipt(receipt, cell), true)
  for (const [label, mutate] of [
    ['zero scenario', (value) => (value.conformance.scenarioCount = 0)],
    ['zero action', (value) => (value.conformance.actionStepCount = 0)],
    [
      'stale contract',
      (value) => (value.conformance.contractHash = '0'.repeat(64)),
    ],
    [
      'stale runner',
      (value) => (value.conformance.runnerHash = '0'.repeat(64)),
    ],
    [
      'copied Chromium result',
      (value) => (value.conformance.traceBrowsers = ['firefox']),
    ],
    ['synthetic IME', (value) => (value.conformance.nativeImeAutomated = true)],
    ['skip all', (value) => (value.tests.skipped = 1)],
  ]) {
    expectFailure(label, () => {
      const candidate = clone(receipt)
      mutate(candidate)
      validateConformanceReceipt(candidate, cell)
    })
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

console.log('[check-playwright-conformance-owner-policy] passed')
