#!/usr/bin/env node

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
  option,
  repoRoot,
  runDemoPreviewCells,
  runPlaywrightCli,
  runPlaywrightOwner,
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
        group === 'pr'
          ? loadPlaywrightImpactPlan(repoRoot, impactPlanPath)
          : null
      const precomputedRuntime = await computeMarkdownCellRuntime(
        cells[0],
        CONFORMANCE_FINGERPRINT_INPUTS,
      )
      return runDemoPreviewCells(serverPort, cells, (cell) =>
        runConformanceCell(ownerId, cell.id, group, {
          evidenceDir,
          impactPlan,
          externalServer: true,
          precomputedRuntime,
          envOverrides: {
            FSUS_CONFORMANCE_INTERACTION_PORT: String(serverPort),
          },
        }),
      )
    },
    loadReceipts: loadConformanceReceiptsFromDirectory,
    verifyReceipts: verifyConformanceOwnerReceipts,
  })
}

await runPlaywrightCli(import.meta.url, runConformanceOwner)
