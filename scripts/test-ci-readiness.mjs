import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  filterOwnerPlanByImpact,
  loadPlaywrightImpactPlan,
} from './playwright-impact-filter.mjs'
import {
  validatePlaywrightPrReadiness,
  validateReadiness,
} from './ci-readiness-contract.mjs'

const fixtureRoot = path.resolve('tests/fixtures/ci-readiness/valid')
const cases = JSON.parse(
  fs.readFileSync('tests/fixtures/ci-readiness/invalid-cases.json', 'utf8'),
)
const prFixtureRoot = path.resolve('tests/fixtures/ci-readiness/pr-valid')
const prSkipFixtureRoot = path.resolve(
  'tests/fixtures/ci-readiness/pr-skip-valid',
)
const prCases = JSON.parse(
  fs.readFileSync(
    'tests/fixtures/ci-readiness/pr-invalid-cases.json',
    'utf8',
  ),
)
const load = (root) =>
  fs
    .readdirSync(path.join(root, 'manifests'))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      file,
      manifest: JSON.parse(
        fs.readFileSync(path.join(root, 'manifests', file), 'utf8'),
      ),
    }))
const check = (root, profile = 'main', group = 'main') =>
  validateReadiness({
    manifests: load(root).map(({ file, manifest }) => ({
      file,
      manifest: { ...manifest, workflowGroup: group },
    })),
    profile,
    group,
    commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    runId: '42',
    runAttempt: '1',
    root,
  })
const checkPr = (root) =>
  validatePlaywrightPrReadiness({
    manifests: load(root),
    plan: JSON.parse(fs.readFileSync(path.join(root, 'plan.json'), 'utf8')),
    group: 'pr',
    commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    runId: '42',
    runAttempt: '1',
    root,
  })

const writeImpactPlan = (root, plan) => {
  const file = 'impact-plan.json'
  fs.writeFileSync(path.join(root, file), `${JSON.stringify(plan)}\n`)
  return file
}

const makeOwnerPlan = () => ({
  schemaVersion: 1,
  owner: 'playwright-motion',
  gate: 'playwright-motion',
  group: 'pr',
  digest: 'owner-plan-digest',
  runtimeMode: 'native',
  cells: [
    { id: 'view-transitions/chromium', suiteId: 'view-transitions' },
    { id: 'view-transitions/firefox', suiteId: 'view-transitions' },
    { id: 'motion-ssr/chromium', suiteId: 'motion-ssr' },
  ],
})

const makeImpactPlan = () => ({
  schemaVersion: 1,
  baseRef: 'main',
  headRef: 'HEAD',
  group: 'pr',
  registryHash: 'registry-hash',
  decisions: [
    {
      suiteId: 'view-transitions',
      decision: 'skip',
      reasonCode: 'documentation-only',
      cells: [],
    },
    {
      suiteId: 'motion-ssr',
      decision: 'run',
      reasonCode: 'suite-source-changed',
      cells: ['motion-ssr/chromium'],
    },
  ],
  planDigest: 'pr-impact-plan-digest',
})

check(fixtureRoot)
check(fixtureRoot, 'nightly', 'nightly')
check(fixtureRoot, 'release', 'release')
checkPr(prFixtureRoot)
checkPr(prSkipFixtureRoot)

// Owner-plan impact filtering: PR must consume the #485 plan and run only
// run-decided suites; non-PR profiles pass the full owner plan through.
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsusui-impact-filter-'))
  const ownerPlan = makeOwnerPlan()
  const impactPlan = makeImpactPlan()
  const impactFile = writeImpactPlan(root, impactPlan)

  const nonPr = filterOwnerPlanByImpact({
    root,
    plan: ownerPlan,
    group: 'main',
    impactPlanPath: '',
  })
  assert.equal(nonPr.plan.cells.length, 3, 'main keeps all owner cells')
  assert.equal(nonPr.impactPlanDigest, null, 'main has no impact plan digest')

  const pr = filterOwnerPlanByImpact({
    root,
    plan: ownerPlan,
    group: 'pr',
    impactPlanPath: impactFile,
  })
  assert.deepEqual(
    pr.plan.cells.map((cell) => cell.id),
    ['motion-ssr/chromium'],
    'pr keeps only run-decided suite cells',
  )
  assert.equal(pr.impactPlanDigest, 'pr-impact-plan-digest')

  assert.throws(
    () =>
      filterOwnerPlanByImpact({
        root,
        plan: ownerPlan,
        group: 'pr',
        impactPlanPath: '',
      }),
    /requires --impact-plan/iu,
    'pr without impact plan must fail closed',
  )
  assert.throws(
    () =>
      filterOwnerPlanByImpact({
        root,
        plan: ownerPlan,
        group: 'pr',
        impactPlanPath: 'missing-plan.json',
      }),
    /impact plan is missing/iu,
    'missing impact plan file must fail closed',
  )
  assert.throws(
    () =>
      filterOwnerPlanByImpact({
        root,
        plan: ownerPlan,
        group: 'pr',
        impactPlanPath: writeImpactPlan(root, {
          ...impactPlan,
          planDigest: undefined,
        }),
      }),
    /must declare planDigest/iu,
    'impact plan without planDigest must fail closed',
  )
  assert.throws(
    () =>
      loadPlaywrightImpactPlan(
        root,
        writeImpactPlan(root, { ...impactPlan, schemaVersion: 2 }),
      ),
    /schemaVersion must be 1/iu,
    'impact plan with unsupported schemaVersion must fail closed',
  )
  fs.rmSync(root, { recursive: true, force: true })
}

