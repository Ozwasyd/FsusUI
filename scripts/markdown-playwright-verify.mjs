#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { loadMarkdownOwnerPlan } from './markdown-playwright-plan.mjs'
import {
  loadReceiptsFromDirectory,
  option,
  runOwnerVerifyCli,
  validateCellReceipt,
  verifyOwnerReceiptsCore,
} from './lib/playwright-owner-core.mjs'

export const loadMarkdownReceiptsFromDirectory = (directory) =>
  loadReceiptsFromDirectory(directory)

export async function verifyMarkdownOwnerReceipts(
  ownerId,
  group,
  receipts,
  plan,
  options = {},
) {
  const evidenceDir = options.evidenceDir ?? '.tmp/playwright-markdown'
  return verifyOwnerReceiptsCore({
    ownerId,
    group,
    receipts,
    plan,
    logPrefix: options.logPrefix ?? 'playwright-markdown',
    expectedRuntimeMode: 'native',
    expectedCommitSha: options.expectedCommitSha,
    resolveRuntimeManifestPath: (cell) =>
      `${evidenceDir}/runtime-manifests/${options.runtimeManifestId?.(cell) ?? cell.suiteId}.json`,
    checkFingerprintInputs: true,
    validateCellReceiptFn: validateCellReceipt,
    extraReceiptCheck: options.validateReceipt,
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await runOwnerVerifyCli({
      usage:
        'Usage: markdown-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--evidence-dir <dir>] [--commit-sha <sha>] [--evidence-out <path>]',
      logPrefix: 'playwright-markdown',
      loadPlan: (group) => loadMarkdownOwnerPlan(group),
      loadReceipts: loadMarkdownReceiptsFromDirectory,
      verifyReceipts: (ownerId, group, receipts, plan, argv) =>
        verifyMarkdownOwnerReceipts(ownerId, group, receipts, plan, {
          evidenceDir: option(argv, 'evidence-dir'),
          expectedCommitSha: option(argv, 'commit-sha'),
        }),
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
