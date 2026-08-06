/**
 * Read-only npm authority drift checker (deps:check / #408).
 *
 * Does not write files, does not invoke the sync command, does not contact the registry.
 * Drift errors always include file, field, expected, actual.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import {
  AUTHORITY_REL,
  SCHEMA_REL,
  DEPENDENCY_FIELDS,
  PUBLISHED_PACKAGE_REL,
  CONSUMER_FIXTURE_RELS,
  repoRoot,
  loadAuthority,
  readJson,
  isWorkspaceSpecifier,
  parseNpmAliasRange,
  projectManifestDependencies,
  projectPublishedExternalFields,
  listControlledManifests,
  serializePackageJson,
  toPosixRel,
} from './npm-authority-lib.mjs'

const require = createRequire(import.meta.url)
const semver = require('semver')
const Ajv2020 = require('ajv/dist/2020.js')

const LOCKFILE_REL = 'pnpm-lock.yaml'

/** @typedef {{ file: string, field: string, expected: string, actual: string, code?: string }} DriftError */

export function createDriftError(file, field, expected, actual, code) {
  return {
    file,
    field,
    expected: stringifyValue(expected),
    actual: stringifyValue(actual),
    ...(code ? { code } : {}),
  }
}

function stringifyValue(value) {
  if (value === undefined) return '<undefined>'
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function formatDriftError(error) {
  const code = error.code ? ` code=${error.code}` : ''
  return `[deps:check] FAIL file=${error.file} field=${error.field} expected=${error.expected} actual=${error.actual}${code}`
}

const EXACT_VERSION_RE =
  /^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$/

export function isExactVersion(version) {
  return typeof version === 'string' && EXACT_VERSION_RE.test(version)
}

/**
 * Forbidden external forms: *, latest, git/file/link/portal, raw URLs, non-npmjs private registries.
 * workspace: is not forbidden (internal). npm: aliases are allowed.
 */
export function isForbiddenSpecifier(version) {
  if (typeof version !== 'string' || version.length === 0) return true
  if (isWorkspaceSpecifier(version)) return false
  if (version === '*' || version === 'latest') return true
  const lower = version.toLowerCase()
  if (
    lower.startsWith('git+') ||
    lower.startsWith('git:') ||
    lower.startsWith('github:') ||
    lower.startsWith('ssh:') ||
    lower.startsWith('file:') ||
    lower.startsWith('link:') ||
    lower.startsWith('portal:') ||
    lower.startsWith('http:') ||
    lower.startsWith('https:')
  ) {
    return true
  }
  // bare protocol-ish forms and private registry hints outside npm: alias
  if (!version.startsWith('npm:') && version.includes('://')) return true
  if (/registry\.(?!npmjs\.org)/i.test(version)) return true
  return false
}

/** Strip npm: alias wrapper → underlying range/version. */
export function effectiveRangeOrVersion(specifier) {
  if (typeof specifier !== 'string') return specifier
  const alias = parseNpmAliasRange(specifier)
  return alias ? alias.range : specifier
}

export function rangeContainsInstall(range, installPin) {
  const effective = effectiveRangeOrVersion(range)
  if (!semver.validRange(effective)) return false
  if (!isExactVersion(installPin)) return false
  return semver.satisfies(installPin, effective, { includePrerelease: true })
}

/**
 * Unique peer-floor (lowest version satisfying the peer range), or null if unresolvable.
 */
export function peerFloorFromRange(range) {
  const effective = effectiveRangeOrVersion(range)
  if (!semver.validRange(effective)) return null
  const min = semver.minVersion(effective)
  return min ? min.version : null
}

/** Extract base semver from pnpm lock version field (e.g. 3.5.32(typescript@…)). */
export function extractLockResolvedVersion(versionField) {
  if (typeof versionField !== 'string' || versionField.length === 0) return null
  if (versionField.startsWith('link:') || versionField.startsWith('file:')) {
    return null
  }
  // typical: "3.5.32(typescript@6.0.2)" or "3.5.32"
  const paren = versionField.indexOf('(')
  const core = paren === -1 ? versionField : versionField.slice(0, paren)
  // if core looks like name@version (packages key style), take after last @
  if (!isExactVersion(core) && core.includes('@')) {
    const ver = core.slice(core.lastIndexOf('@') + 1)
    return isExactVersion(ver) ? ver : null
  }
  return isExactVersion(core) ? core : null
}

function pushError(errors, file, field, expected, actual, code) {
  errors.push(createDriftError(file, field, expected, actual, code))
}

/**
 * Validate authority JSON against schema + internal consistency rules.
 */
export function checkAuthority(root = repoRoot, authorityInput) {
  /** @type {DriftError[]} */
  const errors = []
  const authorityPath = path.join(root, AUTHORITY_REL)
  const schemaPath = path.join(root, SCHEMA_REL)

  if (!existsSync(authorityPath)) {
    pushError(
      errors,
      AUTHORITY_REL,
      '<file>',
      'present',
      'missing',
      'authority-missing',
    )
    return { errors, authority: null }
  }
  if (!existsSync(schemaPath)) {
    pushError(
      errors,
      SCHEMA_REL,
      '<file>',
      'present',
      'missing',
      'schema-missing',
    )
  }

  let authority = authorityInput
  if (!authority) {
    try {
      authority = readJson(AUTHORITY_REL, root)
    } catch (error) {
      pushError(
        errors,
        AUTHORITY_REL,
        '<json>',
        'valid JSON object',
        String(error?.message || error),
        'authority-parse',
      )
      return { errors, authority: null }
    }
  }

  if (existsSync(schemaPath)) {
    try {
      const schema = readJson(SCHEMA_REL, root)
      const ajv = new Ajv2020({ allErrors: true, strict: false })
      const validate = ajv.compile(schema)
      if (!validate(authority)) {
        for (const err of validate.errors || []) {
          const field =
            (err.instancePath || '/')
              .replace(/^\//, '')
              .replace(/\//g, '.') || '<root>'
          pushError(
            errors,
            AUTHORITY_REL,
            field || err.schemaPath,
            err.message || 'schema valid',
            err.data === undefined ? '<undefined>' : err.data,
            'schema',
          )
        }
      }
    } catch (error) {
      pushError(
        errors,
        SCHEMA_REL,
        '<schema>',
        'loadable schema',
        String(error?.message || error),
        'schema-load',
      )
    }
  }

  // Required top-level shape (also covered by schema; keep field-level when schema missing)
  for (const key of [
    'schemaVersion',
    'install',
    'published',
    'consumerProfiles',
  ]) {
    if (authority[key] === undefined) {
      pushError(
        errors,
        AUTHORITY_REL,
        key,
        'present',
        '<undefined>',
        'authority-missing-field',
      )
    }
  }
  if (authority.published) {
    for (const key of [
      'dependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      if (authority.published[key] === undefined) {
        pushError(
          errors,
          AUTHORITY_REL,
          `published.${key}`,
          'present',
          '<undefined>',
          'authority-missing-field',
        )
      }
    }
  }

  if (!authority.install || typeof authority.install !== 'object') {
    return { errors, authority }
  }

  // install pins: exact, not forbidden
  for (const [id, version] of Object.entries(authority.install)) {
    if (!isExactVersion(version)) {
      pushError(
        errors,
        AUTHORITY_REL,
        `install.${id}`,
        'exact semver pin',
        version,
        'install-not-exact',
      )
    }
    if (isForbiddenSpecifier(version)) {
      pushError(
        errors,
        AUTHORITY_REL,
        `install.${id}`,
        'exact non-forbidden pin',
        version,
        'install-forbidden',
      )
    }
  }

  // published ranges: no forbidden forms, must include install (deps/optional)
  for (const field of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    const map = authority.published?.[field] || {}
    for (const [id, range] of Object.entries(map)) {
      if (isForbiddenSpecifier(range)) {
        pushError(
          errors,
          AUTHORITY_REL,
          `published.${field}.${id}`,
          'allowed range form',
          range,
          'published-forbidden',
        )
        continue
      }
      const installPin = authority.install[id]
      if (!installPin) {
        pushError(
          errors,
          AUTHORITY_REL,
          `published.${field}.${id}`,
          'registered install pin',
          '<missing install>',
          'published-unregistered',
        )
        continue
      }
      const effective = effectiveRangeOrVersion(range)
      if (!semver.validRange(effective)) {
        pushError(
          errors,
          AUTHORITY_REL,
          `published.${field}.${id}`,
          'resolvable semver range',
          range,
          'published-unresolvable',
        )
        continue
      }
      if (field === 'peerDependencies') {
        const floor = peerFloorFromRange(range)
        if (!floor) {
          pushError(
            errors,
            AUTHORITY_REL,
            `published.peerDependencies.${id}`,
            'unique peer floor (minVersion)',
            range,
            'peer-floor-unresolvable',
          )
        }
      } else if (!rangeContainsInstall(range, installPin)) {
        pushError(
          errors,
          AUTHORITY_REL,
          `published.${field}.${id}`,
          `range containing install ${installPin}`,
          range,
          'published-range-excludes-install',
        )
      }
    }
  }

  // consumer profiles
  for (const [profileName, profile] of Object.entries(
    authority.consumerProfiles || {},
  )) {
    if (!profile || typeof profile !== 'object') {
      pushError(
        errors,
        AUTHORITY_REL,
        `consumerProfiles.${profileName}`,
        'object with packages',
        profile,
        'consumer-profile-shape',
      )
      continue
    }
    for (const [id, version] of Object.entries(profile.packages || {})) {
      if (!isExactVersion(version)) {
        pushError(
          errors,
          AUTHORITY_REL,
          `consumerProfiles.${profileName}.packages.${id}`,
          'exact version',
          version,
          'consumer-not-exact',
        )
      }
      if (isForbiddenSpecifier(version)) {
        pushError(
          errors,
          AUTHORITY_REL,
          `consumerProfiles.${profileName}.packages.${id}`,
          'non-forbidden exact',
          version,
          'consumer-forbidden',
        )
      }
      const registered =
        authority.install[id] !== undefined ||
        authority.published?.peerDependencies?.[id] !== undefined
      if (!registered) {
        pushError(
          errors,
          AUTHORITY_REL,
          `consumerProfiles.${profileName}.packages.${id}`,
          'registered install or peer package',
          version,
          'consumer-unregistered',
        )
      }

      // peer-floor profile: version must equal unique minVersion of peer range
      if (/peer-floor/i.test(profileName)) {
        const peerRange = authority.published?.peerDependencies?.[id]
        if (peerRange) {
          const floor = peerFloorFromRange(peerRange)
          if (!floor) {
            pushError(
              errors,
              AUTHORITY_REL,
              `consumerProfiles.${profileName}.packages.${id}`,
              'derivable peer floor from published.peerDependencies',
              peerRange,
              'peer-floor-unresolvable',
            )
          } else if (version !== floor) {
            pushError(
              errors,
              AUTHORITY_REL,
              `consumerProfiles.${profileName}.packages.${id}`,
              floor,
              version,
              'peer-floor-mismatch',
            )
          }
        }
      }
    }
  }

  return { errors, authority }
}

/**
 * Projection drift for all controlled manifests + missing required fixtures.
 */
export function checkManifestProjections(root = repoRoot, authority) {
  /** @type {DriftError[]} */
  const errors = []

  for (const rel of CONSUMER_FIXTURE_RELS) {
    const absolute = path.join(root, rel)
    if (!existsSync(absolute)) {
      pushError(
        errors,
        rel,
        '<file>',
        'present controlled consumer fixture',
        'missing',
        'missing-fixture',
      )
    }
  }

  let entries
  try {
    entries = listControlledManifests(root)
  } catch (error) {
    pushError(
      errors,
      '<controlled-manifests>',
      '<scan>',
      'scannable',
      String(error?.message || error),
      'manifest-scan',
    )
    return errors
  }

  for (const rel of CONSUMER_FIXTURE_RELS) {
    if (!entries.some((entry) => entry.relative === rel)) {
      pushError(
        errors,
        rel,
        '<controlled-list>',
        'included in controlled scan',
        'missing from scan',
        'missing-fixture-scan',
      )
    }
  }

  /** @type {Map<string, Map<string, string[]>>} packageId -> version -> files */
  const installVersions = new Map()

  for (const entry of entries) {
    let manifest
    try {
      manifest = readJson(entry.absolute)
    } catch (error) {
      pushError(
        errors,
        entry.relative,
        '<json>',
        'valid package.json',
        String(error?.message || error),
        'manifest-parse',
      )
      continue
    }

    let expected = null
    try {
      expected = projectManifestDependencies(
        manifest,
        authority,
        entry.role,
        {
          consumerProfile:
            entry.role === 'consumer-fixture' ? 'npm-latest' : undefined,
        },
      )
    } catch (error) {
      pushError(
        errors,
        entry.relative,
        '<projection>',
        'projectable from authority',
        String(error?.message || error),
        'projection-error',
      )
    }

    if (expected) {
      for (const field of DEPENDENCY_FIELDS) {
        const expectedMap = expected[field] || {}
        const actualMap = manifest[field] || {}
        const keys = new Set([
          ...Object.keys(expectedMap),
          ...Object.keys(actualMap),
        ])
        for (const id of keys) {
          const exp = expectedMap[id]
          const act = actualMap[id]
          if (exp !== act) {
            pushError(
              errors,
              entry.relative,
              `${field}.${id}`,
              exp === undefined ? '<absent>' : exp,
              act === undefined ? '<absent>' : act,
              'projection-drift',
            )
          }
        }
      }
    }

    // Unregistered + forbidden on actual external deps (field-level)
    for (const field of DEPENDENCY_FIELDS) {
      for (const [id, version] of Object.entries(manifest[field] || {})) {
        if (isWorkspaceSpecifier(version)) continue

        if (isForbiddenSpecifier(version)) {
          pushError(
            errors,
            entry.relative,
            `${field}.${id}`,
            'allowed non-forbidden specifier',
            version,
            'forbidden-specifier',
          )
        }

        if (!authority.install[id]) {
          pushError(
            errors,
            entry.relative,
            `${field}.${id}`,
            'registered in authority.install',
            version,
            'unregistered-external',
          )
        }

        // Track exact install versions for uniqueness (exclude peer ranges)
        if (field === 'peerDependencies') continue

        let exact = null
        if (typeof version === 'string' && version.startsWith('npm:')) {
          const alias = parseNpmAliasRange(version)
          if (alias && isExactVersion(alias.range)) exact = alias.range
        } else if (isExactVersion(version)) {
          exact = version
        }

        if (exact) {
          if (!installVersions.has(id)) installVersions.set(id, new Map())
          const byVersion = installVersions.get(id)
          if (!byVersion.has(exact)) byVersion.set(exact, [])
          byVersion.get(exact).push(`${entry.relative}:${field}`)
        }
      }
    }

    // Wide-range install bypass: root/workspace/consumer external non-peer
    // must be exact (or npm:alias@exact), never a plain range that merely contains install.
    if (
      entry.role === 'root' ||
      entry.role === 'workspace' ||
      entry.role === 'consumer-fixture'
    ) {
      for (const field of [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
      ]) {
        for (const [id, version] of Object.entries(manifest[field] || {})) {
          if (isWorkspaceSpecifier(version)) continue
          const effective = effectiveRangeOrVersion(version)
          if (
            typeof effective === 'string' &&
            !isExactVersion(effective) &&
            semver.validRange(effective)
          ) {
            pushError(
              errors,
              entry.relative,
              `${field}.${id}`,
              authority.install[id]
                ? `exact install ${authority.install[id]}`
                : 'exact install pin',
              version,
              'wide-range-install',
            )
          }
        }
      }
    }
  }

  // Same external package ID → one exact install version across workspace
  for (const [id, byVersion] of installVersions) {
    if (byVersion.size > 1) {
      const versions = [...byVersion.keys()].sort()
      pushError(
        errors,
        '<workspace>',
        `install-uniqueness.${id}`,
        `single exact version (authority.install=${authority.install[id] || '<none>'})`,
        versions.join(' | '),
        'install-not-unique',
      )
    } else if (byVersion.size === 1 && authority.install[id]) {
      const only = [...byVersion.keys()][0]
      if (only !== authority.install[id]) {
        pushError(
          errors,
          '<workspace>',
          `install-uniqueness.${id}`,
          authority.install[id],
          only,
          'install-mismatch-authority',
        )
      }
    }
  }

  return errors
}

/**
 * Published package candidate external fields must match authority projection.
 * Uses published-source package.json (and optional prepared dist if present).
 */
export function checkPackageCandidateFields(root = repoRoot, authority) {
  /** @type {DriftError[]} */
  const errors = []
  const sourceRel = PUBLISHED_PACKAGE_REL
  const sourcePath = path.join(root, sourceRel)
  if (!existsSync(sourcePath)) {
    pushError(
      errors,
      sourceRel,
      '<file>',
      'present',
      'missing',
      'published-source-missing',
    )
    return errors
  }

  const source = readJson(sourcePath)
  const projected = projectPublishedExternalFields(authority)

  for (const field of [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const expectedMap = projected[field] || {}
    const actualMap = source[field] || {}
    if (field === 'dependencies') {
      for (const [id, exp] of Object.entries(expectedMap)) {
        const act = actualMap[id]
        if (act !== exp) {
          pushError(
            errors,
            sourceRel,
            `${field}.${id}`,
            exp,
            act === undefined ? '<absent>' : act,
            'candidate-source-drift',
          )
        }
      }
      for (const [id, act] of Object.entries(actualMap)) {
        if (isWorkspaceSpecifier(act)) continue
        if (expectedMap[id] === undefined) {
          pushError(
            errors,
            sourceRel,
            `${field}.${id}`,
            '<absent external>',
            act,
            'candidate-source-extra',
          )
        }
      }
    } else {
      const keys = new Set([
        ...Object.keys(expectedMap),
        ...Object.keys(actualMap),
      ])
      for (const id of keys) {
        const exp = expectedMap[id]
        const act = actualMap[id]
        if (exp !== act) {
          pushError(
            errors,
            sourceRel,
            `${field}.${id}`,
            exp === undefined ? '<absent>' : exp,
            act === undefined ? '<absent>' : act,
            'candidate-source-drift',
          )
        }
      }
    }
  }

  // Optional prepared package candidate / dist package.json if present
  const candidateRels = [
    'dist/element-plus/package.json',
    'dist/npm-candidate/package/package.json',
  ]
  for (const rel of candidateRels) {
    const absolute = path.join(root, rel)
    if (!existsSync(absolute)) continue
    let candidate
    try {
      candidate = readJson(absolute)
    } catch {
      continue
    }
    for (const field of [
      'dependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      const expectedMap = projected[field] || {}
      const actualMap = candidate[field] || {}
      const keys = new Set([
        ...Object.keys(expectedMap),
        ...Object.keys(actualMap),
      ])
      for (const id of keys) {
        const exp = expectedMap[id]
        const act = actualMap[id]
        if (exp !== act) {
          pushError(
            errors,
            rel,
            `${field}.${id}`,
            exp === undefined ? '<absent>' : exp,
            act === undefined ? '<absent>' : act,
            'candidate-artifact-drift',
          )
        }
      }
    }
  }

  return errors
}

/**
 * Lockfile is not authority, but importer resolved versions for registered
 * packages must match authority.install exact pins.
 */
export function checkLockfileResolved(root = repoRoot, authority) {
  /** @type {DriftError[]} */
  const errors = []
  const lockPath = path.join(root, LOCKFILE_REL)
  if (!existsSync(lockPath)) {
    pushError(
      errors,
      LOCKFILE_REL,
      '<file>',
      'present',
      'missing',
      'lockfile-missing',
    )
    return errors
  }

  let lock
  try {
    const yaml = require('yaml')
    lock = yaml.parse(readFileSync(lockPath, 'utf8'))
  } catch (error) {
    pushError(
      errors,
      LOCKFILE_REL,
      '<yaml>',
      'parseable pnpm-lock.yaml',
      String(error?.message || error),
      'lockfile-parse',
    )
    return errors
  }

  const importers = lock?.importers || {}
  for (const [importerKey, importer] of Object.entries(importers)) {
    const fileLabel =
      importerKey === '.'
        ? 'pnpm-lock.yaml#importers[.]'
        : `pnpm-lock.yaml#importers[${importerKey}]`
    for (const field of DEPENDENCY_FIELDS) {
      const section = importer?.[field]
      if (!section || typeof section !== 'object') continue
      for (const [id, entry] of Object.entries(section)) {
        if (!authority.install[id]) continue
        const versionField = entry?.version
        if (typeof versionField !== 'string') continue
        if (
          versionField.startsWith('link:') ||
          versionField.startsWith('file:')
        ) {
          continue
        }
        const resolved = extractLockResolvedVersion(versionField)
        if (!resolved) continue
        if (resolved !== authority.install[id]) {
          pushError(
            errors,
            fileLabel,
            `${field}.${id}.version`,
            authority.install[id],
            resolved,
            'lockfile-resolved-mismatch',
          )
        }
      }
    }
  }

  return errors
}

/**
 * Full read-only deps:check.
 * @returns {{ ok: boolean, errors: DriftError[], authority: object|null }}
 */
export function runDepsCheck(root = repoRoot, options = {}) {
  const { errors: authorityErrors, authority } = checkAuthority(
    root,
    options.authority,
  )
  /** @type {DriftError[]} */
  const errors = [...authorityErrors]

  if (!authority) {
    return { ok: false, errors, authority: null }
  }

  errors.push(...checkManifestProjections(root, authority))
  errors.push(...checkPackageCandidateFields(root, authority))
  if (options.skipLockfile !== true) {
    errors.push(...checkLockfileResolved(root, authority))
  }

  return { ok: errors.length === 0, errors, authority }
}

export function assertReadOnlyWorkingTree(root = repoRoot) {
  const digests = new Map()
  for (const entry of listControlledManifests(root)) {
    const st = statSync(entry.absolute)
    digests.set(entry.relative, {
      mtimeMs: st.mtimeMs,
      size: st.size,
      text: readFileSync(entry.absolute, 'utf8'),
    })
  }
  const authorityText = readFileSync(path.join(root, AUTHORITY_REL), 'utf8')
  digests.set(AUTHORITY_REL, { text: authorityText })
  return digests
}

export {
  AUTHORITY_REL,
  SCHEMA_REL,
  DEPENDENCY_FIELDS,
  PUBLISHED_PACKAGE_REL,
  CONSUMER_FIXTURE_RELS,
  LOCKFILE_REL,
  repoRoot,
  loadAuthority,
  serializePackageJson,
  toPosixRel,
  projectManifestDependencies,
  projectPublishedExternalFields,
  listControlledManifests,
}
