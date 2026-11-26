#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
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
  buildDemoOnce,
  option,
  runCellsWithConcurrency,
  runPlaywrightOwner,
  withSpawnedServer,
} from './lib/playwright-owner-core.mjs'

async function main(argv = process.argv.slice(2)) {
  const serverPort = Number(
    option(argv, 'server-port', process.env.FSUS_MARKDOWN_EDITOR_PORT ?? '5191'),
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
      buildDemoOnce()
      const concurrency =
        Number(process.env.FSUS_PLAYWRIGHT_CELL_CONCURRENCY) || 3
      return withSpawnedServer(
        {
          command: 'pnpm',
          args: [
            '-C',
            'vue/packages/demo-app',
            'exec',
            'vite',
            'preview',
            '--host',
            '127.0.0.1',
            '--port',
            String(serverPort),
            '--strictPort',
          ],
          serverUrl: `http://127.0.0.1:${serverPort}`,
        },
        () =>
          runCellsWithConcurrency(cells, concurrency, (cell) =>
            runMarkdownCell(ownerId, cell.id, group, {
              evidenceDir,
              externalServer: true,
              precomputedRuntime: runtimeBySuite.get(cell.suiteId),
              envOverrides: {
                FSUS_MARKDOWN_EDITOR_PORT: String(serverPort),
              },
            }),
          ),
      )
    },
    loadReceipts: loadMarkdownReceiptsFromDirectory,
    verifyReceipts: ({
      ownerId,
      group,
      receipts,
      selectedPlan,
      evidenceDir,
      commitSha,
    }) =>
      verifyMarkdownOwnerReceipts(ownerId, group, receipts, selectedPlan, {
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
