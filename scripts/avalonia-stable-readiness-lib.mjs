import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const digest = (value) =>
  crypto
    .createHash('sha256')
    .update(
      typeof value === 'string' || ArrayBuffer.isView(value)
        ? value
        : stableJson(value),
    )
    .digest('hex')

const packageInputPaths = [
  'dotnet',
  'NuGet.config',
  'package.json',
  'pnpm-lock.yaml',
  'scripts/avalonia-stable-readiness-lib.mjs',
  'scripts/check-avalonia-nuget-stable.mjs',
  'scripts/check-nuget-metadata.mjs',
  'scripts/check-nuget-package-smoke.mjs',
  'scripts/dotnet-package-verify.mjs',
  'spec/avalonia',
  'spec/components/contracts/v2/contract-v2.json',
]

export const assertCleanPackageInputs = () => {
  const status = spawnSync(
    'git',
    [
      'status',
      '--porcelain',
      '--untracked-files=all',
      '--',
      ...packageInputPaths,
    ],
    { cwd: root, encoding: 'utf8' },
  )
  if (status.status !== 0 || status.stdout.trim()) {
    throw new Error(
      `Avalonia package inputs must match the exact committed candidate: ${status.stdout.trim() || status.stderr.trim()}`,
    )
  }
}

export const currentIdentity = ({ requireCleanPackageInputs = false } = {}) => {
  if (requireCleanPackageInputs) assertCleanPackageInputs()
  const gitHead = spawnSync('git', ['rev-parse', 'HEAD^{tree}'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (gitHead.status !== 0) {
    throw new Error(
      'Avalonia stable readiness cannot resolve the current candidate',
    )
  }
  const contractHash = digest(
    fs.readFileSync(
      path.join(root, 'spec/components/contracts/v2/contract-v2.json'),
      'utf8',
    ),
  )
  return { candidate: gitHead.stdout.trim(), contractHash }
}

export const alignmentHash = (alignment) =>
  digest({
    statuses: alignment.statuses,
    stable: alignment.stable,
    gaps: alignment.gaps,
    consumers: alignment.consumers,
  })

export const deriveReleaseScopeFamilies = (registry) => {
  const byContract = registry?.consumerBindings?.byContract
  if (
    !byContract ||
    typeof byContract !== 'object' ||
    Array.isArray(byContract)
  ) {
    throw new Error('Contract V2 consumer binding authority is missing')
  }
  const contractIds = new Set((registry.contracts ?? []).map(({ id }) => id))
  const bindingIds = Object.keys(byContract)
  if (
    bindingIds.length !== contractIds.size ||
    bindingIds.some((id) => !contractIds.has(id))
  ) {
    throw new Error('Contract V2 consumer binding authority is incomplete')
  }
  const families = bindingIds.map((id) => {
    const family = byContract[id]?.releaseFamily
    if (typeof family !== 'string' || family.length === 0) {
      throw new Error(
        `Contract V2 consumer binding ${id} releaseFamily missing`,
      )
    }
    return family
  })
  return [...new Set(families)].sort()
}

export const readContractRegistry = (
  relativePath = 'spec/components/contracts/v2/contract-v2.json',
) => {
  const registryPath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(root, relativePath)
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  if (registry.schemaVersion !== 2) {
    throw new Error('Contract V2 registry schema invalid')
  }
  const releaseScopeFamilies = deriveReleaseScopeFamilies(registry)
  if (
    JSON.stringify(registry.consumerBindings?.releaseScopeFamilies) !==
    JSON.stringify(releaseScopeFamilies)
  ) {
    throw new Error('Contract V2 generated release scope projection is stale')
  }
  return { registry, releaseScopeFamilies }
}

export const deriveStableConsumers = (
  registry,
  { statuses, stable, webOnly, gaps },
) => {
  const byContract = registry.consumerBindings?.byContract
  const releaseScopeFamilies = deriveReleaseScopeFamilies(registry)
  const componentStatuses = statuses.filter((entry) =>
    entry.id.startsWith('component-v2.'),
  )
  const statusByContract = new Map(
    componentStatuses.map((entry) => [entry.id, entry.status]),
  )
  const contractIds = [...statusByContract.keys()].sort()
  const bindingIds = Object.keys(byContract).sort()
  if (JSON.stringify(bindingIds) !== JSON.stringify(contractIds)) {
    throw new Error('Contract V2 alignment consumer contracts are incomplete')
  }
  const galleryStableContractsByRoute = {}
  for (const contractId of stable) {
    if (!contractId.startsWith('component-v2.')) continue
    const route = byContract[contractId]?.galleryRoute
    if (!route) {
      throw new Error(`Contract V2 alignment ${contractId} Gallery route missing`)
    }
    ;(galleryStableContractsByRoute[route] ??= []).push(contractId)
  }
  for (const contracts of Object.values(galleryStableContractsByRoute)) {
    contracts.sort()
  }
  const contractsByFamily = new Map(
    releaseScopeFamilies.map((family) => [family, []]),
  )
  for (const contractId of contractIds) {
    const binding = byContract[contractId]
    const contracts = contractsByFamily.get(binding.releaseFamily)
    if (!contracts || !binding.galleryRoute) {
      throw new Error(`Contract V2 alignment ${contractId} consumer binding invalid`)
    }
    contracts.push(contractId)
  }
  const releaseStableFamilies = []
  const releaseFamilyGaps = []
  for (const family of releaseScopeFamilies) {
    const contracts = contractsByFamily.get(family).sort()
    const blockingContracts = contracts.filter(
      (contractId) =>
        !['aligned', 'web-only'].includes(statusByContract.get(contractId)),
    )
    if (blockingContracts.length === 0) releaseStableFamilies.push(family)
    else releaseFamilyGaps.push({ family, blockingContracts })
  }
  const fullSurfaceReleaseReady =
    gaps.length === 0 && releaseFamilyGaps.length === 0
  return {
    galleryStableContractIds: stable.filter((id) =>
      id.startsWith('component-v2.'),
    ),
    galleryStableRoutes: Object.keys(galleryStableContractsByRoute).sort(),
    galleryStableContractsByRoute,
    docsSupportContractIds: stable,
    webOnlyContractIds: webOnly,
    releaseScopeFamilies,
    releaseStableFamilies,
    releaseFamilyGaps,
    alignmentGapCount: gaps.length,
    conformanceIntegrityReady: true,
    stableSubsetEligible: stable.length > 0,
    fullSurfaceReleaseReady,
    nugetStableEligible: fullSurfaceReleaseReady,
    releaseReady: fullSurfaceReleaseReady,
  }
}

export const readAlignment = (relativePath, expected) => {
  const alignmentPath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(root, relativePath)
  if (!fs.existsSync(alignmentPath)) {
    throw new Error(
      `${relativePath} is missing; run the governed producer "pnpm run conformance:v2" before governance:check`,
    )
  }
  const alignment = JSON.parse(fs.readFileSync(alignmentPath, 'utf8'))
  if (alignment.schema !== 'fsusui.alignment.v2') {
    throw new Error('Contract V2 alignment artifact schema invalid')
  }
  if (!Array.isArray(alignment.statuses)) {
    throw new Error('Contract V2 alignment statuses missing')
  }
  const calculatedAlignmentHash = alignmentHash(alignment)
  for (const field of ['candidate', 'contractHash']) {
    if (alignment.identity?.[field] !== expected[field]) {
      throw new Error(
        `Contract V2 alignment identity ${field} is stale; rerun "pnpm run conformance:v2"`,
      )
    }
  }
  if (
    !alignment.identity ||
    alignment.identity.alignmentHash !== calculatedAlignmentHash
  ) {
    throw new Error('Contract V2 alignment artifact integrity hash is invalid')
  }
  return alignment
}

export const readStableConsumerAuthority = ({
  registryPath = 'spec/components/contracts/v2/contract-v2.json',
  alignmentPath = '.tmp/conformance-v2/alignment.json',
  expected = currentIdentity(),
} = {}) => {
  const { registry, releaseScopeFamilies } = readContractRegistry(registryPath)
  const alignment = readAlignment(alignmentPath, expected)
  const consumers = deriveStableConsumers(registry, alignment)
  if (JSON.stringify(alignment.consumers) !== JSON.stringify(consumers)) {
    throw new Error(
      'Contract V2 alignment consumers do not match exact derived authority',
    )
  }
  evaluateStableRelease(alignment)
  return { alignment, registry, releaseScopeFamilies }
}

export const evaluateStableRelease = (alignment) => {
  const missingReleaseFamilies = alignment.consumers?.releaseFamilyGaps ?? []
  const alignmentGapCount = alignment.consumers?.alignmentGapCount
  if (alignmentGapCount !== alignment.gaps.length) {
    throw new Error(
      'Avalonia stable readiness alignment gap diagnostic is inconsistent',
    )
  }
  const releaseReady =
    alignmentGapCount === 0 && missingReleaseFamilies.length === 0
  const statusById = new Map()
  for (const entry of alignment.statuses ?? []) {
    if (entry.source !== 'derived' || statusById.has(entry.id)) {
      throw new Error('Avalonia stable readiness statuses are not uniquely derived')
    }
    statusById.set(entry.id, entry.status)
  }
  for (const id of alignment.stable ?? []) {
    if (statusById.get(id) !== 'aligned') {
      throw new Error(`Avalonia stable subset leaks non-aligned contract ${id}`)
    }
  }
  const expectedGaps = [...statusById]
    .filter(([, status]) => ['partial', 'missing', 'blocked'].includes(status))
    .map(([id]) => id)
    .sort()
  const actualGaps = (alignment.gaps ?? []).map((gap) => gap.contract).sort()
  if (JSON.stringify(actualGaps) !== JSON.stringify(expectedGaps)) {
    throw new Error('Avalonia stable readiness gap structure is incomplete')
  }
  for (const gap of alignment.gaps ?? []) {
    if (
      !gap.reason ||
      !gap.owner ||
      !Array.isArray(gap.requiredScenarios) ||
      gap.requiredScenarios.length === 0 ||
      !Array.isArray(gap.requiredEvidence) ||
      gap.requiredEvidence.length === 0 ||
      gap.evidencePolicy?.realExecution !== true ||
      gap.evidencePolicy?.allowSkip !== false ||
      gap.evidencePolicy?.allowOverrideWithoutGovernance !== false
    ) {
      throw new Error(`Avalonia stable readiness gap ${gap.contract} is ungoverned`)
    }
  }
  if (
    alignment.consumers?.nugetStableEligible !== releaseReady ||
    alignment.consumers?.releaseReady !== releaseReady ||
    alignment.consumers?.fullSurfaceReleaseReady !== releaseReady ||
    alignment.consumers?.conformanceIntegrityReady !== true ||
    alignment.consumers?.stableSubsetEligible !==
      ((alignment.stable ?? []).length > 0)
  ) {
    throw new Error(
      'Avalonia stable readiness consumers do not match derived alignment',
    )
  }
  return { alignmentGapCount, missingReleaseFamilies, releaseReady }
}

export const requireNugetStableRelease = (alignment) => {
  const release = evaluateStableRelease(alignment)
  if (!release.releaseReady || alignment.consumers?.nugetStableEligible !== true) {
    throw new Error('NuGet stable candidate blocked by derived alignment gaps')
  }
  return release
}

export const validateNugetPackageAlignment = (
  alignment,
  { stablePublication = false } = {},
) =>
  stablePublication
    ? requireNugetStableRelease(alignment)
    : evaluateStableRelease(alignment)

export const createPackageAlignmentBinding = (alignment, artifactBytes) => ({
  candidate: alignment.identity.candidate,
  contractHash: alignment.identity.contractHash,
  alignmentHash: alignment.identity.alignmentHash,
  stableContractIds: alignment.stable,
  governedGapCount: alignment.gaps.length,
  artifact: 'contract-v2-alignment.json',
  artifactBytes: artifactBytes.length,
  artifactSha256: digest(artifactBytes),
})

export const validatePackageAlignmentBinding = (
  binding,
  artifactBytes,
  { candidate },
) => {
  const alignment = JSON.parse(artifactBytes)
  if (
    binding?.artifact !== 'contract-v2-alignment.json' ||
    binding.candidate !== candidate ||
    alignment.identity?.candidate !== candidate ||
    artifactBytes.length !== binding.artifactBytes ||
    digest(artifactBytes) !== binding.artifactSha256 ||
    alignment.identity?.contractHash !== binding.contractHash ||
    alignment.identity?.alignmentHash !== alignmentHash(alignment) ||
    alignment.identity.alignmentHash !== binding.alignmentHash ||
    JSON.stringify(alignment.stable) !==
      JSON.stringify(binding.stableContractIds) ||
    alignment.gaps?.length !== binding.governedGapCount
  ) {
    throw new Error(
      'Package manifest Contract V2 alignment artifact is stale or tampered.',
    )
  }
  evaluateStableRelease(alignment)
  return alignment
}
