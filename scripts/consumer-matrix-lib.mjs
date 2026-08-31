import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import semver from 'semver'

export const consumerMatrixSchema = 'fsusui.consumer-matrix-receipt.v1'
export const consumerProfileSchema = 'fsusui.consumer-profile-receipt.v1'
export const consumerProfiles = ['npm-latest', 'pnpm-latest', 'npm-peer-floor']

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const canonicalValue = (value) => {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    )
  }
  return value
}

export const canonicalJson = (value) =>
  `${JSON.stringify(canonicalValue(value))}\n`
export const digestJson = (value) => sha256(canonicalJson(value))
export const digestFile = (filePath) => sha256(readFileSync(filePath))

export const consumerMatrixConfigInputs = [
  'scripts/consumer-matrix-lib.mjs',
  'scripts/consumer-matrix.mjs',
  'scripts/test-consumer-install.mjs',
  'scripts/consumer-performance-baseline.json',
  'vue/tests/consumer-install/template/package.json',
  'vue/tests/consumer-install/template/vite.config.ts',
  'vue/tests/consumer-install/template/src/main.ts',
]

export const consumerMatrixConfigDigest = (repoRoot) =>
  digestJson(
    Object.fromEntries(
      consumerMatrixConfigInputs.map((relativePath) => [
        relativePath,
        digestFile(path.join(repoRoot, relativePath)),
      ]),
    ),
  )

export function readConsumerAuthority(repoRoot) {
  const authorityPath = path.join(
    repoRoot,
    'config',
    'dependencies',
    'npm-authority.json',
  )
  const authority = JSON.parse(readFileSync(authorityPath, 'utf8'))
  const names = Object.keys(authority.consumerProfiles ?? {})
  if (
    names.length !== consumerProfiles.length ||
    consumerProfiles.some((name, index) => names[index] !== name)
  ) {
    throw new Error(
      `consumerProfiles must contain exactly ${consumerProfiles.join(', ')} in canonical order; found ${names.join(', ') || 'none'}.`,
    )
  }
  return {
    authority,
    digest: digestFile(authorityPath),
    path: authorityPath,
  }
}

export function resolveConsumerProfile({ authority, candidatePackage, name }) {
  if (!consumerProfiles.includes(name)) {
    throw new Error(
      `Unknown consumer profile ${name}; implicit defaults are forbidden.`,
    )
  }
  const declared = authority.consumerProfiles?.[name]
  if (!declared)
    throw new Error(`Authority is missing consumer profile ${name}.`)

  const packages = { ...declared.packages }
  const toolchain = Object.fromEntries(
    ['@vitejs/plugin-vue', 'typescript', 'vite', 'vue-tsc'].map((id) => {
      const version = authority.install?.[id]
      if (!semver.valid(version)) {
        throw new Error(`Authority install.${id} must be an exact version.`)
      }
      return [id, version]
    }),
  )
  const vueRange = candidatePackage.peerDependencies?.vue
  if (typeof vueRange !== 'string') {
    throw new Error('Candidate peerDependencies.vue is required.')
  }
  const peerFloor = semver.minVersion(vueRange)?.version
  if (!peerFloor || !semver.valid(peerFloor)) {
    throw new Error(`Cannot derive a unique Vue peer floor from ${vueRange}.`)
  }
  if (name === 'npm-peer-floor' && packages.vue !== peerFloor) {
    throw new Error(
      `Authority npm-peer-floor Vue ${packages.vue} does not equal candidate peer floor ${peerFloor}; widening is forbidden.`,
    )
  }
  if (!semver.satisfies(packages.vue, vueRange)) {
    throw new Error(
      `Profile ${name} Vue ${packages.vue} does not satisfy candidate peer range ${vueRange}.`,
    )
  }

  const manager = name === 'pnpm-latest' ? 'pnpm' : 'npm'
  return {
    description: declared.description,
    manager,
    name,
    packages,
    peerFloor,
    toolchain,
    digest: digestJson({ manager, name, packages, peerFloor, toolchain }),
  }
}

export function projectConsumerPackage({
  candidatePath,
  candidatePackage,
  profile,
  templatePackage,
}) {
  const projected = structuredClone(templatePackage)
  projected.packageManager =
    profile.manager === 'pnpm' ? templatePackage.packageManager : undefined
  projected.dependencies = {
    ...profile.packages,
    [candidatePackage.name]: `file:${path.resolve(candidatePath)}`,
  }
  projected.devDependencies = { ...profile.toolchain }
  projected.pnpm =
    profile.manager === 'pnpm'
      ? {
          ...templatePackage.pnpm,
          overrides: {
            '@vue/compiler-dom': profile.packages.vue,
            '@vue/shared': profile.packages.vue,
          },
        }
      : undefined
  return JSON.parse(JSON.stringify(projected))
}

