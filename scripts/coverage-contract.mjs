import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function sha256File(path) {
  return sha256(readFileSync(path))
}

export function validateShardManifests(manifests, options = {}) {
  if (!Array.isArray(manifests) || manifests.length === 0)
    throw new Error('coverage merge requires at least one shard manifest')
  const expectedTotal = manifests[0].total
  if (!Number.isInteger(expectedTotal) || expectedTotal < 2)
    throw new Error('sharded coverage manifest total must be at least 2')
  if (manifests.length !== expectedTotal)
    throw new Error(
      `coverage shards incomplete: expected ${expectedTotal}, found ${manifests.length}`,
    )

  const indexes = new Set()
  const reference = manifests[0]
  if (options.expectedIdentity) {
    for (const field of [
      'commitSha',
      'configDigest',
      'selectionDigest',
      'toolchainDigest',
    ]) {
      if (reference[field] !== options.expectedIdentity[field])
        throw new Error(`coverage shards are stale for current ${field}`)
    }
  }
  for (const manifest of manifests) {
    if (manifest.schemaVersion !== 1)
      throw new Error('unsupported coverage shard manifest schema')
    if (manifest.total !== expectedTotal)
      throw new Error('coverage shard totals do not match')
    if (
      !Number.isInteger(manifest.index) ||
      manifest.index < 1 ||
      manifest.index > expectedTotal
    )
      throw new Error(`invalid coverage shard index ${manifest.index}`)
    if (indexes.has(manifest.index))
      throw new Error(
        `duplicate coverage shard ${manifest.index}/${expectedTotal}`,
      )
    indexes.add(manifest.index)
    for (const field of [
      'commitSha',
      'configDigest',
      'selectionDigest',
      'toolchainDigest',
    ]) {
      if (!manifest[field] || manifest[field] !== reference[field])
        throw new Error(`coverage shard ${field} does not match`)
    }
    if (manifest.thresholdsApplied !== false)
      throw new Error(
        'a shard manifest cannot claim final coverage threshold success',
      )
    if (
      !(
        Number.isFinite(manifest.durationSeconds) &&
        manifest.durationSeconds >= 0
      )
    )
      throw new Error('coverage shard duration is invalid')
  }
  for (let index = 1; index <= expectedTotal; index += 1) {
    if (!indexes.has(index))
      throw new Error(`missing coverage shard ${index}/${expectedTotal}`)
  }

  const durationBudgetSeconds =
    options.durationBudgetSeconds ?? reference.durationBudgetSeconds
  const allowOverThreshold = options.allowOverThreshold === true
  if (
    durationBudgetSeconds !== undefined &&
    durationBudgetSeconds !== null &&
    !allowOverThreshold &&
    manifests.some(
      (manifest) => manifest.durationSeconds > durationBudgetSeconds,
    )
  )
    throw new Error(
      `coverage shard exceeded duration budget ${durationBudgetSeconds}s`,
    )

  if (options.rootDir) {
    for (const manifest of manifests) {
      for (const [pathField, digestField] of [
        ['blobPath', 'blobDigest'],
        ['coverageFragmentPath', 'coverageFragmentDigest'],
      ]) {
        const artifact = resolve(options.rootDir, manifest[pathField])
        if (!existsSync(artifact))
          throw new Error(
            `coverage shard artifact missing: ${manifest[pathField]}`,
          )
        if (sha256File(artifact) !== manifest[digestField])
          throw new Error(
            `coverage shard artifact digest mismatch: ${manifest[pathField]}`,
          )
      }
    }
  }
  return { total: expectedTotal, reference }
}

export function assertFinalThresholdResult(exitCode) {
  if (exitCode !== 0) throw new Error('merged coverage thresholds failed')
}
