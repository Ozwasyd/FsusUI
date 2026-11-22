import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
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

const results = new Array(consumerProfiles.length)
const consumerTempRoot =
  process.env.FSUS_CONSUMER_TMPDIR ??
  (process.platform === 'win32' ? os.tmpdir() : '/tmp')
const consumerNodeOptions = `${process.env.NODE_OPTIONS ?? ''}`
  .replace(/(?:^|\s)--max[-_]old[-_]space[-_]size(?:=|\s+)\d+/gu, ' ')
  .trim()

function runProfile(profile) {
  return new Promise((resolve) => {
    const receiptPath = path.join(outputRoot, `${profile}.json`)
    console.log(`\n[consumer-matrix] starting ${profile}`)
    const chunks = []
    const child = spawn(
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
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => chunks.push(chunk))
    child.once('error', (error) => {
      resolve({
        profile,
        status: 'failed',
        error: error.message,
        output: Buffer.concat(chunks).toString('utf8'),
      })
    })
    child.once('close', (status) => {
      const output = Buffer.concat(chunks).toString('utf8')
      if (status !== 0 || !existsSync(receiptPath)) {
        resolve({
          profile,
          status: 'failed',
          error:
            status === 0
              ? 'profile receipt missing'
              : `profile exited ${status ?? -1}`,
          output,
        })
        return
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
        resolve({ profile, receipt, status: 'passed', output })
      } catch (error) {
        resolve({ profile, status: 'failed', error: error.message, output })
      }
    })
  })
}

const memoryConcurrency = Math.max(
  1,
  Math.floor(os.totalmem() / (1024 * 1024 * 1024) / 4),
)
const concurrency = Math.max(
  1,
  Math.min(
    consumerProfiles.length,
    Number(process.env.FSUS_CONSUMER_MATRIX_CONCURRENCY) || memoryConcurrency,
  ),
)
console.log(
  `[consumer-matrix] executing ${consumerProfiles.length} profiles with concurrency=${concurrency}`,
)
let profileCursor = 0
async function profileWorker() {
  while (profileCursor < consumerProfiles.length) {
    const index = profileCursor
    profileCursor += 1
    const profile = consumerProfiles[index]
    const outcome = await runProfile(profile)
    if (outcome.output) {
      console.log(`\n[consumer-matrix] --- ${profile} output ---`)
      process.stdout.write(outcome.output)
      if (!outcome.output.endsWith('\n')) process.stdout.write('\n')
    }
    const entry = { profile, status: outcome.status }
    if (outcome.receipt) entry.receipt = outcome.receipt
    if (outcome.error) entry.error = outcome.error
    results[index] = entry
  }
}
await Promise.all(Array.from({ length: concurrency }, () => profileWorker()))

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
