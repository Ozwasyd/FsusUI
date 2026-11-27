#!/usr/bin/env node

import { BOUNDARY_FIXED_CELLS } from './boundary-playwright-plan.mjs'
import { runBoundaryCell } from './boundary-playwright-runner.mjs'
import {
  loadBoundaryReceiptsFromDirectory,
  verifyBoundaryOwnerReceipts,
} from './boundary-playwright-verify.mjs'
import {
  loadOwnerRunPlan,
  option,
  prepareOwnerVisualRuntime,
  runPlaywrightCli,
  runPlaywrightOwner,
  runPreparedVisualCells,
} from './lib/playwright-owner-core.mjs'

async function main(argv = process.argv.slice(2)) {
  const runtimeDir = option(
    argv,
    'runtime-dir',
    '.tmp/visual-runtime-playwright',
  )
  const serverPort = Number(option(argv, 'server-port', '4181'))

  await runPlaywrightOwner({
    argv,
    defaultOwnerId: 'playwright-boundary',
    defaultEvidenceDir: '.tmp/playwright-boundary',
    loadPlan: (group, ownerId) =>
      loadOwnerRunPlan(
        ownerId,
        group,
        BOUNDARY_FIXED_CELLS,
        'boundary owner plan isolation failed',
      ),
    executeCells: (context) => {
      prepareOwnerVisualRuntime(argv, runtimeDir, 'playwright-boundary')
      return runPreparedVisualCells(
        runtimeDir,
        serverPort,
        context,
        runBoundaryCell,
      )
    },
    loadReceipts: loadBoundaryReceiptsFromDirectory,
    verifyReceipts: verifyBoundaryOwnerReceipts,
    buildEvidenceExtra: () => ({
      runtimeManifest: `${runtimeDir}/manifest.json`,
    }),
  })
}

await runPlaywrightCli(import.meta.url, main)
