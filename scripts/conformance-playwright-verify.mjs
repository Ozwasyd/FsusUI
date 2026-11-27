#!/usr/bin/env node

import { loadConformanceOwnerPlan } from './conformance-playwright-plan.mjs'
import { validateConformanceReceipt } from './conformance-playwright-runner.mjs'
import { verifyMarkdownOwnerReceipts } from './markdown-playwright-verify.mjs'
import {
  loadReceiptsFromDirectory,
  runOwnerVerifyCli,
  runPlaywrightCli,
} from './lib/playwright-owner-core.mjs'

export const loadConformanceReceiptsFromDirectory = (directory) =>
  loadReceiptsFromDirectory(directory, { requireCellId: true })

export async function verifyConformanceOwnerReceipts(
  ownerId,
  group,
  receipts,
  plan,
  options = {},
) {
  const { summary, failed: baseFailed } = await verifyMarkdownOwnerReceipts(
    ownerId,
    group,
    receipts,
    plan,
    {
      ...options,
      evidenceDir: options.evidenceDir ?? '.tmp/playwright-conformance',
      logPrefix: 'playwright-conformance',
      validateReceipt: validateConformanceReceipt,
      runtimeManifestId: (cell) => `${cell.suiteId}-${cell.project}`,
    },
  )
  let failed = baseFailed
  const browsers = receipts.map((receipt) => receipt.dimensions?.browser)
  if (
    receipts.length !== plan.cells.length ||
    new Set(browsers).size !== browsers.length
  ) {
    console.error(
      '[playwright-conformance] browser cell cardinality is missing or duplicated',
    )
    failed = true
  }
  for (const expected of ['chromium', 'firefox', 'webkit']) {
    if (!browsers.includes(expected)) {
      console.error(
        `[playwright-conformance] missing required ${expected} receipt`,
      )
      failed = true
    }
  }
  summary.status = failed ? 'failure' : 'success'
  summary.traceDigest = failed
    ? null
    : receipts
        .map((receipt) => receipt.conformance.traceDigest)
        .sort()
        .join(':')
  return { summary, failed }
}

await runPlaywrightCli(import.meta.url, () =>
  runOwnerVerifyCli({
    usage:
      'Usage: conformance-playwright-verify.mjs --receipts-dir <dir> [--owner <id>] [--group <g>]',
    defaultOwnerId: 'playwright-conformance',
    requireSubcommand: false,
    logPrefix: 'playwright-conformance',
    loadPlan: (group) => loadConformanceOwnerPlan(group),
    loadReceipts: loadConformanceReceiptsFromDirectory,
    verifyReceipts: verifyConformanceOwnerReceipts,
  }),
)
