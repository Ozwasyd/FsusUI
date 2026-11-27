#!/usr/bin/env node

import { loadMotionOwnerPlan } from './motion-playwright-plan.mjs'
import { runMotionCell } from './motion-playwright-runner.mjs'
import {
  loadMotionReceiptsFromDirectory,
  verifyMotionOwnerReceipts,
} from './motion-playwright-verify.mjs'
import {
  runCellsWithConcurrency,
  runPlaywrightCli,
  runPlaywrightOwner,
} from './lib/playwright-owner-core.mjs'

async function main(argv = process.argv.slice(2)) {
  await runPlaywrightOwner({
    argv,
    defaultOwnerId: 'playwright-motion',
    defaultEvidenceDir: '.tmp/playwright-motion',
    loadPlan: (group) => loadMotionOwnerPlan(group),
    executeCells: ({ ownerId, group, cells, evidenceDir }) =>
      runCellsWithConcurrency(cells, 1, (cell) =>
        runMotionCell(ownerId, cell.id, group, { evidenceDir }),
      ),
    loadReceipts: loadMotionReceiptsFromDirectory,
    verifyReceipts: verifyMotionOwnerReceipts,
  })
}

await runPlaywrightCli(import.meta.url, main)