const copyFixture = (root) => {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'fsusui-readiness-'))
  fs.cpSync(root, copy, { recursive: true })
  return copy
}
const mutate = (root, file, change) => {
  const target = path.join(root, 'manifests', file)
  const manifest = JSON.parse(fs.readFileSync(target, 'utf8'))
  change(manifest)
  fs.writeFileSync(target, `${JSON.stringify(manifest)}\n`)
}

for (const testCase of cases) {
  const root = copyFixture(fixtureRoot)
  const manifests = path.join(root, 'manifests')
  if (testCase.mutation === 'missing')
    fs.rmSync(path.join(manifests, 'typecheck.json'))
  if (testCase.mutation === 'duplicate')
    fs.copyFileSync(
      path.join(manifests, 'unit-1.json'),
      path.join(manifests, 'unit-1-copy.json'),
    )
  if (testCase.mutation === 'sha')
    mutate(root, 'visual.json', (manifest) => {
      manifest.commitSha = 'cccccccccccccccccccccccccccccccccccccccc'
    })
  if (testCase.mutation === 'stale')
    mutate(root, 'visual.json', (manifest) => {
      manifest.run.id = '41'
    })
  if (testCase.mutation === 'digest')
    mutate(root, 'build-package.json', (manifest) => {
      manifest.artifacts[0].sha256 =
        'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
    })
  if (testCase.mutation === 'cancelled')
    mutate(root, 'visual.json', (manifest) => {
      manifest.status = 'cancelled'
    })
  if (testCase.mutation === 'pw-missing-cell')
    fs.rmSync(
      path.join(manifests, 'playwright-markdown-markdown-editor-interaction-webkit.json'),
    )
  if (testCase.mutation === 'pw-missing-safe-area-webkit')
    fs.rmSync(
      path.join(manifests, 'playwright-boundary-visual-boundary-audit-safe-area-webkit.json'),
    )
  if (testCase.mutation === 'attempt-mix')
    mutate(root, 'visual.json', (manifest) => {
      manifest.run.attempt = '2'
    })
  if (testCase.mutation === 'pw-duplicate')
    fs.copyFileSync(
      path.join(manifests, 'playwright-motion-motion-ssr-chromium.json'),
      path.join(manifests, 'playwright-motion-motion-ssr-chromium-copy.json'),
    )
  if (testCase.mutation === 'pw-wrong-dims')
    mutate(
      root,
      'playwright-motion-motion-ssr-chromium.json',
      (manifest) => {
        manifest.playwright.dimensions = { browser: 'firefox' }
      },
    )
  if (testCase.mutation === 'pw-wrong-owner')
    mutate(
      root,
      'playwright-layout-geometry-smoke-chromium.json',
      (manifest) => {
        manifest.gate = 'playwright-motion'
      },
    )
  if (testCase.mutation === 'pw-zero-tests')
    mutate(
      root,
      'playwright-motion-view-transitions-chromium.json',
      (manifest) => {
        manifest.playwright.tests = {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
        }
      },
    )
  if (testCase.mutation === 'pw-skip-main')
    mutate(
      root,
      'playwright-layout-dom-layout-desktop-light.json',
      (manifest) => {
        manifest.playwright.decision = 'skip'
        manifest.playwright.tests = {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
        }
        delete manifest.playwright.cellId
        delete manifest.playwright.dimensions
      },
    )
  if (testCase.mutation === 'pw-registry-hash')
    mutate(
      root,
      'playwright-boundary-visual-boundary-audit-safe-area-webkit.json',
      (manifest) => {
        manifest.playwright.registryHash =
          'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
      },
    )
  if (testCase.mutation === 'pw-report-digest')
    mutate(
      root,
      'playwright-markdown-markdown-editor-interaction-firefox.json',
      (manifest) => {
        manifest.playwright.report.sha256 =
          'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
      },
    )
  if (testCase.mutation === 'pw-receipt-digest')
    mutate(
      root,
      'visual-runtime-reuse-visual-runtime-reuse-mobile-light.json',
      (manifest) => {
        manifest.playwright.receiptDigest =
          'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
      },
    )
  if (testCase.mutation === 'pw-artifact-digest')
    mutate(
      root,
      'visual-runtime-reuse-visual-runtime-reuse-desktop-dark.json',
      (manifest) => {
        manifest.artifacts[0].sha256 =
          'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
      },
    )
  assert.throws(
    () => check(root),
    new RegExp(testCase.expected, 'iu'),
    testCase.name,
  )
  fs.rmSync(root, { recursive: true, force: true })
}

