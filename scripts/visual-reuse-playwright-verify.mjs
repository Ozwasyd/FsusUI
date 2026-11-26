#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { loadVisualReuseOwnerPlan } from './visual-reuse-playwright-plan.mjs'
import {
  loadReceiptsFromDirectory,
  option,
  runOwnerVerifyCli,
  validateCellReceipt,
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
    validateCellReceiptFn: validateCellReceipt,
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await runOwnerVerifyCli({
      usage:
        'Usage: visual-reuse-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--runtime-dir <dir>] [--commit-sha <sha>] [--evidence-out <path>]',
      logPrefix: 'visual-runtime-reuse',
      loadPlan: (group) => loadVisualReuseOwnerPlan(group),
      loadReceipts: loadVisualReuseReceiptsFromDirectory,
      verifyReceipts: (ownerId, group, receipts, plan, argv) =>
        verifyVisualReuseOwnerReceipts(ownerId, group, receipts, plan, {
          runtimeDir: option(argv, 'runtime-dir'),
          expectedCommitSha: option(argv, 'commit-sha'),
        }),
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
