#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import {
  createFixedOwnerPlanLoader,
  runOwnerPlanCli,
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    runOwnerPlanCli({
      loadOwnerPlan: loadConformanceOwnerPlan,
      scriptName: 'conformance-playwright-plan.mjs',
      label: 'conformance',
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
