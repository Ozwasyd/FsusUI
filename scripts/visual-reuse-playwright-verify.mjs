#!/usr/bin/env node

import { loadVisualReuseOwnerPlan } from './visual-reuse-playwright-plan.mjs'
import {
  loadReceiptsFromDirectory,
  option,
  runOwnerVerifyCli,
  runPlaywrightCli,
  verifyOwnerReceiptsCore,
} from './lib/playwright-owner-core.mjs'

export const loadVisualReuseReceiptsFromDirectory = (directory) =>
  loadReceiptsFromDirectory(directory)

export async function verifyVisualReuseOwnerReceipts(
  ownerId,
  group,
  receipts,
  plan,
  options = {},
) {
  const runtimeDir = options.runtimeDir ?? '.tmp/visual-runtime-reuse-runtime'
  return verifyOwnerReceiptsCore({
    ownerId,
    group,
    receipts,
    plan,
    logPrefix: 'visual-runtime-reuse',
    expectedRuntimeMode: 'prepared-reuse',
    expectedCommitSha: options.expectedCommitSha,
    resolveRuntimeManifestPath: () => `${runtimeDir}/manifest.json`,
  })
}

await runPlaywrightCli(import.meta.url, () =>
  runOwnerVerifyCli({
    usage:
      'Usage: visual-reuse-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--runtime-dir <dir>] [--commit-sha <sha>] [--evidence-out <path>]',
    logPrefix: 'visual-runtime-reuse',
    loadPlan: (group) => loadVisualReuseOwnerPlan(group),
    loadReceipts: loadVisualReuseReceiptsFromDirectory,
    verifyReceipts: verifyVisualReuseOwnerReceipts,
    readVerifyOptions: (argv) => ({ runtimeDir: option(argv, 'runtime-dir') }),
  }),
)
