#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { loadConformanceOwnerPlan } from './conformance-playwright-plan.mjs'
import {
  CONFORMANCE_FINGERPRINT_INPUTS,
  runConformanceCell,
} from './conformance-playwright-runner.mjs'
import { computeMarkdownCellRuntime } from './markdown-playwright-runner.mjs'
import {
  loadConformanceReceiptsFromDirectory,
  verifyConformanceOwnerReceipts,
} from './conformance-playwright-verify.mjs'
import { loadPlaywrightImpactPlan } from './playwright-impact-filter.mjs'
import {
  buildDemoOnce,
  option,
  repoRoot,
  runCellsWithConcurrency,
  runPlaywrightOwner,
  withSpawnedServer,
} from './lib/playwright-owner-core.mjs'

export async function runConformanceOwner(argv = process.argv.slice(2)) {
  const serverPort = Number(
    option(
      argv,
      'server-port',
      process.env.FSUS_CONFORMANCE_INTERACTION_PORT ?? '5192',
    ),
  )

  return runPlaywrightOwner({
    argv,
    defaultOwnerId: 'playwright-conformance',
    defaultEvidenceDir: '.tmp/playwright-conformance',
    includeStatusInEvidence: true,
    loadPlan: (group) => loadConformanceOwnerPlan(group),
    executeCells: async ({
      ownerId,
      group,
      cells,
      evidenceDir,
      impactPlanPath,
    }) => {
      const impactPlan =
        group === 'pr' ? loadPlaywrightImpactPlan(repoRoot, impactPlanPath) : null
      const precomputedRuntime = await computeMarkdownCellRuntime(
        cells[0],
        CONFORMANCE_FINGERPRINT_INPUTS,
      )
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
            runConformanceCell(ownerId, cell.id, group, {
              evidenceDir,
              impactPlan,
              externalServer: true,
              precomputedRuntime,
              envOverrides: {
                FSUS_CONFORMANCE_INTERACTION_PORT: String(serverPort),
              },
            }),
          ),
      )
    },
    loadReceipts: loadConformanceReceiptsFromDirectory,
    verifyReceipts: ({
      ownerId,
      group,
      receipts,
      selectedPlan,
      evidenceDir,
      commitSha,
    }) =>
      verifyConformanceOwnerReceipts(ownerId, group, receipts, selectedPlan, {
        evidenceDir,
        expectedCommitSha: commitSha || undefined,
      }),
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await runConformanceOwner()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
