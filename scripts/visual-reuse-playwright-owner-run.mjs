#!/usr/bin/env node

import { resolve } from 'node:path'
import { loadVisualReuseOwnerPlan } from './visual-reuse-playwright-plan.mjs'
import { runVisualReuseCell } from './visual-reuse-playwright-runner.mjs'
import {
  loadVisualReuseReceiptsFromDirectory,
  verifyVisualReuseOwnerReceipts,
} from './visual-reuse-playwright-verify.mjs'
import {
  option,
  prepareOwnerVisualRuntime,
  repoRoot,
  runPlaywrightCli,
  runPlaywrightOwner,
  runPreparedVisualCells,
  sha256File,
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
    executeCells: async (context) => {
      prepareOwnerVisualRuntime(argv, runtimeDir, 'visual-runtime-reuse', {
        logCheck: true,
      })
      const manifestAbsPath = resolve(repoRoot, runtimeDir, 'manifest.json')
      const beforeManifestDigest = sha256File(manifestAbsPath)

      const { results, overallFailed: cellFailed } =
        await runPreparedVisualCells(
          runtimeDir,
          serverPort,
          context,
          runVisualReuseCell,
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
    verifyReceipts: verifyVisualReuseOwnerReceipts,
    verifyOptions: { runtimeDir },
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

await runPlaywrightCli(import.meta.url, main)
