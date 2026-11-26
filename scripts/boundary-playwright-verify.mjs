#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { loadBoundaryOwnerPlan } from './boundary-playwright-plan.mjs'
import {
  fail,
  loadReceiptsFromDirectory,
  option,
  runOwnerVerifyCli,
  validateCellReceipt,
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
    validateCellReceiptFn: validateCellReceipt,
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await runOwnerVerifyCli({
      usage:
        'Usage: boundary-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--evidence-dir <dir>] [--commit-sha <sha>] [--evidence-out <path>]',
      logPrefix: 'playwright-boundary',
      loadPlan: (group) => loadBoundaryOwnerPlan(group),
      loadReceipts: loadBoundaryReceiptsFromDirectory,
      verifyReceipts: (ownerId, group, receipts, plan, argv) =>
        verifyBoundaryOwnerReceipts(ownerId, group, receipts, plan, {
          evidenceDir: option(argv, 'evidence-dir'),
          expectedCommitSha: option(argv, 'commit-sha'),
        }),
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
