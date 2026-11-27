#!/usr/bin/env node

import { loadMarkdownOwnerPlan } from './markdown-playwright-plan.mjs'
import {
  computeMarkdownCellRuntime,
  runMarkdownCell,
  writeMarkdownCellRuntimeManifest,
} from './markdown-playwright-runner.mjs'
import {
  loadMarkdownReceiptsFromDirectory,
  verifyMarkdownOwnerReceipts,
} from './markdown-playwright-verify.mjs'
import {
  option,
  runDemoPreviewCells,
  runPlaywrightCli,
  runPlaywrightOwner,
} from './lib/playwright-owner-core.mjs'

async function main(argv = process.argv.slice(2)) {
  const serverPort = Number(
    option(
      argv,
      'server-port',
      process.env.FSUS_MARKDOWN_EDITOR_PORT ?? '5191',
    ),
  )

  await runPlaywrightOwner({
    argv,
    defaultOwnerId: 'playwright-markdown',
    defaultEvidenceDir: '.tmp/playwright-markdown',
    loadPlan: (group) => loadMarkdownOwnerPlan(group),
    executeCells: async ({ ownerId, group, cells, evidenceDir }) => {
      const runtimeBySuite = new Map()
      for (const cell of cells) {
        if (!runtimeBySuite.has(cell.suiteId)) {
          const computed = await computeMarkdownCellRuntime(cell)
          runtimeBySuite.set(
            cell.suiteId,
            writeMarkdownCellRuntimeManifest(cell, evidenceDir, computed),
          )
        }
      }
      return runDemoPreviewCells(serverPort, cells, (cell) =>
        runMarkdownCell(ownerId, cell.id, group, {
          evidenceDir,
          externalServer: true,
          precomputedRuntime: runtimeBySuite.get(cell.suiteId),
          envOverrides: {
            FSUS_MARKDOWN_EDITOR_PORT: String(serverPort),
          },
        }),
      )
    },
    loadReceipts: loadMarkdownReceiptsFromDirectory,
    verifyReceipts: verifyMarkdownOwnerReceipts,
  })
}

await runPlaywrightCli(import.meta.url, main)
