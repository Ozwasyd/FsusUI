#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import {
  createFixedOwnerPlanLoader,
  runOwnerPlanCli,
} from './lib/playwright-owner-core.mjs'

export const VISUAL_REUSE_OWNER = 'visual-runtime-reuse'

export const VISUAL_REUSE_FIXED_CELLS = Object.freeze([
  'visual-runtime-reuse/desktop-light',
  'visual-runtime-reuse/mobile-light',
  'visual-runtime-reuse/desktop-dark',
  'visual-runtime-reuse/mobile-dark',
])

export const loadVisualReuseOwnerPlan = createFixedOwnerPlanLoader({
  ownerId: VISUAL_REUSE_OWNER,
  fixedCells: VISUAL_REUSE_FIXED_CELLS,
  label: 'visual-reuse',
  enforcePrFixedCells: true,
})

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    runOwnerPlanCli({
      loadOwnerPlan: loadVisualReuseOwnerPlan,
      scriptName: 'visual-reuse-playwright-plan.mjs',
      label: 'visual-reuse',
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
