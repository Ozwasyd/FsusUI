#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  consumerMatrixSchema,
  consumerProfileSchema,
  consumerProfiles,
  digestJson,
} from './consumer-matrix-lib.mjs'
import {
  canonicalJson,
  readCandidatePackageJson,
  sha256File,
  verifyCandidate,
} from './npm-candidate-lib.mjs'

const HEX_40 = /^[a-f0-9]{40}$/u
const HEX_64 = /^[a-f0-9]{64}$/u
const REQUIRED_STAGES = [
  'install',
  'typecheck',
  'build',
  'ssr',
  'exports',
  'worker',
  'wasm',
  'bundle',
]

const readJson = (filePath, label) => {
  if (!existsSync(filePath)) throw new Error(`${label} is missing.`)
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    throw new Error(`${label} is invalid JSON.`)
  }
}

const assertDigest = (value, label) => {
  if (typeof value !== 'string' || !HEX_64.test(value))
    throw new Error(`${label} must be a SHA-256 digest.`)
}

const validateProfile = ({ receipt, profile, candidate, summaryEntry }) => {
  if (
    receipt.schema !== consumerProfileSchema ||
    receipt.profile !== profile ||
    receipt.candidate?.name !== candidate.name ||
    receipt.candidate?.version !== candidate.version ||
    receipt.candidate?.sha256 !== candidate.sha256 ||
    summaryEntry?.status !== 'passed' ||
    summaryEntry?.receiptDigest !== digestJson(receipt)
  ) {
    throw new Error(`Consumer matrix ${profile} receipt identity mismatch.`)
  }
  for (const stage of REQUIRED_STAGES) {
    if (
      receipt.statuses?.[stage] !== 'passed' ||
      !Number.isFinite(receipt.durationsMs?.[stage]) ||
      receipt.durationsMs[stage] < 0
    ) {
      throw new Error(`Consumer matrix ${profile} did not pass ${stage}.`)
    }
  }
  for (const key of ['authority', 'profile', 'config'])
    assertDigest(receipt.digests?.[key], `${profile} ${key}`)
  return receipt
}

export function verifyCandidateMatrixBinding({
  repoRoot,
  candidatePath,
  candidateManifestPath,
  matrixDirectory,
  expectedCandidateSha256,
  qualityCandidateSha256,
  sourceCommit,
  releaseTag,
  verifyCandidateFn = verifyCandidate,
  readCandidatePackageJsonFn = readCandidatePackageJson,
  sha256FileFn = sha256File,
}) {
  assertDigest(expectedCandidateSha256, 'Workflow candidate input')
  assertDigest(qualityCandidateSha256, 'Release quality candidate output')
  if (!HEX_40.test(sourceCommit ?? ''))
    throw new Error('Release source commit must be a full SHA.')
  const version = releaseTag?.match(
    /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/u,
  )?.[1]
  if (!version) throw new Error('Release tag is invalid.')
  if (!existsSync(candidateManifestPath))
    throw new Error('Candidate manifest is missing.')

  const candidateSha256 = sha256FileFn(candidatePath)
  const expectedManifestPath = path.join(
    path.dirname(candidatePath),
    'fsusui-npm-candidate.manifest.json',
  )
  if (
    path.resolve(candidateManifestPath) !== path.resolve(expectedManifestPath)
  )
    throw new Error(
      'Candidate manifest must be adjacent to the candidate tarball.',
    )
  const manifest = verifyCandidateFn({
    repoRoot,
    tarballPath: candidatePath,
    expectedCommit: sourceCommit,
    expectedTagVersion: version,
  })
  const candidatePackage = readCandidatePackageJsonFn(candidatePath)
  if (
    candidateSha256 !== expectedCandidateSha256 ||
    candidateSha256 !== qualityCandidateSha256 ||
    candidateSha256 !== manifest.artifact.sha256
  ) {
    throw new Error(
      'Candidate bytes, workflow input, quality output, and manifest digest mismatch.',
    )
  }
  const candidate = {
    name: candidatePackage.name,
    version: candidatePackage.version,
    sha256: candidateSha256,
  }
  const summaryPath = path.join(matrixDirectory, 'matrix-summary.json')
  const summary = readJson(summaryPath, 'Consumer matrix summary')
  if (
    summary.schema !== consumerMatrixSchema ||
    summary.status !== 'passed' ||
    summary.candidate?.name !== candidate.name ||
    summary.candidate?.version !== candidate.version ||
    summary.candidate?.sha256 !== candidate.sha256 ||
    !Array.isArray(summary.profiles) ||
    summary.profiles.length !== consumerProfiles.length
  ) {
    throw new Error('Consumer matrix summary is not bound to the candidate.')
  }
  const profileReceipts = consumerProfiles.map((profile) => {
    const receipt = readJson(
      path.join(matrixDirectory, `${profile}.json`),
      `Consumer matrix ${profile} receipt`,
    )
    return validateProfile({
      receipt,
      profile,
      candidate,
      summaryEntry: summary.profiles.find((entry) => entry.profile === profile),
    })
  })
  if (
    new Set(profileReceipts.map((receipt) => receipt.digests.authority))
      .size !== 1 ||
    new Set(profileReceipts.map((receipt) => receipt.digests.config)).size !== 1
  ) {
    throw new Error(
      'Consumer matrix authority/config digests are inconsistent.',
    )
  }
  const binding = {
    schemaVersion: 1,
    sourceRepository: 'Ozwasyd/FsusUI',
    sourceCommit,
    releaseTag,
    candidate: {
      ...candidate,
      manifestSha256: sha256FileFn(candidateManifestPath),
    },
    matrix: {
      schema: consumerMatrixSchema,
      sha256: sha256FileFn(summaryPath),
      profiles: summary.profiles.map((entry) => ({
        profile: entry.profile,
        receiptDigest: entry.receiptDigest,
      })),
    },
    status: 'success',
  }
  return {
    binding,
    bindingSha256: createHash('sha256')
      .update(canonicalJson(binding))
      .digest('hex'),
  }
}

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  if (index < 0 || !args[index + 1]) throw new Error(`${name} is required.`)
  return args[index + 1]
}

export function main() {
  const repoRoot = path.resolve(option('--repo-root'))
  const outputPath = path.resolve(option('--output'))
  const result = verifyCandidateMatrixBinding({
    repoRoot,
    candidatePath: path.resolve(option('--candidate')),
    candidateManifestPath: path.resolve(option('--candidate-manifest')),
    matrixDirectory: path.resolve(option('--matrix-directory')),
    expectedCandidateSha256: option('--candidate-digest'),
    qualityCandidateSha256: option('--quality-candidate-digest'),
    sourceCommit: option('--source-commit'),
    releaseTag: option('--release-tag'),
  })
  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, canonicalJson(result), { mode: 0o600 })
  process.stdout.write(`${result.bindingSha256}\n`)
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  try {
    main()
  } catch (error) {
    console.error(
      `[cross-repo-candidate] ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    process.exitCode = 1
  }
}
