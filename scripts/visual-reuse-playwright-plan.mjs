#!/usr/bin/env node

import {
  createFixedOwnerPlanLoader,
  runOwnerPlanCli,
  runPlaywrightCli,
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

runPlaywrightCli(import.meta.url, () =>
  runOwnerPlanCli({
    loadOwnerPlan: loadVisualReuseOwnerPlan,
    scriptName: 'visual-reuse-playwright-plan.mjs',
    label: 'visual-reuse',
  }),
)
