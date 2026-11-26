#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  BOUNDARY_FIXED_CELLS,
  BOUNDARY_FIXED_NAMESPACES,
  BOUNDARY_OWNER,
  loadBoundaryOwnerPlan,
} from './boundary-playwright-plan.mjs'
import {
  assertMissingCellRejected,
  assertOwnerPlans,
  assertTopWorkflowPlaywrightJobs,
  loadPlaywrightPolicyContext,
  validatePlaywrightOwnerWorkflow,
} from './lib/playwright-owner-policy-core.mjs'

const { registry, owners, reusableWorkflow, topWorkflow } =
  loadPlaywrightPolicyContext()

const validateBoundaryWorkflow = (source) =>
  validatePlaywrightOwnerWorkflow(source, {
    jobName: 'playwright-boundary',
    ownerScript: 'boundary-playwright-owner-run.mjs',
    forbiddenCommands: ['pnpm audit:visual-boundaries'],
    requiredBrowsers: ['chromium', 'webkit'],
    requireNonPrGate: true,
  })

assertOwnerPlans({
  loadPlan: loadBoundaryOwnerPlan,
  fixedCells: BOUNDARY_FIXED_CELLS,
  fixedNamespaces: BOUNDARY_FIXED_NAMESPACES,
})

const workflowFailures = validateBoundaryWorkflow(reusableWorkflow)
assert.deepEqual(
  workflowFailures,
  [],
  `_quality-playwright.yml boundary policy failures: ${workflowFailures.join('; ')}`,
)

assertTopWorkflowPlaywrightJobs(topWorkflow, { requirePremergePrGroup: true })

for (const project of ['safe-area-webkit', 'tiny-dark']) {
  assertMissingCellRejected({
    label: `missing ${project} cell must fail policy`,
    registry,
    owners,
    owner: BOUNDARY_OWNER,
    suiteId: 'visual-boundary-audit',
    project,
    fixedCells: BOUNDARY_FIXED_CELLS,
  })
}

assert.ok(
  validateBoundaryWorkflow(
    reusableWorkflow.replace(
      'playwright install --with-deps chromium webkit',
      'playwright install --with-deps chromium',
    ),
  ).length > 0,
  'chromium-only boundary workflow fixture must be rejected',
)
assert.ok(
  validateBoundaryWorkflow(
    reusableWorkflow.replace(
      "  playwright-boundary:\n    if: inputs.group != 'pr'",
      '  playwright-boundary:',
    ),
  ).length > 0,
  'unconditional boundary workflow fixture must be rejected',
)

console.log('[check-playwright-boundary-owner-policy] passed')
