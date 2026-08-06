/**
 * Shared npm authority load + projection helpers for deps:sync / prepare-npm-package.
 * External dependency versions must come only from config/dependencies/npm-authority.json.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(scriptDir, '..')

export const AUTHORITY_REL = 'config/dependencies/npm-authority.json'
export const SCHEMA_REL = 'config/dependencies/npm-authority.schema.json'

export const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

export const PUBLISHED_PACKAGE_REL = 'vue/packages/element-plus/package.json'

/** Consumer install fixtures projected from authority install / consumerProfiles. */
export const CONSUMER_FIXTURE_RELS = [
  'vue/tests/consumer-install/template/package.json',
]

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.tmp',
  'playwright-report',
  'coverage',
  'bin',
  'obj',
])

export function readJson(relativeOrAbsolute, root = repoRoot) {
  const absolute = path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.join(root, relativeOrAbsolute)
  return JSON.parse(readFileSync(absolute, 'utf8'))
}

export function loadAuthority(root = repoRoot) {
  return readJson(AUTHORITY_REL, root)
}

export function isWorkspaceSpecifier(version) {
  return typeof version === 'string' && version.startsWith('workspace:')
}

/**
 * Detect npm: alias form in a published range, e.g.
 * `npm:@sxzz/popperjs-es@^2.11.7` → package `@sxzz/popperjs-es`.
 */
export function parseNpmAliasRange(range) {
  if (typeof range !== 'string' || !range.startsWith('npm:')) return null
  const body = range.slice('npm:'.length)
  const at = body.lastIndexOf('@')
  if (at <= 0) return null
  return {
    aliasTarget: body.slice(0, at),
    range: body.slice(at + 1),
  }
}

/** Install exact specifier for a package id (may be npm: alias @ exact pin). */
export function projectInstallSpecifier(packageId, authority) {
  const pin = authority.install[packageId]
  if (!pin) {
    throw new Error(
      `Package "${packageId}" is not registered in authority.install`,
    )
  }

  for (const field of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    const published = authority.published?.[field]?.[packageId]
    const alias = parseNpmAliasRange(published)
    if (alias) {
      return `npm:${alias.aliasTarget}@${pin}`
    }
  }

  return pin
}

/** Published range as declared in authority (peer / dependency / optional). */
export function projectPublishedSpecifier(packageId, field, authority) {
  const range = authority.published?.[field]?.[packageId]
  if (range === undefined) {
    throw new Error(
      `Package "${packageId}" missing from authority.published.${field}`,
    )
  }
  return range
}

export function sortObjectKeys(object) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    return object
  }
  const sorted = {}
  for (const key of Object.keys(object).sort()) {
    sorted[key] = object[key]
  }
  return sorted
}

