import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const SUPPORTED_FRESHNESS_DATASOURCES = new Set([
  'dotnet-version',
  'github-releases',
  'github-tags',
  'node-version',
  'npm',
  'nuget',
])

function readJson(root, relative) {
  const file = path.resolve(root, relative)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

function readText(root, relative) {
  const file = path.resolve(root, relative)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

function escaped(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function exactOne(values) {
  const unique = [...new Set(values.filter(Boolean))]
  return unique.length === 1 ? unique[0] : null
}

function versionsFromFiles(entry, root, pattern) {
  const values = []
  for (const relative of entry.files ?? []) {
    const text = readText(root, relative)
    if (!text) return null
    const matches = [...text.matchAll(pattern)].map((match) => match[1])
    if (matches.length === 0) return null
    values.push(...matches)
  }
  return exactOne(values)
}

function currentNpm(entry, root) {
  if (entry.id === 'pnpm-package-manager') {
    const versions = (entry.files ?? []).map((relative) => {
      const packageJson = readJson(root, relative)
      return packageJson?.packageManager?.match(/^pnpm@(.+)$/u)?.[1] ?? null
    })
    if (versions.some((version) => !version)) return null
    return exactOne(versions)
  }
  const authority = readJson(root, 'config/dependencies/npm-authority.json')
  return authority?.install?.[entry.authorityKey ?? entry.packageName] ?? null
}

function currentNuget(entry, root) {
  const content = readText(root, 'dotnet/Directory.Packages.props')
  if (!content) return null
  const match = content.match(
    new RegExp(
      `<PackageVersion\\s+Include="${escaped(entry.packageName)}"\\s+Version="([^"]+)"\\s*/>`,
      'iu',
    ),
  )
  return match?.[1] ?? null
}

function currentGithubTag(entry, root) {
  const packageName = escaped(entry.packageName)
  return versionsFromFiles(
    entry,
    root,
    new RegExp(`\\buses:\\s*${packageName}@([^\\s#]+)`, 'gu'),
  )
}

function currentGithubRelease(entry, root) {
  const sourceAction =
    entry.packageName === 'emscripten-core/emsdk'
      ? 'emscripten-core/setup-emsdk'
      : entry.packageName
  const packageName = escaped(sourceAction)
  return versionsFromFiles(
    entry,
    root,
    new RegExp(
      `uses:\\s*${packageName}@[^\\s]+[\\s\\S]{0,160}?\\bversion:\\s*['"]?(\\d+(?:\\.\\d+){1,3})['"]?`,
      'gu',
    ),
  )
}

function currentDotnet(entry, root) {
  if (entry.packageName === 'dotnet-sdk') {
    return readJson(root, 'dotnet/global.json')?.sdk?.version ?? null
  }
  if (entry.packageName === 'dotnet-runtime') {
    return versionsFromFiles(
      entry,
      root,
      /<TargetFramework>net(\d+(?:\.\d+)?)<\/TargetFramework>/gu,
    )
  }
  return null
}

function nodeMajor(value) {
  return String(value ?? '').match(/\d+/u)?.[0] ?? null
}

function currentNode(entry, root) {
  if (entry.id === 'node-runtime') {
    const nvm = readText(root, '.nvmrc')?.trim()
    const engine = readJson(root, 'package.json')?.engines?.node
    return exactOne([nodeMajor(nvm), nodeMajor(engine)])
  }
  if (entry.id === 'github-actions-node-runtime') {
    const value = versionsFromFiles(
      entry,
      root,
      /\bnode-version:\s*['"]?(\d+(?:\.\d+){0,2})['"]?/gu,
    )
    if (value) return nodeMajor(value)
    const majors = []
    for (const relative of entry.files ?? []) {
      const text = readText(root, relative)
      if (!text) return null
      for (const match of text.matchAll(
        /\bnode-version:\s*['"]?(\d+(?:\.\d+){0,2})['"]?/gu,
      )) {
        majors.push(nodeMajor(match[1]))
      }
    }
    return exactOne(majors)
  }
  return null
}

export function resolveCurrentVersion(entry, root) {
  if (entry?.datasource === 'npm') return currentNpm(entry, root)
  if (entry?.datasource === 'nuget') return currentNuget(entry, root)
  if (entry?.datasource === 'github-tags') return currentGithubTag(entry, root)
  if (entry?.datasource === 'github-releases')
    return currentGithubRelease(entry, root)
  if (entry?.datasource === 'dotnet-version') return currentDotnet(entry, root)
  if (entry?.datasource === 'node-version') return currentNode(entry, root)
  return null
}

function numericVersion(value) {
  const normalized = String(value ?? '')
    .replace(/^v/u, '')
    .split('+')[0]
  if (!/^\d+(?:\.\d+){0,3}$/u.test(normalized)) return null
  return normalized.split('.').map(Number)
}

function compareNumericVersions(left, right) {
  const size = Math.max(left.length, right.length)
  for (let index = 0; index < size; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function latestStableVersion(versions, currentVersion = null) {
  const candidates = (versions ?? [])
    .map((value) => ({ raw: String(value), numeric: numericVersion(value) }))
    .filter((entry) => entry.numeric)
    .sort((left, right) => compareNumericVersions(right.numeric, left.numeric))
  if (candidates.length === 0) return null
  const selected = candidates[0].numeric
  const precision = numericVersion(currentVersion)?.length ?? selected.length
  return selected.slice(0, precision).join('.')
}

function latestDotnet(entry, index) {
  const channels = (index?.['releases-index'] ?? []).filter(
    (candidate) =>
      ['active', 'maintenance'].includes(candidate?.['support-phase']) &&
      numericVersion(candidate?.['channel-version']),
  )
  channels.sort((left, right) =>
    compareNumericVersions(
      numericVersion(right['channel-version']),
      numericVersion(left['channel-version']),
    ),
  )
  const selected = channels[0]
  if (!selected) return null
  return entry.packageName === 'dotnet-runtime'
    ? (selected['channel-version'] ?? null)
    : (selected['latest-sdk'] ?? null)
}

function latestNode(index, currentVersion) {
  const latestLts = (index ?? []).find(
    (candidate) =>
      candidate?.lts !== false && numericVersion(candidate?.version),
  )?.version
  return latestLts ? latestStableVersion([latestLts], currentVersion) : null
}

export function resolveLatestVersion(
  entry,
  currentVersion,
  { npm, nuget, githubTags, githubReleases, dotnet, node } = {},
) {
  if (entry?.datasource === 'npm') return npm?.(entry.packageName) ?? null
  if (entry?.datasource === 'nuget')
    return latestStableVersion(nuget?.(entry.packageName))
  if (entry?.datasource === 'github-tags')
    return latestStableVersion(githubTags?.(entry.packageName), currentVersion)
  if (entry?.datasource === 'github-releases')
    return latestStableVersion(githubReleases?.(entry.packageName))
  if (entry?.datasource === 'dotnet-version')
    return latestDotnet(entry, dotnet?.())
  if (entry?.datasource === 'node-version')
    return latestNode(node?.(), currentVersion)
  return null
}
