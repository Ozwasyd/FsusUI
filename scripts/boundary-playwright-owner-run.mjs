#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlanIsolation,
} from './layout-playwright-plan.mjs'
import { BOUNDARY_FIXED_CELLS } from './boundary-playwright-plan.mjs'
import { runBoundaryCell } from './boundary-playwright-runner.mjs'
import {
  loadBoundaryReceiptsFromDirectory,
  verifyBoundaryOwnerReceipts,
} from './boundary-playwright-verify.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'
import {
  fail,
  hasFlag,
  option,
  runPlaywrightOwner,
  runVisualRuntimePrepare,
  withSpawnedServer,
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
    loadPlan: (group, ownerId) => {
      const plan = planOwnerCells(
        ownerId,
        group,
        loadPlaywrightSuiteRegistry(),
        loadPlaywrightOwners(),
      )
      if (group === 'main' || group === 'nightly' || group === 'release') {
        assertOwnerFixedCells(plan, [...BOUNDARY_FIXED_CELLS])
      }
      const isolation = validatePlanIsolation(plan)
      if (isolation.length > 0) {
        fail(`boundary owner plan isolation failed: ${isolation.join('; ')}`)
      }
      return plan
    },
    executeCells: async ({ ownerId, group, cells, evidenceDir }) => {
      if (!hasFlag(argv, 'skip-prepare')) {
        runVisualRuntimePrepare(runtimeDir, {
          logPrefix: 'playwright-boundary',
        })
      }
      runVisualRuntimePrepare(runtimeDir, { checkOnly: true })
      const serverUrl = `http://127.0.0.1:${serverPort}`
      return withSpawnedServer(
        {
          command: process.execPath,
          args: [
            'scripts/serve-visual-runtime.mjs',
            '--suite=preview',
            '--host=127.0.0.1',
            `--port=${serverPort}`,
            `--runtime-dir=${runtimeDir}`,
          ],
          serverUrl,
        },
        async () => {
          const results = []
          let overallFailed = false
          for (const cell of cells) {
            const result = await runBoundaryCell(ownerId, cell.id, group, {
              evidenceDir,
              serverUrl,
            })
            results.push(result)
            if (!result.ok) overallFailed = true
          }
          return { results, overallFailed }
        },
      )
    },
    loadReceipts: loadBoundaryReceiptsFromDirectory,
    verifyReceipts: ({
      ownerId,
      group,
      receipts,
      selectedPlan,
      evidenceDir,
      commitSha,
    }) =>
      verifyBoundaryOwnerReceipts(ownerId, group, receipts, selectedPlan, {
        evidenceDir,
        expectedCommitSha: commitSha || undefined,
      }),
    buildEvidenceExtra: () => ({
      runtimeManifest: `${runtimeDir}/manifest.json`,
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
