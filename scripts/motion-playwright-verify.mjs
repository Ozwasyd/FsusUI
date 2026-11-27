#!/usr/bin/env node

import { loadMotionOwnerPlan } from './motion-playwright-plan.mjs'
import {
  loadReceiptsFromDirectory,
  runOwnerVerifyCli,
  runPlaywrightCli,
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
  })
}

await runPlaywrightCli(import.meta.url, () =>
  runOwnerVerifyCli({
    usage:
      'Usage: motion-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--evidence-dir <dir>] [--commit-sha <sha>] [--evidence-out <path>]',
    logPrefix: 'playwright-motion',
    loadPlan: (group) => loadMotionOwnerPlan(group),
    loadReceipts: loadMotionReceiptsFromDirectory,
    verifyReceipts: verifyMotionOwnerReceipts,
  }),
)
