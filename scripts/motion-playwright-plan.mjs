#!/usr/bin/env node

import {
  createFixedOwnerPlanLoader,
  runOwnerPlanCli,
  runPlaywrightCli,
} from './lib/playwright-owner-core.mjs'

export const MOTION_OWNER = 'playwright-motion'

export const MOTION_FIXED_CELLS = Object.freeze([
  'view-transitions/chromium',
  'view-transitions/firefox',
  'view-transitions/webkit',
  'motion-ssr/chromium',
])

export const MOTION_FIXED_NAMESPACES = Object.freeze({
  'view-transitions/chromium': 'playwright-motion-view-transitions-chromium',
  'view-transitions/firefox': 'playwright-motion-view-transitions-firefox',
  'view-transitions/webkit': 'playwright-motion-view-transitions-webkit',
  'motion-ssr/chromium': 'playwright-motion-motion-ssr-chromium',
})

export const loadMotionOwnerPlan = createFixedOwnerPlanLoader({
  ownerId: MOTION_OWNER,
  fixedCells: MOTION_FIXED_CELLS,
  label: 'motion',
})

runPlaywrightCli(import.meta.url, () =>
  runOwnerPlanCli({
    loadOwnerPlan: loadMotionOwnerPlan,
    scriptName: 'motion-playwright-plan.mjs',
    label: 'motion',
  }),
)
