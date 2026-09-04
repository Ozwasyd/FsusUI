import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import {
  createCrossGateReceipt,
  REQUIRED_GATES,
  validateCrossGateReceipt,
} from './cross-repo-receipt.mjs'
import { canonicalJson } from './fsusui-release-dispatch-lib.mjs'
import { verifyReceiptBinding } from './verify-cross-repo-receipt.mjs'

const digest = 'a'.repeat(64)
const bindingRecord = {
  bindingSha256: 'b'.repeat(64),
  binding: {
    status: 'success',
    sourceRepository: 'Ozwasyd/FsusUI',
    sourceCommit: 'c'.repeat(40),
    releaseTag: 'v1.2.3',
    candidate: {
      name: '@ozwasyd/element-plus',
      version: '1.2.3',
      sha256: digest,
      manifestSha256: 'd'.repeat(64),
    },
  },
}
const runRecord = {
  commitSha: 'e'.repeat(40),
  candidateSha256Before: digest,
  candidateSha256After: digest,
  workingTreeBefore: 'clean',
  workingTreeAfter: 'clean',
  commandStatus: 'success',
  durationMs: 42,
  startedAt: '2026-09-03T00:00:00.000Z',
  completedAt: '2026-09-03T00:00:01.000Z',
  toolchain: {
    node: '22.14.0',
    npm: '11.5.1',
    vue: '3.5.32',
    vite: '7.3.1',
    typescript: '6.0.2',
    vueTsc: '3.2.6',
  },
}
const inputs = (overrides = {}) => ({
  bindingRecord,
  runRecord,
  fsusblog: {
    repository: 'Ozwasyd/FsusBlog',
    defaultBranch: 'main',
    commitSha: runRecord.commitSha,
  },
  workflow: {
    runId: '425001',
    runUrl: 'https://github.com/Ozwasyd/FsusUI/actions/runs/425001',
  },
  ...overrides,
})

test('success receipt binds every required gate and stable digest', () => {
  const first = createCrossGateReceipt(inputs())
  const second = createCrossGateReceipt(inputs())
  assert.equal(first.receipt.status, 'success')
  assert.equal(first.receiptSha256, second.receiptSha256)
  assert.deepEqual(
    first.receipt.gates.map((gate) => gate.name),
    REQUIRED_GATES,
  )
})

test('candidate mutation, skipped command, and dirty tree produce failed receipts', () => {
  for (const changed of [
    { candidateSha256After: 'f'.repeat(64) },
    { commandStatus: 'skipped' },
    { workingTreeBefore: 'dirty' },
    { workingTreeAfter: 'dirty' },
  ]) {
    const result = createCrossGateReceipt(
      inputs({ runRecord: { ...runRecord, ...changed } }),
    )
    assert.equal(result.receipt.status, 'failed')
    assert.ok(result.receipt.diagnostics.length > 0)
  }
})

test('receipt tamper, non-full SHA, and missing field fail validation', () => {
  const receipt = createCrossGateReceipt(inputs()).receipt
  const tampered = structuredClone(receipt)
  tampered.gates[0].status = 'failed'
  assert.throws(() => validateCrossGateReceipt(tampered), /success/u)
  const shortSha = structuredClone(receipt)
  shortSha.fsusblog.commitSha = 'short'
  assert.throws(() => validateCrossGateReceipt(shortSha), /FsusBlog identity/u)
  const missing = structuredClone(receipt)
  delete missing.toolchain.vueTsc
  assert.throws(() => validateCrossGateReceipt(missing), /missing or unknown/u)
})

test('failure diagnostics remain sanitized codes', () => {
  const result = createCrossGateReceipt(
    inputs({ runRecord: { ...runRecord, commandStatus: 'failed' } }),
  )
  assert.equal(result.receipt.status, 'failed')
  assert.doesNotMatch(
    JSON.stringify(result.receipt),
    /authorization|bearer|private key|\.npmrc/iu,
  )
})

test('publish binding rejects failed, tampered, or mismatched receipts', () => {
  const result = createCrossGateReceipt(inputs())
  const manifestBytes = canonicalJson({
    artifact: { sha256: digest },
    package: { name: '@ozwasyd/element-plus', version: '1.2.3' },
  })
  const actualManifestDigest = createHash('sha256')
    .update(manifestBytes)
    .digest('hex')
  const boundReceipt = structuredClone(result.receipt)
  boundReceipt.candidate.manifestSha256 = actualManifestDigest
  const boundBytes = canonicalJson(boundReceipt)
  const boundDigest = createHash('sha256').update(boundBytes).digest('hex')
  assert.equal(
    verifyReceiptBinding({
      receiptBytes: boundBytes,
      manifestBytes,
      expectedReceiptSha256: boundDigest,
      expectedCandidateSha256: digest,
      sourceCommit: bindingRecord.binding.sourceCommit,
      releaseTag: bindingRecord.binding.releaseTag,
    }).candidateSha256,
    digest,
  )
  assert.throws(
    () =>
      verifyReceiptBinding({
        receiptBytes: boundBytes,
        manifestBytes,
        expectedReceiptSha256: '9'.repeat(64),
        expectedCandidateSha256: digest,
        sourceCommit: bindingRecord.binding.sourceCommit,
        releaseTag: bindingRecord.binding.releaseTag,
      }),
    /digest mismatch/u,
  )
})
