import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  canonicalJson,
  consumerMatrixConfigDigest,
  consumerMatrixSchema,
  consumerProfiles,
  createMatrixSummary,
  digestJson,
  readConsumerAuthority,
  resolveConsumerProfile,
  validateMatrixReceiptDigests,
  validateProfileReceipt,
} from './consumer-matrix-lib.mjs'
import {
  readCandidatePackageJson,
  verifyCandidate,
} from './npm-candidate-lib.mjs'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const args = process.argv.slice(2).filter((argument) => argument !== '--')

function option(name) {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--'))
    throw new Error(`${name} requires a value.`)
  return value
}

const known = new Set(['--candidate', '--output'])
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index]
  if (!known.has(argument))
    throw new Error(`Unknown consumer matrix flag ${argument}.`)
  index += 1
}

const candidatePath = path.resolve(
  option('--candidate') ??
    path.join(repoRoot, 'dist', 'npm-candidate', 'fsusui-npm-candidate.tgz'),
)
if (!existsSync(candidatePath)) {
  throw new Error(`Consumer matrix candidate does not exist: ${candidatePath}`)
}
const outputRoot = path.resolve(
  option('--output') ??
    mkdtempSync(path.join(os.tmpdir(), 'fsusui-consumer-matrix-')),
)
mkdirSync(outputRoot, { recursive: true })

const manifest = verifyCandidate({ repoRoot, tarballPath: candidatePath })
const candidatePackage = readCandidatePackageJson(candidatePath)
const candidate = {
  name: candidatePackage.name,
  version: candidatePackage.version,
  sha256: manifest.artifact.sha256,
}
const { authority, digest: authorityDigest } = readConsumerAuthority(repoRoot)
const configDigest = consumerMatrixConfigDigest(repoRoot)
const profileDigests = Object.fromEntries(
  consumerProfiles.map((profile) => [
    profile,
    resolveConsumerProfile({
      authority,
      candidatePackage,
      name: profile,
    }).digest,
  ]),
)

const results = []
const consumerTempRoot =
  process.env.FSUS_CONSUMER_TMPDIR ??
  (process.platform === 'win32' ? os.tmpdir() : '/tmp')
const consumerNodeOptions = `${process.env.NODE_OPTIONS ?? ''}`
  .replace(/(?:^|\s)--max[-_]old[-_]space[-_]size(?:=|\s+)\d+/gu, ' ')
  .trim()
for (const profile of consumerProfiles) {
  const receiptPath = path.join(outputRoot, `${profile}.json`)
  console.log(`\n[consumer-matrix] running ${profile}`)
  const child = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'scripts', 'test-consumer-install.mjs'),
      '--profile',
      profile,
      '--candidate',
      candidatePath,
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        FSUS_CONSUMER_RESULT: receiptPath,
        FSUS_CONSUMER_TMPDIR: consumerTempRoot,
        NODE_OPTIONS: `${consumerNodeOptions} --max-old-space-size=2048`.trim(),
      },
      stdio: 'inherit',
    },
  )
  if (child.error) {
    results.push({ profile, status: 'failed', error: child.error.message })
    continue
  }
  if (child.status !== 0 || !existsSync(receiptPath)) {
    results.push({
      profile,
      status: 'failed',
      error:
        child.status === 0
          ? 'profile receipt missing'
          : `profile exited ${child.status ?? -1}`,
    })
    continue
  }
  try {
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
    validateProfileReceipt(receipt, {
      authorityDigest,
      candidateSha256: candidate.sha256,
      candidateName: candidate.name,
      candidateVersion: candidate.version,
      configDigest,
      profile,
      profileDigest: profileDigests[profile],
    })
    results.push({ profile, receipt, status: 'passed' })
  } catch (error) {
    results.push({ profile, status: 'failed', error: error.message })
  }
}

let summary
let failure
try {
  summary = createMatrixSummary({
    authorityDigest,
    candidate,
    configDigest,
    profileDigests,
    results,
  })
} catch (error) {
  failure = error
  summary = {
    schema: consumerMatrixSchema,
    candidate,
    digests: { authority: authorityDigest, config: configDigest },
    profiles: results.map(({ profile, status, error, receipt }) => ({
      profile,
      status,
      error: error ?? null,
      receiptDigest: receipt ? digestJson(receipt) : null,
    })),
    status: 'failed',
  }
}
const summaryPath = path.join(outputRoot, 'matrix-summary.json')
writeFileSync(summaryPath, canonicalJson(summary))
if (!failure) {
  validateMatrixReceiptDigests(
    summary,
    Object.fromEntries(
      results.map(({ profile, receipt }) => [profile, receipt]),
    ),
  )
}
console.log(`\n[consumer-matrix] receipts: ${outputRoot}`)
console.log(`[consumer-matrix] summary: ${summaryPath}`)
if (failure) throw failure
console.log(
  `[consumer-matrix] all profiles passed for ${candidate.name}@${candidate.version} (${candidate.sha256}).`,
)
