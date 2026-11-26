#!/usr/bin/env node

import assert from 'node:assert/strict'
import { planOwnerCells } from './layout-playwright-plan.mjs'
import {
  MOTION_FIXED_CELLS,
  MOTION_FIXED_NAMESPACES,
  MOTION_OWNER,
  loadMotionOwnerPlan,
} from './motion-playwright-plan.mjs'
import {
  assertMissingCellRejected,
  assertOwnerPlans,
  assertTopWorkflowPlaywrightJobs,
  countOccurrences,
  loadPlaywrightPolicyContext,
  validatePlaywrightOwnerWorkflow,
} from './lib/playwright-owner-policy-core.mjs'

const { registry, owners, reusableWorkflow, topWorkflow } =
  loadPlaywrightPolicyContext()

const validateMotionWorkflow = (source) =>
  validatePlaywrightOwnerWorkflow(source, {
    jobName: 'playwright-motion',
    ownerScript: 'motion-playwright-owner-run.mjs',
    forbiddenCommands: [
      'pnpm test:view-transitions',
      'pnpm test:motion:ssr',
    ],
    extraChecks: [
      (job) =>
        countOccurrences(job, 'playwright install --with-deps chromium\n') !== 1
          ? 'playwright-motion job must install Chromium-only for PR runs'
          : null,
      (job) =>
        countOccurrences(
          job,
          'playwright install --with-deps chromium firefox webkit',
        ) !== 1
          ? 'playwright-motion job must install Chromium, Firefox, and WebKit in one step for non-PR groups'
          : null,
      (job) =>
        !/if:\s*inputs\.group != 'pr'\n\s+run:\s*pnpm exec playwright install --with-deps chromium firefox webkit/u.test(
          job,
        )
          ? 'Firefox/WebKit installs must be gated on group != pr'
          : null,
    ],
  })

assertOwnerPlans({
  loadPlan: loadMotionOwnerPlan,
  fixedCells: MOTION_FIXED_CELLS,
  fixedNamespaces: MOTION_FIXED_NAMESPACES,
})

assert.deepEqual(
  planOwnerCells(MOTION_OWNER, 'pr', registry, owners).cells.map(
    (cell) => cell.id,
  ),
  ['motion-ssr/chromium'],
  'PR group must only run motion-ssr/chromium',
)

const workflowFailures = validateMotionWorkflow(reusableWorkflow)
assert.deepEqual(
  workflowFailures,
  [],
  `_quality-playwright.yml motion policy failures: ${workflowFailures.join('; ')}`,
)

assertTopWorkflowPlaywrightJobs(topWorkflow, {
  requirePremergePrGroup: true,
  requirePrResultConsumption: true,
})

assertMissingCellRejected({
  label: 'missing webkit cell must fail policy',
  registry,
  owners,
  owner: MOTION_OWNER,
  suiteId: 'view-transitions',
  project: 'webkit',
  fixedCells: MOTION_FIXED_CELLS,
})

assert.ok(
  validateMotionWorkflow(
    reusableWorkflow.replaceAll(
      'playwright install --with-deps chromium firefox webkit',
      'playwright install --with-deps chromium',
    ),
  ).length > 0,
  'chromium-only workflow fixture must be rejected',
)
assert.ok(
  validateMotionWorkflow(
    reusableWorkflow.replaceAll(
      "        if: inputs.group != 'pr'\n        run: pnpm exec playwright install --with-deps chromium firefox webkit",
      '        run: pnpm exec playwright install --with-deps chromium firefox webkit',
    ),
  ).length > 0,
  'unconditional firefox workflow fixture must be rejected',
)

await import('./test-playwright-motion-owner.mjs')
console.log('[check-playwright-motion-owner-policy] passed')