export function serializePackageJson(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

export function writePackageJson(absolutePath, manifest) {
  writeFileSync(absolutePath, serializePackageJson(manifest))
}

/**
 * Project external dependency fields on a package.json object.
 *
 * @param {'root'|'workspace'|'published-source'|'consumer-fixture'} role
 * @param {object} [options]
 * @param {string} [options.consumerProfile] profile name under consumerProfiles
 */
export function projectManifestDependencies(
  manifest,
  authority,
  role,
  options = {},
) {
  const next = structuredClone(manifest)

  if (role === 'published-source') {
    projectPublishedSource(next, authority)
  } else if (role === 'consumer-fixture') {
    projectConsumerFixture(next, authority, options.consumerProfile)
  } else {
    projectWorkspaceOrRoot(next, authority)
  }

  for (const field of DEPENDENCY_FIELDS) {
    if (next[field] && Object.keys(next[field]).length === 0) {
      delete next[field]
    } else if (next[field]) {
      next[field] = sortObjectKeys(next[field])
    }
  }

  return next
}

function projectPublishedSource(manifest, authority) {
  const workspaceDeps = {}
  for (const [id, version] of Object.entries(manifest.dependencies || {})) {
    if (isWorkspaceSpecifier(version)) {
      workspaceDeps[id] = version
    }
  }

  const dependencies = { ...workspaceDeps }
  for (const [id, range] of Object.entries(
    authority.published.dependencies || {},
  )) {
    dependencies[id] = range
  }
  manifest.dependencies = dependencies

  const optional = { ...(authority.published.optionalDependencies || {}) }
  // preserve workspace optional if any
  for (const [id, version] of Object.entries(
    manifest.optionalDependencies || {},
  )) {
    if (isWorkspaceSpecifier(version)) {
      optional[id] = version
    }
  }
  if (Object.keys(optional).length > 0) {
    manifest.optionalDependencies = optional
  } else {
    delete manifest.optionalDependencies
  }

  manifest.peerDependencies = {
    ...(authority.published.peerDependencies || {}),
  }

  // devDependencies: exact install pins only for external packages already listed
  if (manifest.devDependencies) {
    const dev = {}
    for (const [id, version] of Object.entries(manifest.devDependencies)) {
      if (isWorkspaceSpecifier(version)) {
        dev[id] = version
      } else {
        dev[id] = projectInstallSpecifier(id, authority)
      }
    }
    manifest.devDependencies = dev
  }
}

function projectWorkspaceOrRoot(manifest, authority) {
  for (const field of DEPENDENCY_FIELDS) {
    const current = manifest[field]
    if (!current) continue
    const next = {}
    for (const [id, version] of Object.entries(current)) {
      if (isWorkspaceSpecifier(version)) {
        next[id] = version
        continue
      }
      if (
        field === 'peerDependencies' &&
        authority.published?.peerDependencies?.[id] !== undefined
      ) {
        next[id] = authority.published.peerDependencies[id]
        continue
      }
      next[id] = projectInstallSpecifier(id, authority)
    }
    manifest[field] = next
  }
}

function projectConsumerFixture(manifest, authority, profileName) {
  const profilePackages =
    (profileName && authority.consumerProfiles?.[profileName]?.packages) || {}

  for (const field of DEPENDENCY_FIELDS) {
    const current = manifest[field]
    if (!current) continue
    const next = {}
    for (const [id, version] of Object.entries(current)) {
      if (isWorkspaceSpecifier(version)) {
        next[id] = version
        continue
      }
      if (profilePackages[id] !== undefined) {
        next[id] = profilePackages[id]
        continue
      }
      next[id] = projectInstallSpecifier(id, authority)
    }
    manifest[field] = next
  }
}

/**
 * Build published-facing dependency fields for a package candidate (same projection
 * as published-source external fields after workspace handling).
 */
export function projectPublishedExternalFields(authority) {
  return {
    dependencies: sortObjectKeys({
      ...(authority.published.dependencies || {}),
    }),
    peerDependencies: sortObjectKeys({
      ...(authority.published.peerDependencies || {}),
    }),
    optionalDependencies: sortObjectKeys({
      ...(authority.published.optionalDependencies || {}),
    }),
  }
}

export function applyPublishedExternalFields(packageJson, authority) {
  const projected = projectPublishedExternalFields(authority)
  const workspaceDeps = {}
  for (const [id, version] of Object.entries(packageJson.dependencies || {})) {
    if (isWorkspaceSpecifier(version)) {
      workspaceDeps[id] = version
    }
  }
  packageJson.dependencies = sortObjectKeys({
    ...workspaceDeps,
    ...projected.dependencies,
  })
  packageJson.peerDependencies = projected.peerDependencies
  if (Object.keys(projected.optionalDependencies).length > 0) {
    packageJson.optionalDependencies = projected.optionalDependencies
  } else {
    delete packageJson.optionalDependencies
  }
  return packageJson
}

export function walkPackageJsonFiles(rootDir, out = []) {
  let entries
  try {
    entries = readdirSync(rootDir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (SKIP_DIR_NAMES.has(name)) continue
    const absolute = path.join(rootDir, name)
    let st
    try {
      st = statSync(absolute)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      walkPackageJsonFiles(absolute, out)
    } else if (name === 'package.json') {
      out.push(absolute)
    }
  }
  return out
}

export function toPosixRel(absolutePath, root = repoRoot) {
  return path.relative(root, absolutePath).split(path.sep).join('/')
}

export function classifyManifestRole(relativePath) {
  if (relativePath === 'package.json') return 'root'
  if (relativePath === PUBLISHED_PACKAGE_REL) return 'published-source'
  if (CONSUMER_FIXTURE_RELS.includes(relativePath)) return 'consumer-fixture'
  if (
    relativePath.startsWith('vue/packages/') ||
    relativePath.startsWith('vue/internal/')
  ) {
    return 'workspace'
  }
  return null
}

/**
 * Controlled manifests: root, workspace packages under vue/, and known consumer fixtures.
 * Skips node_modules/dist and non-workspace fixture trees (e.g. public-api baseline snapshots).
 */
export function listControlledManifests(root = repoRoot) {
  const found = new Set()

  found.add(path.join(root, 'package.json'))

  for (const workspaceRoot of ['vue/packages', 'vue/internal']) {
    const absoluteRoot = path.join(root, workspaceRoot)
    for (const absolute of walkPackageJsonFiles(absoluteRoot)) {
      found.add(absolute)
    }
  }

  for (const rel of CONSUMER_FIXTURE_RELS) {
    const absolute = path.join(root, rel)
    // Only include existing fixtures here; syncAllManifests enforces presence.
    try {
      statSync(absolute)
      found.add(absolute)
    } catch {
      // missing — reported by syncAllManifests
    }
  }

  return [...found]
    .map((absolute) => ({
      absolute,
      relative: toPosixRel(absolute, root),
      role: classifyManifestRole(toPosixRel(absolute, root)),
    }))
    .filter((entry) => entry.role !== null)
    .sort((a, b) => a.relative.localeCompare(b.relative))
}

export function syncManifestFile(entry, authority, options = {}) {
  const originalText = readFileSync(entry.absolute, 'utf8')
  const manifest = JSON.parse(originalText)
  const projected = projectManifestDependencies(
    manifest,
    authority,
    entry.role,
    {
      consumerProfile:
        entry.role === 'consumer-fixture'
          ? options.consumerProfile || 'npm-latest'
          : undefined,
    },
  )
  const nextText = serializePackageJson(projected)
  const changed = nextText !== originalText
  if (changed && !options.dryRun) {
    writeFileSync(entry.absolute, nextText)
  }
  return { changed, relative: entry.relative, role: entry.role }
}

export function syncAllManifests(root = repoRoot, options = {}) {
  const authority = options.authority || loadAuthority(root)
  const entries = listControlledManifests(root)
  // Required consumer fixtures must exist
  for (const rel of CONSUMER_FIXTURE_RELS) {
    if (!entries.some((entry) => entry.relative === rel)) {
      throw new Error(`Missing controlled consumer fixture: ${rel}`)
    }
  }
  const results = []
  for (const entry of entries) {
    results.push(syncManifestFile(entry, authority, options))
  }
  return results
}
