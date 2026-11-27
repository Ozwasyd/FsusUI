#!/usr/bin/env node

import {
  createFixedOwnerPlanLoader,
  option,
  runOwnerPlanCli,
  runPlaywrightCli,
} from './lib/playwright-owner-core.mjs'

export const BOUNDARY_OWNER = 'playwright-boundary'

export const BOUNDARY_FIXED_CELLS = Object.freeze([
  'visual-boundary-audit/desktop-light',
  'visual-boundary-audit/mobile-light',
  'visual-boundary-audit/tiny-light',
  'visual-boundary-audit/desktop-dark',
  'visual-boundary-audit/mobile-dark',
  'visual-boundary-audit/tiny-dark',
  'visual-boundary-audit/safe-area-chromium',
  'visual-boundary-audit/safe-area-webkit',
])

export const BOUNDARY_FIXED_NAMESPACES = Object.freeze({
  'visual-boundary-audit/desktop-light': 'playwright-boundary-desktop-light',
  'visual-boundary-audit/mobile-light': 'playwright-boundary-mobile-light',
  'visual-boundary-audit/tiny-light': 'playwright-boundary-tiny-light',
  'visual-boundary-audit/desktop-dark': 'playwright-boundary-desktop-dark',
  'visual-boundary-audit/mobile-dark': 'playwright-boundary-mobile-dark',
  'visual-boundary-audit/tiny-dark': 'playwright-boundary-tiny-dark',
  'visual-boundary-audit/safe-area-chromium':
    'playwright-boundary-safe-area-chromium',
  'visual-boundary-audit/safe-area-webkit':
    'playwright-boundary-safe-area-webkit',
})

export const loadBoundaryOwnerPlan = createFixedOwnerPlanLoader({
  ownerId: BOUNDARY_OWNER,
  fixedCells: BOUNDARY_FIXED_CELLS,
  label: 'boundary',
})

runPlaywrightCli(import.meta.url, () =>
  runOwnerPlanCli({
    loadOwnerPlan: loadBoundaryOwnerPlan,
    scriptName: 'boundary-playwright-plan.mjs',
    label: 'boundary',
    formatCellCommand: (cell, argv) =>
      `FSUS_BOUNDARY_AUDIT_PORT=${option(argv, 'port', '4181')} ${cell.command}`,
  }),
)