const requiredStageNames = [
  'install',
  'typecheck',
  'build',
  'ssr',
  'exports',
  'worker',
  'wasm',
  'bundle',
]

function assertDigest(value, label) {
  if (!/^[a-f0-9]{64}$/u.test(value ?? '')) {
    throw new Error(`${label} must be a SHA-256 digest.`)
  }
}

export function validateProfileReceipt(receipt, expected = {}) {
  if (receipt?.schema !== consumerProfileSchema) {
    throw new Error('Consumer profile receipt schema mismatch.')
  }
  if (!consumerProfiles.includes(receipt.profile)) {
    throw new Error(`Unknown receipt profile ${String(receipt.profile)}.`)
  }
  if (!['npm', 'pnpm'].includes(receipt.packageManager?.name)) {
    throw new Error('Receipt package manager identity is missing.')
  }
  if (!receipt.packageManager.version) {
    throw new Error('Receipt package manager version is required.')
  }
  const expectedManager = receipt.profile === 'pnpm-latest' ? 'pnpm' : 'npm'
  if (receipt.packageManager.name !== expectedManager) {
    throw new Error(
      `${receipt.profile} must use ${expectedManager}, not ${receipt.packageManager.name}.`,
    )
  }
  for (const key of ['name', 'version', 'sha256']) {
    if (!receipt.candidate?.[key]) {
      throw new Error(`Receipt candidate.${key} is required.`)
    }
  }
  for (const key of ['node', 'vue', 'vite', 'typescript', 'vueTsc']) {
    if (!receipt.toolchain?.[key]) {
      throw new Error(`Receipt toolchain.${key} is required.`)
    }
  }
  for (const stage of requiredStageNames) {
    if (receipt.statuses?.[stage] !== 'passed') {
      throw new Error(`Receipt stage ${stage} did not pass.`)
    }
    if (
      !Number.isFinite(receipt.durationsMs?.[stage]) ||
      receipt.durationsMs[stage] < 0
    ) {
      throw new Error(`Receipt duration ${stage} is required.`)
    }
  }
  for (const graph of ['startup', 'markdownHydration']) {
    for (const side of ['actual', 'limit']) {
      for (const encoding of ['raw', 'gzip', 'brotli']) {
        if (!Number.isFinite(receipt.budgets?.[graph]?.[side]?.[encoding])) {
          throw new Error(
            `Receipt budgets.${graph}.${side}.${encoding} is required.`,
          )
        }
      }
    }
  }
  if (
    !Array.isArray(receipt.artifacts?.workerFiles) ||
    receipt.artifacts.workerFiles.length === 0 ||
    !Array.isArray(receipt.artifacts?.wasmFiles) ||
    receipt.artifacts.wasmFiles.length === 0
  ) {
    throw new Error('Receipt worker and Wasm artifact lists are required.')
  }
  for (const key of ['authority', 'profile', 'config']) {
    assertDigest(receipt.digests?.[key], `Receipt digests.${key}`)
  }
  assertDigest(receipt.candidate.sha256, 'Receipt candidate.sha256')
  if (expected.profile && receipt.profile !== expected.profile) {
    throw new Error(
      `Expected profile ${expected.profile}, got ${receipt.profile}.`,
    )
  }
  if (
    expected.candidateSha256 &&
    receipt.candidate.sha256 !== expected.candidateSha256
  ) {
    throw new Error('Receipt candidate digest mismatch.')
  }
  if (
    expected.authorityDigest &&
    receipt.digests.authority !== expected.authorityDigest
  ) {
    throw new Error('Receipt authority digest mismatch.')
  }
  if (
    expected.profileDigest &&
    receipt.digests.profile !== expected.profileDigest
  ) {
    throw new Error('Receipt profile digest mismatch.')
  }
  if (
    expected.configDigest &&
    receipt.digests.config !== expected.configDigest
  ) {
    throw new Error('Receipt config digest mismatch.')
  }
  if (
    (expected.candidateName &&
      receipt.candidate.name !== expected.candidateName) ||
    (expected.candidateVersion &&
      receipt.candidate.version !== expected.candidateVersion)
  ) {
    throw new Error('Receipt candidate identity mismatch.')
  }
  if (receipt.fixturePath !== null && typeof receipt.fixturePath !== 'string') {
    throw new Error(
      'Receipt fixturePath must be null unless the fixture was kept.',
    )
  }
  return receipt
}

