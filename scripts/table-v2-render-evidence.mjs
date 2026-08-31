#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  digestValue,
  validateFsusUIReceiptPair,
} from './check-fsusui-design-conformance.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const evidenceRoot = 'tests/conformance/visual/artifacts/issue-285-table-v2'
const manifestPath = `${evidenceRoot}/manifest.json`
const classificationPath = `${evidenceRoot}/ui-ux-classification-receipt.json`
const acceptancePath = `${evidenceRoot}/ux-acceptance-receipt.json`
const reviewPath = `${evidenceRoot}/independent-ux-review.json`
const receiptPaths = new Set([
  manifestPath,
  classificationPath,
  acceptancePath,
  reviewPath,
])

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath))
const readJson = (relativePath) =>
  JSON.parse(read(relativePath).toString('utf8'))
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const gitBytes = (...args) => execFileSync('git', args, { cwd: root })
const fail = (message) => {
  throw new Error(`table-v2-render-evidence: ${message}`)
}

const manifest = readJson(manifestPath)
const unsignedManifest = structuredClone(manifest)
delete unsignedManifest.manifestDigest
if (manifest.manifestDigest !== digestValue(unsignedManifest)) {
  fail('manifest digest mismatch')
}
if (
  manifest.schema !== 'fsusui-table-v2-render-evidence.v1' ||
  manifest.productionFixture !== true ||
  manifest.theme !== 'light' ||
  manifest.motionMode !== 'reduced' ||
  manifest.generationCommand !==
    "FSUSUI_UPDATE_VISUAL_ARTIFACTS=1 dotnet test dotnet/FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj --filter 'FullyQualifiedName~FsusTableV2RenderedEvidenceTests' --no-restore"
) {
  fail('manifest context is incomplete or non-authoritative')
}
if (
  manifest.candidateDigest !==
  sha256(gitBytes('show', '--format=', '--binary', manifest.candidateSha))
) {
  fail('candidate digest mismatch')
}

const head = git('rev-parse', 'HEAD')
try {
  git('merge-base', '--is-ancestor', manifest.candidateSha, head)
} catch {
  fail('candidate is not an ancestor of HEAD')
}
const changedAfterCandidate = git(
  'diff',
  '--name-only',
  `${manifest.candidateSha}..${head}`,
)
  .split('\n')
  .filter(Boolean)
if (changedAfterCandidate.some((file) => !receiptPaths.has(file))) {
  fail(
    `non-receipt paths changed after candidate: ${changedAfterCandidate.join(', ')}`,
  )
}

const dirty = git('status', '--porcelain', '--untracked-files=no')
if (dirty) fail(`tracked worktree is dirty: ${dirty}`)

for (const entry of [...manifest.sources, ...manifest.artifacts]) {
  if (sha256(read(entry.path)) !== entry.sha256) {
    fail(`digest mismatch for ${entry.path}`)
  }
}

const classification = readJson(classificationPath)
const acceptance = readJson(acceptancePath)
await validateFsusUIReceiptPair(classification, acceptance)
if (
  classification.candidateSha !== manifest.candidateSha ||
  acceptance.candidateSha !== manifest.candidateSha
) {
  fail('receipt candidate mismatch')
}

const review = readJson(reviewPath)
if (
  review.candidateSha !== manifest.candidateSha ||
  review.status !== 'accepted' ||
  review.blockers?.length !== 0
) {
  fail('independent review is not an accepted exact-candidate review')
}
if (acceptance.independenceEvidenceDigest !== sha256(read(reviewPath))) {
  fail('independent review digest mismatch')
}

const artifactDigests = new Map(
  manifest.artifacts.map((artifact) => [artifact.path, artifact.sha256]),
)
for (const artifact of acceptance.inspectedRenderedArtifacts) {
  if (artifactDigests.get(artifact.path) !== artifact.digest) {
    fail(`acceptance artifact mismatch for ${artifact.path}`)
  }
}

console.log(
  `table-v2-render-evidence passed (${manifest.candidateSha}, ${manifest.artifacts.length} artifacts)`,
)
