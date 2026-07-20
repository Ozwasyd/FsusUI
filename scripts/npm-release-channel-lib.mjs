import { appendFileSync, readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { resolveNpmDistTag } from './resolve-npm-dist-tag.mjs'

export const npmRegistry = 'https://registry.npmjs.org/'

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u

export function parseReleaseVersion(version) {
  const normalized = version.trim()
  const match = normalized.match(semverPattern)
  if (!match) throw new Error(`Invalid release version "${version}".`)
  return {
    raw: normalized,
    core: match.slice(1, 4).map(BigInt),
    prerelease: match[4]?.split('.') ?? [],
  }
}

function compareIdentifier(left, right) {
  const leftNumeric = /^\d+$/u.test(left)
  const rightNumeric = /^\d+$/u.test(right)
  if (leftNumeric && rightNumeric) {
    const leftNumber = BigInt(left)
    const rightNumber = BigInt(right)
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1
  }
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
  return left === right ? 0 : left < right ? -1 : 1
}

export function compareReleaseVersions(leftVersion, rightVersion) {
  const left = parseReleaseVersion(leftVersion)
  const right = parseReleaseVersion(rightVersion)
  for (let index = 0; index < left.core.length; index += 1) {
    if (left.core[index] !== right.core[index])
      return left.core[index] < right.core[index] ? -1 : 1
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0
    return left.prerelease.length === 0 ? 1 : -1
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index]
    const rightPart = right.prerelease[index]
    if (leftPart === undefined || rightPart === undefined) {
      return leftPart === rightPart ? 0 : leftPart === undefined ? -1 : 1
    }
    const comparison = compareIdentifier(leftPart, rightPart)
    if (comparison !== 0) return Math.sign(comparison)
  }
  return 0
}

function sanitizeLockPart(value) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//u, '')
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
}

export function createReleasePlan({
  packageName,
  version,
  registry = npmRegistry,
}) {
  if (!packageName?.trim()) throw new Error('Package name is required.')
  const normalizedRegistry = new URL(registry).href
  if (normalizedRegistry !== npmRegistry) {
    throw new Error(`Unsupported npm registry ${normalizedRegistry}.`)
  }
  parseReleaseVersion(version)
  const distTag = resolveNpmDistTag(version)
  const resource = `${normalizedRegistry}:${packageName.trim()}:${distTag}`
  return {
    registry: normalizedRegistry,
    packageName: packageName.trim(),
    version: version.trim(),
    distTag,
    resource,
    concurrencyGroup: `publish-npm-${sanitizeLockPart(normalizedRegistry)}-${sanitizeLockPart(packageName)}-${sanitizeLockPart(distTag)}`,
  }
}

export function assertCandidateMatchesPlan(manifestPath, plan) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const actual = {
    registry: new URL(manifest.metadata?.registry ?? '').href,
    packageName: manifest.package?.name,
    version: manifest.package?.version,
    distTag: manifest.package?.distTag,
  }
  for (const field of Object.keys(actual)) {
    if (actual[field] !== plan[field]) {
      throw new Error(
        `Candidate ${field} mismatch: planned ${plan[field]}, got ${actual[field]}.`,
      )
    }
  }
  return manifest
}

export function checkChannelMonotonicity({
  candidate,
  current,
  candidateExists,
  mode = 'automatic',
  reason,
  expectedCurrent,
}) {
  const candidateChannel = resolveNpmDistTag(candidate)

  if (mode === 'recovery') {
    if (!reason || reason.trim().length < 10)
      throw new Error('Recovery requires a reason of at least 10 characters.')
    if (!current)
      throw new Error('Recovery requires a current channel version.')
    if (!expectedCurrent || expectedCurrent !== current) {
      throw new Error(
        `Recovery expected current ${expectedCurrent || '<missing>'}, got ${current}.`,
      )
    }
    if (!candidateExists)
      throw new Error('Recovery target must already exist on npm.')
    return {
      allowed: true,
      action:
        compareReleaseVersions(candidate, current) === 0 ? 'skip' : 'recover',
      channel: candidateChannel,
    }
  }

  if (mode !== 'automatic') throw new Error(`Unsupported mode ${mode}.`)
  if (current) {
    const currentChannel = resolveNpmDistTag(current)
    if (currentChannel !== candidateChannel) {
      throw new Error(
        `Current ${current} belongs to ${currentChannel}, not ${candidateChannel}.`,
      )
    }
  }
  if (!current) {
    if (candidateExists) {
      throw new Error(
        'Candidate already exists but the resolved dist-tag is unset; use manual recovery.',
      )
    }
    return { allowed: true, action: 'publish', channel: candidateChannel }
  }

  const comparison = compareReleaseVersions(candidate, current)
  if (comparison < 0) {
    throw new Error(
      `Candidate ${candidate} would move ${candidateChannel} backward from ${current}.`,
    )
  }
  if (comparison === 0) {
    if (!candidateExists) {
      throw new Error(
        `The ${candidateChannel} tag points to missing version ${candidate}.`,
      )
    }
    return { allowed: true, action: 'skip', channel: candidateChannel }
  }
  if (candidateExists) {
    throw new Error(
      `Candidate ${candidate} exists but ${candidateChannel} points to ${current}; use manual recovery.`,
    )
  }
  return { allowed: true, action: 'publish', channel: candidateChannel }
}

export function writeGithubOutputs(values) {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) throw new Error('GITHUB_OUTPUT is not set.')
  appendFileSync(
    outputPath,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('\n')}\n`,
  )
}
