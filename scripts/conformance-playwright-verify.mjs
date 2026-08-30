#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadConformanceOwnerPlan } from './conformance-playwright-plan.mjs'
import { validateConformanceReceipt } from './conformance-playwright-runner.mjs'
import { verifyMarkdownOwnerReceipts } from './markdown-playwright-verify.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function loadConformanceReceiptsFromDirectory(directory) {
  const absolute = resolve(root, directory)
  if (!existsSync(absolute)) return []
  const receipts = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = resolve(current, entry.name)
      if (entry.isDirectory()) visit(target)
      else if (entry.name.endsWith('.json')) {
        const value = JSON.parse(readFileSync(target, 'utf8'))
        if (value.cellId) receipts.push(value)
      }
    }
  }
  visit(absolute)
  return receipts
}

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

const option = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return (
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2)
  const ownerId = option(argv, 'owner', 'playwright-conformance')
  const group = option(argv, 'group', 'main')
  const receiptsDir = option(argv, 'receipts-dir')
  if (!receiptsDir) throw new Error('owner-verify requires --receipts-dir')
  const plan = loadConformanceOwnerPlan(group)
  const result = await verifyConformanceOwnerReceipts(
    ownerId,
    group,
    loadConformanceReceiptsFromDirectory(receiptsDir),
    plan,
    {
      evidenceDir: option(argv, 'evidence-dir'),
      expectedCommitSha: option(argv, 'commit-sha'),
    },
  )
  const evidenceOut = option(argv, 'evidence-out')
  if (evidenceOut) {
    const absolute = resolve(root, evidenceOut)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, `${JSON.stringify(result.summary, null, 2)}\n`)
  }
  console.log(
    `[playwright-conformance] owner=${ownerId} group=${group} status=${result.summary.status} cells=${result.summary.cells.length}`,
  )
  if (result.failed) process.exitCode = 1
}
