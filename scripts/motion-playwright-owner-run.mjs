#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { loadMotionOwnerPlan } from './motion-playwright-plan.mjs'
import { runMotionCell } from './motion-playwright-runner.mjs'
import {
  loadMotionReceiptsFromDirectory,
  verifyMotionOwnerReceipts,
} from './motion-playwright-verify.mjs'
import { runPlaywrightOwner } from './lib/playwright-owner-core.mjs'

async function main(argv = process.argv.slice(2)) {
  await runPlaywrightOwner({
    argv,
    defaultOwnerId: 'playwright-motion',
    defaultEvidenceDir: '.tmp/playwright-motion',
    loadPlan: (group) => loadMotionOwnerPlan(group),
    executeCells: async ({ ownerId, group, cells, evidenceDir }) => {
      const results = []
      let overallFailed = false
      for (const cell of cells) {
        const result = await runMotionCell(ownerId, cell.id, group, {
          evidenceDir,
        })
        results.push(result)
        if (!result.ok) overallFailed = true
      }
      return { results, overallFailed }
    },
    loadReceipts: loadMotionReceiptsFromDirectory,
    verifyReceipts: ({
      ownerId,
      group,
      receipts,
      selectedPlan,
      evidenceDir,
      commitSha,
    }) =>
      verifyMotionOwnerReceipts(ownerId, group, receipts, selectedPlan, {
        evidenceDir,
        expectedCommitSha: commitSha || undefined,
      }),
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
