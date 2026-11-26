#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  VISUAL_REUSE_FIXED_CELLS,
  loadVisualReuseOwnerPlan,
} from './visual-reuse-playwright-plan.mjs'
import {
  assertMissingCellRejected,
  assertOwnerPlans,
  loadPlaywrightPolicyContext,
  validatePlaywrightOwnerWorkflow,
} from './lib/playwright-owner-policy-core.mjs'

const { registry, owners, reusableWorkflow } = loadPlaywrightPolicyContext()

const validateReuseWorkflow = (source) =>
  validatePlaywrightOwnerWorkflow(source, {
    jobName: 'visual-runtime-reuse',
    ownerScript: 'visual-reuse-playwright-owner-run.mjs',
    forbiddenCommands: ['pnpm test:visual:reuse'],
    requiredBrowsers: ['chromium'],
    forbiddenBrowsers: ['firefox', 'webkit'],
  })

assertOwnerPlans({
  groups: ['main', 'nightly', 'release', 'pr'],
  loadPlan: loadVisualReuseOwnerPlan,
  fixedCells: VISUAL_REUSE_FIXED_CELLS,
  checkDirectCommand: false,
  extraPlanAssert(plan, group) {
    assert.equal(
      plan.runtimeMode,
      'prepared-reuse',
      `${group} runtime mode must be prepared-reuse`,
    )
    for (const cell of plan.cells) {
      assert.equal(
        cell.dimensions.browser,
        'chromium',
        `${cell.id} must be Chromium only`,
      )
    }
  },
})

const workflowFailures = validateReuseWorkflow(reusableWorkflow)
assert.deepEqual(
  workflowFailures,
  [],
  `_quality-playwright.yml visual-runtime-reuse policy failures: ${workflowFailures.join('; ')}`,
)

assertMissingCellRejected({
  label: 'missing desktop-light cell must fail policy',
  registry,
  owners,
  suiteId: 'visual-runtime-reuse',
  project: 'desktop-light',
  loadPlan: loadVisualReuseOwnerPlan,
})

assert.ok(
  validateReuseWorkflow(
    reusableWorkflow.replaceAll(
      'playwright install --with-deps chromium',
      'playwright install --with-deps firefox',
    ),
  ).length > 0,
  'workflow with firefox install must be rejected',
)

await import('./test-playwright-visual-reuse-owner.mjs')
console.log('[check-playwright-visual-reuse-owner-policy] passed')