export function createMatrixSummary({
  authorityDigest,
  candidate,
  configDigest,
  profileDigests = {},
  results,
}) {
  const byProfile = new Map(results.map((result) => [result.profile, result]))
  const profiles = consumerProfiles.map((profile) => {
    const result = byProfile.get(profile)
    if (!result) throw new Error(`Consumer matrix skipped profile ${profile}.`)
    return result
  })
  if (byProfile.size !== consumerProfiles.length) {
    throw new Error(
      'Consumer matrix contains an implicit or duplicate profile.',
    )
  }

  const receipts = profiles.map((result) => {
    if (result.status !== 'passed') {
      throw new Error(`Consumer matrix profile ${result.profile} failed.`)
    }
    return validateProfileReceipt(result.receipt, {
      authorityDigest,
      candidateSha256: candidate.sha256,
      candidateName: candidate.name,
      candidateVersion: candidate.version,
      configDigest,
      profile: result.profile,
      profileDigest: profileDigests[result.profile],
    })
  })
  const candidateDigests = new Set(
    receipts.map((receipt) => receipt.candidate.sha256),
  )
  if (candidateDigests.size !== 1) {
    throw new Error(
      'Consumer matrix receipts do not share one candidate digest.',
    )
  }

  return {
    schema: consumerMatrixSchema,
    candidate,
    digests: { authority: authorityDigest, config: configDigest },
    profiles: receipts.map((receipt) => ({
      profile: receipt.profile,
      receiptDigest: digestJson(receipt),
      status: 'passed',
    })),
    status: 'passed',
  }
}

export function validateMatrixReceiptDigests(summary, receipts) {
  for (const profile of consumerProfiles) {
    const entry = summary.profiles?.find((item) => item.profile === profile)
    const receipt = receipts?.[profile]
    if (!entry || !receipt || entry.receiptDigest !== digestJson(receipt)) {
      throw new Error(`Consumer matrix receipt ${profile} was tampered.`)
    }
  }
  return summary
}

export function classifyConsumerMatrixImpact(paths) {
  const normalized = [...new Set(paths)].sort()
  if (normalized.length === 0) {
    throw new Error('Consumer matrix impact planning requires changed paths.')
  }
  const documentationOnly = normalized.every(
    (file) =>
      file.endsWith('.md') ||
      file.startsWith('docs/') ||
      file.startsWith('.changeset/'),
  )
  const plan = {
    action: documentationOnly ? 'skip' : 'run',
    paths: normalized,
    reason: documentationOnly
      ? 'no-package-impact:documentation-only'
      : 'package-impact:conservative-run',
  }
  return { ...plan, digest: digestJson(plan) }
}

export function validateConsumerBuildEvidence(evidence) {
  if (evidence?.privateExportAccessible !== false) {
    throw new Error('Consumer build resolved a private export.')
  }
  if (evidence?.ssrBrowserGlobalAccess !== false) {
    throw new Error('Consumer SSR evaluation accessed a browser global.')
  }
  const workerFiles = evidence?.workerFiles ?? []
  const wasmFiles = evidence?.wasmFiles ?? []
  if (workerFiles.length === 0) {
    throw new Error('Consumer production build emitted no worker artifact.')
  }
  if (wasmFiles.length === 0) {
    throw new Error('Consumer production build emitted no Wasm artifact.')
  }
  const sourceOnly = [
    ...workerFiles,
    ...wasmFiles,
    ...(evidence.files ?? []),
  ].filter(
    (file) => /(?:\.worker\.ts|\.map)$/u.test(file) || path.isAbsolute(file),
  )
  if (
    sourceOnly.length > 0 ||
    /\.worker\.ts\b/u.test(evidence.emittedText ?? '')
  ) {
    throw new Error(
      `Consumer production build leaked source-only artifacts: ${sourceOnly.join(', ') || '.worker.ts URL'}.`,
    )
  }
  for (const [id, versions] of Object.entries(
    evidence.dependencyVersions ?? {},
  )) {
    if (!Array.isArray(versions) || new Set(versions).size !== 1) {
      throw new Error(`Consumer dependency graph contains duplicate ${id}.`)
    }
  }
  if (evidence.markdownLazy !== true) {
    throw new Error('Consumer build lost the Markdown lazy chunk.')
  }
  return evidence
}
