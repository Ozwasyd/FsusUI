#!/usr/bin/env node

import { loadBoundaryOwnerPlan } from './boundary-playwright-plan.mjs'
import {
  fail,
  loadReceiptsFromDirectory,
  runOwnerVerifyCli,
  runPlaywrightCli,
  verifyOwnerReceiptsCore,
} from './lib/playwright-owner-core.mjs'

export const loadBoundaryReceiptsFromDirectory = (directory) =>
  loadReceiptsFromDirectory(directory)

export async function verifyBoundaryOwnerReceipts(
  ownerId,
  group,
  receipts,
  plan,
  options = {},
) {
  const evidenceDir = options.evidenceDir ?? '.tmp/playwright-boundary'
  return verifyOwnerReceiptsCore({
    ownerId,
    group,
    receipts,
    plan,
    logPrefix: 'playwright-boundary',
    expectedRuntimeMode: 'prepared-preview',
    expectedCommitSha: options.expectedCommitSha,
    resolveRuntimeManifestPath: (cell) =>
      `${evidenceDir}/runtime-manifests/${cell.suiteId}.json`,
    extraReceiptCheck: (receipt, cell) => {
      if (
        cell.project.startsWith('safe-area') &&
        cell.project.includes('webkit') &&
        receipt.dimensions?.browser !== 'webkit'
      ) {
        fail(`receipt ${cell.id} safe-area-webkit must bind browser=webkit`)
      }
    },
  })
}

await runPlaywrightCli(import.meta.url, () =>
  runOwnerVerifyCli({
    usage:
      'Usage: boundary-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--evidence-dir <dir>] [--commit-sha <sha>] [--evidence-out <path>]',
    logPrefix: 'playwright-boundary',
    loadPlan: (group) => loadBoundaryOwnerPlan(group),
    loadReceipts: loadBoundaryReceiptsFromDirectory,
    verifyReceipts: verifyBoundaryOwnerReceipts,
  }),
)
