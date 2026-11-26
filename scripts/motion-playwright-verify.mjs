#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { loadMotionOwnerPlan } from './motion-playwright-plan.mjs'
import {
  loadReceiptsFromDirectory,
  option,
  runOwnerVerifyCli,
  validateCellReceipt,
  verifyOwnerReceiptsCore,
} from './lib/playwright-owner-core.mjs'

export const loadMotionReceiptsFromDirectory = (directory) =>
  loadReceiptsFromDirectory(directory)

export async function verifyMotionOwnerReceipts(
  ownerId,
  group,
  receipts,
  plan,
  options = {},
) {
  const evidenceDir = options.evidenceDir ?? '.tmp/playwright-motion'
  return verifyOwnerReceiptsCore({
    ownerId,
    group,
    receipts,
    plan,
    logPrefix: 'playwright-motion',
    expectedRuntimeMode: 'native',
    expectedCommitSha: options.expectedCommitSha,
    resolveRuntimeManifestPath: (cell) =>
      `${evidenceDir}/runtime-manifests/${cell.suiteId}.json`,
    checkFingerprintInputs: true,
    validateCellReceiptFn: validateCellReceipt,
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await runOwnerVerifyCli({
      usage:
        'Usage: motion-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--evidence-dir <dir>] [--commit-sha <sha>] [--evidence-out <path>]',
      logPrefix: 'playwright-motion',
      loadPlan: (group) => loadMotionOwnerPlan(group),
      loadReceipts: loadMotionReceiptsFromDirectory,
      verifyReceipts: (ownerId, group, receipts, plan, argv) =>
        verifyMotionOwnerReceipts(ownerId, group, receipts, plan, {
          evidenceDir: option(argv, 'evidence-dir'),
          expectedCommitSha: option(argv, 'commit-sha'),
        }),
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