for (const testCase of prCases) {
  const root = copyFixture(prFixtureRoot)
  const manifests = path.join(root, 'manifests')
  if (testCase.mutation === 'pr-missing-cell')
    fs.rmSync(
      path.join(manifests, 'playwright-layout-geometry-smoke-chromium.json'),
    )
  if (testCase.mutation === 'pr-missing-skip')
    fs.rmSync(
      path.join(manifests, 'visual-runtime-reuse-visual-runtime-reuse-skip.json'),
    )
  if (testCase.mutation === 'pr-skip-digest')
    mutate(
      root,
      'visual-runtime-reuse-visual-runtime-reuse-skip.json',
      (manifest) => {
        manifest.playwright.impactPlanDigest =
          'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
      },
    )
  if (testCase.mutation === 'pr-run-as-skip')
    mutate(root, 'playwright-motion-motion-ssr-chromium.json', (manifest) => {
      manifest.playwright.decision = 'skip'
      manifest.playwright.tests = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
      }
      delete manifest.playwright.cellId
      delete manifest.playwright.dimensions
      delete manifest.playwright.config
      delete manifest.playwright.runtime
      delete manifest.playwright.report
      delete manifest.playwright.receiptPath
      delete manifest.playwright.receiptDigest
    })
  if (testCase.mutation === 'pr-extra-cell') {
    fs.copyFileSync(
      path.join(manifests, 'playwright-layout-geometry-smoke-chromium.json'),
      path.join(manifests, 'playwright-boundary-visual-boundary-audit-desktop-light.json'),
    )
    mutate(
      root,
      'playwright-boundary-visual-boundary-audit-desktop-light.json',
      (manifest) => {
        manifest.gate = 'playwright-boundary'
        manifest.playwright.suiteId = 'visual-boundary-audit'
        manifest.playwright.cellId = 'visual-boundary-audit/desktop-light'
        manifest.playwright.dimensions = {
          browser: 'chromium',
          viewport: 'desktop',
          theme: 'light',
        }
      },
    )
  }
  if (testCase.mutation === 'pr-plan-digest') {
    const plan = JSON.parse(fs.readFileSync(path.join(root, 'plan.json'), 'utf8'))
    plan.planDigest =
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    fs.writeFileSync(path.join(root, 'plan.json'), `${JSON.stringify(plan)}\n`)
  }
  assert.throws(
    () => checkPr(root),
    new RegExp(testCase.expected, 'iu'),
    testCase.name,
  )
  fs.rmSync(root, { recursive: true, force: true })
}

// Release aggregation must reject a Playwright receipt emitted by the nightly
// workflow group (identity mixing across profiles).
{
  const root = copyFixture(fixtureRoot)
  const manifests = load(root).map(({ file, manifest }) => ({
    file,
    manifest: { ...manifest, workflowGroup: 'release' },
  }))
  manifests[0].manifest.workflowGroup = 'nightly'
  assert.throws(
    () =>
      validateReadiness({
        manifests,
        profile: 'release',
        group: 'release',
        commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        runId: '42',
        runAttempt: '1',
        root,
      }),
    /workflow group mismatch/iu,
    'release must reject nightly-workflow receipts',
  )
  fs.rmSync(root, { recursive: true, force: true })
}

console.log(
  `[ci-readiness-fixtures] profiles=3 invalid=${cases.length} pr-invalid=${prCases.length} pr-valid=2 identity-mix=1 impact-filter=1`,
)
