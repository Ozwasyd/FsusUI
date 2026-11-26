#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import {
  createFixedOwnerPlanLoader,
  runOwnerPlanCli,
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    runOwnerPlanCli({
      loadOwnerPlan: loadMotionOwnerPlan,
      scriptName: 'motion-playwright-plan.mjs',
      label: 'motion',
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
