import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import {
  canonicalJson,
  consumerMatrixSchema,
  consumerProfileSchema,
  consumerProfiles,
  digestJson,
} from './consumer-matrix-lib.mjs'
import { sha256File } from './npm-candidate-lib.mjs'
import { verifyCandidateMatrixBinding } from './cross-repo-candidate-binding.mjs'

const roots = []
const SOURCE_SHA = '4'.repeat(40)
const VERSION = '1.2.3'

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

const receipt = (profile, candidate) => ({
  schema: consumerProfileSchema,
  profile,
  candidate,
  packageManager: {
    name: profile === 'pnpm-latest' ? 'pnpm' : 'npm',
    version: '10.33.0',
  },
  toolchain: {
    node: '22.14.0',
    vue: '3.5.32',
    vite: '7.3.1',
    typescript: '6.0.2',
    vueTsc: '3.2.6',
  },
  statuses: Object.fromEntries(
    [
      'install',
      'typecheck',
      'build',
      'ssr',
      'exports',
      'worker',
      'wasm',
      'bundle',
    ].map((stage) => [stage, 'passed']),
  ),
  durationsMs: Object.fromEntries(
    [
      'install',
      'typecheck',
      'build',
      'ssr',
      'exports',
      'worker',
      'wasm',
      'bundle',
    ].map((stage) => [stage, 1]),
  ),
  budgets: {},
  artifacts: { workerFiles: ['worker.mjs'], wasmFiles: ['runtime.wasm'] },
  digests: {
    authority: 'a'.repeat(64),
    profile: profile.charCodeAt(0).toString(16).padStart(64, '0'),
    config: 'b'.repeat(64),
  },
  fixturePath: null,
})

const fixture = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fsusui-cross-binding-'))
  roots.push(root)
  const candidatePath = path.join(root, 'fsusui-npm-candidate.tgz')
  const candidateManifestPath = path.join(
    root,
    'fsusui-npm-candidate.manifest.json',
  )
  const matrixDirectory = path.join(root, 'matrix')
  mkdirSync(matrixDirectory)
  writeFileSync(candidatePath, 'immutable candidate bytes')
  writeFileSync(candidateManifestPath, '{}\n')
  const digest = sha256File(candidatePath)
  const candidate = {
    name: '@ozwasyd/element-plus',
    version: VERSION,
    sha256: digest,
  }
  const receipts = Object.fromEntries(
    consumerProfiles.map((profile) => [profile, receipt(profile, candidate)]),
  )
  for (const [profile, value] of Object.entries(receipts))
    writeFileSync(
      path.join(matrixDirectory, `${profile}.json`),
      canonicalJson(value),
    )
  const summary = {
    schema: consumerMatrixSchema,
    candidate,
    digests: { authority: 'a'.repeat(64), config: 'b'.repeat(64) },
    profiles: consumerProfiles.map((profile) => ({
      profile,
      receiptDigest: digestJson(receipts[profile]),
      status: 'passed',
    })),
    status: 'passed',
  }
  writeFileSync(
    path.join(matrixDirectory, 'matrix-summary.json'),
    canonicalJson(summary),
  )
  const manifest = {
    artifact: { sha256: digest },
    commitSha: SOURCE_SHA,
    package: candidate,
  }
  const options = {
    repoRoot: root,
    candidatePath,
    candidateManifestPath,
    matrixDirectory,
    expectedCandidateSha256: digest,
    qualityCandidateSha256: digest,
    sourceCommit: SOURCE_SHA,
    releaseTag: `v${VERSION}`,
    verifyCandidateFn: () => manifest,
    readCandidatePackageJsonFn: () => candidate,
  }
  return { root, candidatePath, matrixDirectory, receipts, options }
}

test('binds candidate bytes, manifest, quality output, and three-profile matrix', () => {
  const data = fixture()
  const result = verifyCandidateMatrixBinding(data.options)
  assert.equal(result.binding.status, 'success')
  assert.equal(
    result.binding.candidate.sha256,
    data.options.expectedCandidateSha256,
  )
  assert.equal(result.binding.matrix.profiles.length, 3)
})

test('workflow/quality/manifest digest mismatch fails closed', () => {
  for (const mutation of [
    (data) => ({ ...data.options, expectedCandidateSha256: 'c'.repeat(64) }),
    (data) => ({ ...data.options, qualityCandidateSha256: 'd'.repeat(64) }),
    (data) => ({
      ...data.options,
      verifyCandidateFn: () => ({ artifact: { sha256: 'e'.repeat(64) } }),
    }),
  ]) {
    const data = fixture()
    assert.throws(
      () => verifyCandidateMatrixBinding(mutation(data)),
      /digest mismatch/u,
    )
  }
})

test('receipt tamper or skipped profile fails closed', () => {
  const tampered = fixture()
  tampered.receipts['npm-latest'].durationsMs.install = 2
  writeFileSync(
    path.join(tampered.matrixDirectory, 'npm-latest.json'),
    canonicalJson(tampered.receipts['npm-latest']),
  )
  assert.throws(
    () => verifyCandidateMatrixBinding(tampered.options),
    /receipt identity mismatch/u,
  )

  const skipped = fixture()
  rmSync(path.join(skipped.matrixDirectory, 'pnpm-latest.json'))
  assert.throws(
    () => verifyCandidateMatrixBinding(skipped.options),
    /receipt is missing/u,
  )
})

test('candidate mutation or repack cannot fall back to a registry', () => {
  const data = fixture()
  writeFileSync(data.candidatePath, 'replacement candidate')
  const originalFetch = globalThis.fetch
  let networkCalls = 0
  globalThis.fetch = async () => {
    networkCalls += 1
    throw new Error('network forbidden')
  }
  try {
    assert.throws(
      () => verifyCandidateMatrixBinding(data.options),
      /digest mismatch/u,
    )
    assert.equal(networkCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})
