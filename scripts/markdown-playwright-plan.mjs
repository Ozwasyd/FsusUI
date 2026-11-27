#!/usr/bin/env node

import {
  createFixedOwnerPlanLoader,
  runOwnerPlanCli,
  runPlaywrightCli,
} from './lib/playwright-owner-core.mjs'

export const MARKDOWN_OWNER = 'playwright-markdown'

export const MARKDOWN_FIXED_CELLS = Object.freeze([
  'markdown-editor-interaction/chromium',
  'markdown-editor-interaction/firefox',
  'markdown-editor-interaction/webkit',
])

export const MARKDOWN_FIXED_NAMESPACES = Object.freeze({
  'markdown-editor-interaction/chromium': 'playwright-markdown-chromium',
  'markdown-editor-interaction/firefox': 'playwright-markdown-firefox',
  'markdown-editor-interaction/webkit': 'playwright-markdown-webkit',
})

export const loadMarkdownOwnerPlan = createFixedOwnerPlanLoader({
  ownerId: MARKDOWN_OWNER,
  fixedCells: MARKDOWN_FIXED_CELLS,
  label: 'markdown',
})

runPlaywrightCli(import.meta.url, () =>
  runOwnerPlanCli({
    loadOwnerPlan: loadMarkdownOwnerPlan,
    scriptName: 'markdown-playwright-plan.mjs',
    label: 'markdown',
  }),
)
