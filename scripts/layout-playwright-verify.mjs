#!/usr/bin/env node

import { planOwnerCells } from './layout-playwright-plan.mjs'
import {
  loadReceiptsFromDirectory,
  option,
  runOwnerVerifyCli,
  runPlaywrightCli,
  sha256File,
  validateCellReceipt,
  verifyOwnerReceiptsCore,
} from './lib/playwright-owner-core.mjs'

export { loadReceiptsFromDirectory, sha256File, validateCellReceipt }

export function verifyOwnerReceipts(
  ownerId,
  group,
  receipts,
  plan,
  options = {},
) {
  return verifyOwnerReceiptsCore({
    ownerId,
    group,
    receipts,
    plan,
    logPrefix: 'playwright-layout',
    expectedCommitSha: options.expectedCommitSha,
    resolveRuntimeManifestPath: () => options.runtimeManifestPath ?? null,
  })
}

await runPlaywrightCli(import.meta.url, () =>
  runOwnerVerifyCli({
    usage:
      'Usage: layout-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--runtime-manifest <path>] [--commit-sha <sha>] [--evidence-out <path>]',
    logPrefix: 'playwright-layout',
    loadPlan: (group, ownerId) => planOwnerCells(ownerId, group),
    loadReceipts: loadReceiptsFromDirectory,
    verifyReceipts: verifyOwnerReceipts,
    readVerifyOptions: (argv) => ({
      runtimeManifestPath: option(argv, 'runtime-manifest'),
    }),
  }),
)
