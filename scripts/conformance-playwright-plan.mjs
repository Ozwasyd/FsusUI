#!/usr/bin/env node

import {
  createFixedOwnerPlanLoader,
  runOwnerPlanCli,
  runPlaywrightCli,
} from './lib/playwright-owner-core.mjs'

export const CONFORMANCE_OWNER = 'playwright-conformance'

export const CONFORMANCE_FIXED_CELLS = Object.freeze([
  'web-interaction-conformance/chromium',
  'web-interaction-conformance/firefox',
  'web-interaction-conformance/webkit',
])

export const CONFORMANCE_FIXED_NAMESPACES = Object.freeze({
  'web-interaction-conformance/chromium': 'playwright-conformance-chromium',
  'web-interaction-conformance/firefox': 'playwright-conformance-firefox',
  'web-interaction-conformance/webkit': 'playwright-conformance-webkit',
})

export const loadConformanceOwnerPlan = createFixedOwnerPlanLoader({
  ownerId: CONFORMANCE_OWNER,
  fixedCells: CONFORMANCE_FIXED_CELLS,
  label: 'conformance',
})

runPlaywrightCli(import.meta.url, () =>
  runOwnerPlanCli({
    loadOwnerPlan: loadConformanceOwnerPlan,
    scriptName: 'conformance-playwright-plan.mjs',
    label: 'conformance',
  }),
)
