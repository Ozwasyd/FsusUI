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
import { relative, resolve } from 'node:path'
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
  assertMissingCellRejected,
  assertOwnerPlans,
  deepClone,
  expectThrows,
  extractWorkflowJob,
  loadPlaywrightPolicyContext,
  repoRoot,
  validatePlaywrightOwnerWorkflow,
} from './lib/playwright-owner-policy-core.mjs'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const shaFile = (file) => sha256(readFileSync(resolve(repoRoot, file)))

const { registry, owners, reusableWorkflow } = loadPlaywrightPolicyContext()

const suite = registry.suites.find(
  (entry) => entry.id === 'web-interaction-conformance',
)
assert.ok(suite, 'web-interaction-conformance suite is required')
assert.equal(suite.command, 'pnpm test:conformance:web-interaction')
assert.deepEqual(
  suite.cells.map((cell) => cell.id),
  [...CONFORMANCE_FIXED_CELLS],
)

assertOwnerPlans({
  loadPlan: loadConformanceOwnerPlan,
  fixedCells: CONFORMANCE_FIXED_CELLS,
  fixedNamespaces: CONFORMANCE_FIXED_NAMESPACES,
})

const workflowFailures = validatePlaywrightOwnerWorkflow(reusableWorkflow, {
  jobName: CONFORMANCE_OWNER,
  ownerScript: 'conformance-playwright-owner-run.mjs',
  forbiddenCommands: ['pnpm test:conformance:web-interaction'],
  requiredBrowsers: ['chromium', 'firefox', 'webkit'],
  requireEvidenceUpload: false,
  extraChecks: [
    (job) =>
      [
        'uses: ./.github/actions/readiness-manifest',
        'gate: playwright-conformance',
        'playwright-receipts:',
        'playwright-plan:',
        '--impact-plan',
        'needs: playwright-pr-impact-plan',
      ]
        .filter((fragment) => !job.includes(fragment))
        .map((fragment) => `missing required conformance fragment: ${fragment}`)
        .join('; ') || null,
    (job) =>
      job.includes('continue-on-error')
        ? 'playwright-conformance must not continue-on-error'
        : null,
  ],
})
assert.deepEqual(workflowFailures, [], workflowFailures.join('; '))
assert.ok(
  extractWorkflowJob(reusableWorkflow, 'playwright-pr-readiness').includes(
    'playwright-conformance',
  ),
)

assertMissingCellRejected({
  label: 'missing WebKit cell fails',
  registry,
  owners,
  owner: CONFORMANCE_OWNER,
  suiteId: 'web-interaction-conformance',
  project: 'webkit',
  fixedCells: CONFORMANCE_FIXED_CELLS,
})

mkdirSync(resolve(repoRoot, '.tmp'), { recursive: true })
const scratch = mkdtempSync(resolve(repoRoot, '.tmp/conformance-policy-'))
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
  const traceRelative = relative(repoRoot, tracePath)
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
    expectThrows(label, () => {
      const candidate = deepClone(receipt)
      mutate(candidate)
      validateConformanceReceipt(candidate, cell)
    })
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

console.log('[check-playwright-conformance-owner-policy] passed')
