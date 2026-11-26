#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  MARKDOWN_FIXED_CELLS,
  MARKDOWN_FIXED_NAMESPACES,
  MARKDOWN_OWNER,
  loadMarkdownOwnerPlan,
} from './markdown-playwright-plan.mjs'
import {
  assertMissingCellRejected,
  assertOwnerPlans,
  assertTopWorkflowPlaywrightJobs,
  loadPlaywrightPolicyContext,
  validatePlaywrightOwnerWorkflow,
} from './lib/playwright-owner-policy-core.mjs'

const { registry, owners, reusableWorkflow, topWorkflow } =
  loadPlaywrightPolicyContext()

assertOwnerPlans({
  loadPlan: loadMarkdownOwnerPlan,
  fixedCells: MARKDOWN_FIXED_CELLS,
  fixedNamespaces: MARKDOWN_FIXED_NAMESPACES,
})

const workflowFailures = validatePlaywrightOwnerWorkflow(reusableWorkflow, {
  jobName: 'playwright-markdown',
  ownerScript: 'markdown-playwright-owner-run.mjs',
  forbiddenCommands: ['pnpm test:markdown-editor:interaction'],
  requiredBrowsers: ['chromium', 'firefox', 'webkit'],
  requireNonPrGate: true,
})
assert.deepEqual(
  workflowFailures,
  [],
  `_quality-playwright.yml markdown policy failures: ${workflowFailures.join('; ')}`,
)

assertTopWorkflowPlaywrightJobs(topWorkflow)

for (const project of ['firefox', 'webkit']) {
  assertMissingCellRejected({
    label: `missing ${project} cell must fail policy`,
    registry,
    owners,
    owner: MARKDOWN_OWNER,
    suiteId: 'markdown-editor-interaction',
    project,
    fixedCells: MARKDOWN_FIXED_CELLS,
  })
}

console.log('[check-playwright-markdown-owner-policy] passed')
