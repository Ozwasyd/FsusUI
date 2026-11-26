#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { loadPlaywrightOwners, planOwnerCells } from './layout-playwright-plan.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'
import {
  loadReceiptsFromDirectory,
  option,
  runOwnerVerifyCli,
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
    validateCellReceiptFn: validateCellReceipt,
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await runOwnerVerifyCli({
      usage:
        'Usage: layout-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--runtime-manifest <path>] [--commit-sha <sha>] [--evidence-out <path>]',
      logPrefix: 'playwright-layout',
      loadPlan: (group, ownerId) =>
        planOwnerCells(
          ownerId,
          group,
          loadPlaywrightSuiteRegistry(),
          loadPlaywrightOwners(),
        ),
      loadReceipts: (dir) => loadReceiptsFromDirectory(dir),
      verifyReceipts: (ownerId, group, receipts, plan, argv) =>
        verifyOwnerReceipts(ownerId, group, receipts, plan, {
          runtimeManifestPath: option(argv, 'runtime-manifest'),
          expectedCommitSha: option(argv, 'commit-sha'),
        }),
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
