#!/usr/bin/env node

import { runCell } from './layout-playwright-runner.mjs'
import {
  loadReceiptsFromDirectory,
  verifyOwnerReceipts,
} from './layout-playwright-verify.mjs'
import {
  loadOwnerRunPlan,
  option,
  prepareOwnerVisualRuntime,
  runPlaywrightCli,
  runPlaywrightOwner,
  runPreparedVisualCells,
} from './lib/playwright-owner-core.mjs'

const DEFAULT_CELLS = Object.freeze([
  'dom-layout/desktop-light',
  'dom-layout/mobile-light',
  'dom-layout/desktop-dark',
  'dom-layout/mobile-dark',
  'geometry-smoke/chromium',
])

async function main(argv = process.argv.slice(2)) {
  const runtimeDir = option(
    argv,
    'runtime-dir',
    '.tmp/visual-runtime-playwright',
  )
  const serverPort = Number(option(argv, 'server-port', '4181'))

  await runPlaywrightOwner({
    argv,
    defaultOwnerId: 'playwright-layout',
    defaultEvidenceDir: '.tmp/playwright-layout',
    omitRuntimeModeInEvidence: true,
    loadPlan: (group, ownerId) =>
      loadOwnerRunPlan(
        ownerId,
        group,
        DEFAULT_CELLS,
        'owner plan isolation failed',
      ),
    executeCells: (context) => {
      prepareOwnerVisualRuntime(argv, runtimeDir, 'playwright-layout')
      return runPreparedVisualCells(runtimeDir, serverPort, context, runCell)
    },
    loadReceipts: loadReceiptsFromDirectory,
    verifyReceipts: verifyOwnerReceipts,
    verifyOptions: { runtimeManifestPath: `${runtimeDir}/manifest.json` },
    buildEvidenceExtra: () => ({
      runtimeManifest: `${runtimeDir}/manifest.json`,
    }),
  })
}

await runPlaywrightCli(import.meta.url, main)
