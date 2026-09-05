#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCrossGateReceipt } from './cross-repo-receipt.mjs'

const HEX_64 = /^[a-f0-9]{64}$/u
const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  if (index < 0 || !args[index + 1]) throw new Error(`${name} is required.`)
  return args[index + 1]
}
const digest = (value) => createHash('sha256').update(value).digest('hex')

export function verifyReceiptBinding({
  receiptBytes,
  manifestBytes,
  expectedReceiptSha256,
  expectedCandidateSha256,
  sourceCommit,
  releaseTag,
}) {
  if (!HEX_64.test(expectedReceiptSha256 ?? ''))
    throw new Error('Expected receipt digest is invalid.')
  if (digest(receiptBytes) !== expectedReceiptSha256)
    throw new Error('Cross-repo receipt digest mismatch.')
  const receipt = validateCrossGateReceipt(JSON.parse(receiptBytes))
  const manifestSha256 = digest(manifestBytes)
  const manifest = JSON.parse(manifestBytes)
  if (
    receipt.status !== 'success' ||
    receipt.fsusui.sourceCommit !== sourceCommit ||
    receipt.fsusui.releaseTag !== releaseTag ||
    receipt.candidate.sha256 !== expectedCandidateSha256 ||
    receipt.candidate.sha256 !== manifest.artifact?.sha256 ||
    receipt.candidate.manifestSha256 !== manifestSha256 ||
    receipt.candidate.version !== manifest.package?.version ||
    receipt.candidate.package !== manifest.package?.name
  ) {
    throw new Error('Cross-repo receipt is not bound to the publish candidate.')
  }
  return {
    receiptSha256: expectedReceiptSha256,
    candidateSha256: expectedCandidateSha256,
  }
}

export function main() {
  const result = verifyReceiptBinding({
    receiptBytes: readFileSync(path.resolve(option('--receipt'))),
    manifestBytes: readFileSync(path.resolve(option('--candidate-manifest'))),
    expectedReceiptSha256: option('--receipt-digest'),
    expectedCandidateSha256: option('--candidate-digest'),
    sourceCommit: option('--source-commit'),
    releaseTag: option('--release-tag'),
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main()
  } catch (error) {
    console.error(
      `[cross-repo-receipt-verify] ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  }
}
