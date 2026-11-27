#!/usr/bin/env node

import { loadMarkdownOwnerPlan } from './markdown-playwright-plan.mjs'
import {
  loadReceiptsFromDirectory,
  runOwnerVerifyCli,
  runPlaywrightCli,
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
    extraReceiptCheck: options.validateReceipt,
  })
}

await runPlaywrightCli(import.meta.url, () =>
  runOwnerVerifyCli({
    usage:
      'Usage: markdown-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--evidence-dir <dir>] [--commit-sha <sha>] [--evidence-out <path>]',
    logPrefix: 'playwright-markdown',
    loadPlan: (group) => loadMarkdownOwnerPlan(group),
    loadReceipts: loadMarkdownReceiptsFromDirectory,
    verifyReceipts: verifyMarkdownOwnerReceipts,
  }),
)
