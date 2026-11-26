#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlanIsolation,
} from './layout-playwright-plan.mjs'
import { runCell } from './layout-playwright-runner.mjs'
import {
  loadReceiptsFromDirectory,
  verifyOwnerReceipts,
} from './layout-playwright-verify.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'
import {
  fail,
  hasFlag,
  option,
  runPlaywrightOwner,
  runVisualRuntimePrepare,
  withSpawnedServer,
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
    loadPlan: (group, ownerId) => {
      const plan = planOwnerCells(
        ownerId,
        group,
        loadPlaywrightSuiteRegistry(),
        loadPlaywrightOwners(),
      )
      if (group === 'main' || group === 'nightly' || group === 'release') {
        assertOwnerFixedCells(plan, [...DEFAULT_CELLS])
      }
      const isolation = validatePlanIsolation(plan)
      if (isolation.length > 0) {
        fail(`owner plan isolation failed: ${isolation.join('; ')}`)
      }
      return plan
    },
    executeCells: async ({ ownerId, group, cells, evidenceDir }) => {
      if (!hasFlag(argv, 'skip-prepare')) {
        runVisualRuntimePrepare(runtimeDir, { logPrefix: 'playwright-layout' })
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
            const result = await runCell(ownerId, cell.id, group, {
              runtimeDir,
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
    loadReceipts: loadReceiptsFromDirectory,
    verifyReceipts: ({ ownerId, group, receipts, selectedPlan, commitSha }) =>
      verifyOwnerReceipts(ownerId, group, receipts, selectedPlan, {
        runtimeManifestPath: `${runtimeDir}/manifest.json`,
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
