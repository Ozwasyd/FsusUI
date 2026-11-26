#!/usr/bin/env node

import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadVisualReuseOwnerPlan } from './visual-reuse-playwright-plan.mjs'
import { runVisualReuseCell } from './visual-reuse-playwright-runner.mjs'
import {
  loadVisualReuseReceiptsFromDirectory,
  verifyVisualReuseOwnerReceipts,
} from './visual-reuse-playwright-verify.mjs'
import {
  hasFlag,
  option,
  repoRoot,
  runPlaywrightOwner,
  runVisualRuntimePrepare,
  sha256File,
  withSpawnedServer,
} from './lib/playwright-owner-core.mjs'

async function main(argv = process.argv.slice(2)) {
  const runtimeDir = option(
    argv,
    'runtime-dir',
    '.tmp/visual-runtime-reuse-runtime',
  )
  const serverPort = Number(option(argv, 'server-port', '4182'))

  await runPlaywrightOwner({
    argv,
    defaultOwnerId: 'visual-runtime-reuse',
    defaultEvidenceDir: '.tmp/visual-runtime-reuse',
    loadPlan: (group) => loadVisualReuseOwnerPlan(group),
    executeCells: async ({ ownerId, group, cells, evidenceDir }) => {
      if (!hasFlag(argv, 'skip-prepare')) {
        runVisualRuntimePrepare(runtimeDir, {
          logPrefix: 'visual-runtime-reuse',
        })
      }
      runVisualRuntimePrepare(runtimeDir, {
        checkOnly: true,
        logPrefix: 'visual-runtime-reuse',
      })
      const manifestAbsPath = resolve(repoRoot, runtimeDir, 'manifest.json')
      const beforeManifestDigest = sha256File(manifestAbsPath)
      const serverUrl = `http://127.0.0.1:${serverPort}`

      const { results, overallFailed: cellFailed } = await withSpawnedServer(
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
          const cellResults = []
          let failedAny = false
          for (const cell of cells) {
            const result = await runVisualReuseCell(ownerId, cell.id, group, {
              runtimeDir,
              evidenceDir,
              serverUrl,
            })
            cellResults.push(result)
            if (!result.ok) failedAny = true
          }
          return { results: cellResults, overallFailed: failedAny }
        },
      )

      const afterManifestDigest = sha256File(manifestAbsPath)
      let overallFailed = cellFailed
      if (afterManifestDigest !== beforeManifestDigest) {
        overallFailed = true
        console.error(
          `[visual-runtime-reuse] RUNTIME INTEGRITY FAILURE: manifest digest changed during suite execution (before=${beforeManifestDigest}, after=${afterManifestDigest})`,
        )
      }
      return {
        results,
        overallFailed,
        beforeManifestDigest,
        afterManifestDigest,
      }
    },
    loadReceipts: loadVisualReuseReceiptsFromDirectory,
    verifyReceipts: ({ ownerId, group, receipts, selectedPlan, commitSha }) =>
      verifyVisualReuseOwnerReceipts(ownerId, group, receipts, selectedPlan, {
        runtimeDir,
        expectedCommitSha: commitSha || undefined,
      }),
    buildEvidenceExtra: ({ execution }) => ({
      runtimeIntegrity: {
        beforeManifestDigest: execution.beforeManifestDigest,
        afterManifestDigest: execution.afterManifestDigest,
        manifestIdentical:
          execution.beforeManifestDigest === execution.afterManifestDigest,
      },
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
