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
    .update(typeof value === 'string' ? value : stableJson(value))
    .digest('hex')

export const currentIdentity = () => {
  const gitHead = spawnSync('git', ['rev-parse', 'HEAD'], {
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
  if (
    JSON.stringify(alignment.consumers?.releaseScopeFamilies) !==
    JSON.stringify(releaseScopeFamilies)
  ) {
    throw new Error(
      'Contract V2 alignment release scope does not match consumer binding authority',
    )
  }
  return { alignment, registry, releaseScopeFamilies }
}

export const evaluateStableRelease = (
  alignment,
  { diagnostic = false } = {},
) => {
  const missingReleaseFamilies = alignment.consumers?.releaseFamilyGaps ?? []
  const alignmentGapCount = alignment.consumers?.alignmentGapCount
  if (alignmentGapCount !== alignment.gaps.length) {
    throw new Error(
      'Avalonia stable readiness alignment gap diagnostic is inconsistent',
    )
  }
  const releaseReady =
    alignmentGapCount === 0 && missingReleaseFamilies.length === 0
  if (
    alignment.consumers?.nugetStableEligible !== releaseReady ||
    alignment.consumers?.releaseReady !== releaseReady
  ) {
    throw new Error(
      'Avalonia stable readiness consumers do not match derived alignment',
    )
  }
  if (!releaseReady && !diagnostic) {
    throw new Error(
      `Avalonia stable readiness blocked by ${alignmentGapCount} alignment gaps and ${missingReleaseFamilies.length} missing release families`,
    )
  }
  return { alignmentGapCount, missingReleaseFamilies, releaseReady }
}
