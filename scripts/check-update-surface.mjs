#!/usr/bin/env node
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FIXED_GROUPS,
  RENOVATE_REL,
  UPDATE_SURFACE_REL,
  UPDATE_SURFACE_SCHEMA_REL,
  buildExpectedUpdateSurface,
  canonicalJson,
  expectedNugetLockfiles,
} from './update-surface-lib.mjs'

const require = createRequire(import.meta.url)
const Ajv2020 = require('ajv/dist/2020.js')
const JSON5 = require('json5')
const defaultRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const EXPECTED_MANAGERS = [
  'custom.jsonata',
  'custom.regex',
  'dockerfile',
  'github-actions',
  'nuget',
]
const EXPECTED_CUSTOM_MANAGERS = [
  'dotnet-target-framework',
  'emsdk-version-input',
  'node-version-pins',
  'npm-authority',
  'pnpm-package-manager',
]
const EXPECTED_POST_COMMANDS = [
  'pnpm deps:sync',
  'pnpm install --lockfile-only',
  'pnpm deps:check',
  'node ./scripts/dotnet-restore-all.mjs --update-locks',
]
const EXPECTED_POST_FILTERS = [
  'config/dependencies/npm-authority.json',
  'dotnet/**/packages.lock.json',
  'dotnet/Directory.Packages.props',
  'package.json',
  'pnpm-lock.yaml',
  'vue/internal/**/package.json',
  'vue/packages/**/package.json',
  'vue/tests/consumer-install/template/package.json',
]

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function equalArray(actual, expected) {
  return canonicalJson(sorted(actual ?? [])) === canonicalJson(sorted(expected))
}

function walkConfig(value, visit, keyPath = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      walkConfig(entry, visit, [...keyPath, String(index)]),
    )
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    visit(key, child, [...keyPath, key])
    walkConfig(child, visit, [...keyPath, key])
  }
}

export function auditModels({
  surface,
  schema,
  renovate,
  expected,
  now = new Date(),
}) {
  const errors = []
  const fail = (message) => errors.push(message)

  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validate = ajv.compile(schema)
  if (!validate(surface)) {
    for (const error of validate.errors ?? []) {
      fail(`schema ${error.instancePath || '/'} ${error.message}`)
    }
  }

  if (canonicalJson(surface) !== canonicalJson(expected)) {
    fail(
      `${UPDATE_SURFACE_REL} is stale; run node scripts/generate-update-surface.mjs`,
    )
  }

  const seenIds = new Set()
  const seenIdentities = new Set()
  for (const entry of surface.surfaces ?? []) {
    if (seenIds.has(entry.id)) fail(`duplicate surface id: ${entry.id}`)
    seenIds.add(entry.id)
    const identity = `${entry.datasource}:${entry.packageName}`
    if (seenIdentities.has(identity)) {
      fail(`duplicate package identity: ${identity}`)
    }
    seenIdentities.add(identity)
    if ('currentVersion' in entry) {
      fail(`surface ${entry.id} copies currentVersion`)
    }
  }

  const exclusionIds = new Set()
  for (const exclusion of surface.exclusions ?? []) {
    if (exclusionIds.has(exclusion.id)) {
      fail(`duplicate exclusion id: ${exclusion.id}`)
    }
    exclusionIds.add(exclusion.id)
    if (/[*?[{]/u.test(exclusion.path)) {
      fail(`exclusion ${exclusion.id} path must be exact`)
    }
    const reviewTime = Date.parse(`${exclusion.reviewAfter}T23:59:59Z`)
    if (!Number.isFinite(reviewTime) || reviewTime < now.getTime()) {
      fail(`exclusion ${exclusion.id} reviewAfter expired or invalid`)
    }
  }

  if (!equalArray(renovate.enabledManagers, EXPECTED_MANAGERS)) {
    fail('enabledManagers does not match the governed manager set')
  }
  if ('platform' in renovate || 'repositories' in renovate) {
    fail('repository config must not contain global-only platform/repositories')
  }
  if (renovate.automerge !== true) fail('automerge must be true')
  if (renovate.automergeType !== 'pr') {
    fail('automergeType must keep dependency updates on pull requests')
  }
  if (renovate.platformAutomerge !== true) {
    fail('platformAutomerge must use the hosting platform')
  }
  if (renovate.ignoreTests !== false) {
    fail('ignoreTests must require repository checks')
  }
  if (renovate.dependencyDashboardApproval !== false) {
    fail('dependencyDashboardApproval must not require manual approval')
  }
  if (renovate.rebaseWhen !== 'behind-base-branch') {
    fail('rebaseWhen must refresh stale dependency branches')
  }
  if ('automergeSchedule' in renovate) {
    fail('automergeSchedule must not create a merge window')
  }
  if (renovate.separateMajorMinor !== false) {
    fail('semantic groups must combine major/minor by default')
  }
  if (renovate.separateMinorPatch !== false) {
    fail('semantic groups must combine minor/patch branches')
  }
  if (renovate.dependencyDashboard !== true) {
    fail('dependencyDashboard must be enabled')
  }
  if (renovate.minimumReleaseAge !== '0 days') {
    fail('minimumReleaseAge must be 0 days')
  }
  if (renovate.rangeStrategy !== 'replace') {
    fail('rangeStrategy must replace owned exact values without pin branches')
  }
  if (!renovate.schedule?.includes('* 0,6,12,18 * * *')) {
    fail('schedule must allow runs at six-hour intervals')
  }
  if (renovate.lockFileMaintenance?.enabled !== true) {
    fail('lockFileMaintenance must be enabled')
  }
  if (
    renovate.lockFileMaintenance?.automerge !== true ||
    renovate.lockFileMaintenance?.automergeType !== 'pr' ||
    renovate.lockFileMaintenance?.platformAutomerge !== true
  ) {
    fail('lockFileMaintenance must use platform PR automerge')
  }
  if (
    !renovate.lockFileMaintenance?.schedule?.some((entry) =>
      /before 4am/u.test(entry),
    )
  ) {
    fail('lockFileMaintenance must run daily')
  }
  if (
    renovate.vulnerabilityAlerts?.enabled !== true ||
    !Array.isArray(renovate.vulnerabilityAlerts?.schedule) ||
    renovate.vulnerabilityAlerts.schedule.length !== 0
  ) {
    fail('vulnerability alerts must be enabled without a schedule delay')
  }

  walkConfig(renovate, (key, value, keyPath) => {
    if (key === 'ignoreDeps') {
      fail(`permanent ignore forbidden at ${keyPath.join('.')}`)
    }
    if (key === 'enabled' && value === false) {
      fail(`disabled update surface forbidden at ${keyPath.join('.')}`)
    }
    if (key === 'automerge' && value !== true) {
      fail(`automerge must stay enabled at ${keyPath.join('.')}`)
    }
    if (key === 'automergeType' && value !== 'pr') {
      fail(`direct-push automerge forbidden at ${keyPath.join('.')}`)
    }
    if (key === 'platformAutomerge' && value !== true) {
      fail(`platform automerge required at ${keyPath.join('.')}`)
    }
  })
  const exclusionPaths = new Set(
    (surface.exclusions ?? []).map((entry) => entry.path),
  )
  for (const relative of renovate.ignorePaths ?? []) {
    if (/[*?[{]/u.test(relative)) {
      fail(`ignorePaths entry must be exact: ${relative}`)
    }
    if (!exclusionPaths.has(relative)) {
      fail(`ignorePaths entry lacks governed exclusion: ${relative}`)
    }
  }
  const expectedIgnoredFixtures = (surface.exclusions ?? [])
    .filter((entry) => entry.path.endsWith('.csproj') || entry.path.endsWith('.props'))
    .filter((entry) => entry.path.startsWith('tests/fixtures/'))
    .map((entry) => entry.path)
  if (!equalArray(renovate.ignorePaths, expectedIgnoredFixtures)) {
    fail('ignorePaths must equal the exact governed project fixture exclusions')
  }

  const customDescriptions = sorted(
    (renovate.customManagers ?? []).map((manager) => manager.description),
  )
  if (!equalArray(customDescriptions, EXPECTED_CUSTOM_MANAGERS)) {
    fail('custom manager ownership set is incomplete or contains extras')
  }
  const npmAuthority = renovate.customManagers?.find(
    (manager) => manager.description === 'npm-authority',
  )
  if (
    npmAuthority?.customType !== 'jsonata' ||
    npmAuthority?.fileFormat !== 'json' ||
    !equalArray(npmAuthority.managerFilePatterns, [
      '/^config/dependencies/npm-authority\\.json$/',
    ])
  ) {
    fail('npm-authority must be the unique JSONata npm source')
  }

  const stableRule = renovate.packageRules?.find(
    (rule) => rule.description === 'Reject prerelease dependency candidates',
  )
  if (
    typeof stableRule?.allowedVersions !== 'string' ||
    !stableRule.allowedVersions.startsWith('!/')
  ) {
    fail('stable-only allowedVersions rule is missing')
  }

  const primaryGroupRules = (renovate.packageRules ?? []).filter(
    (rule) => rule.groupName && Array.isArray(rule.matchPackageNames),
  )
  if (
    !equalArray(
      primaryGroupRules.map((rule) => rule.groupName),
      FIXED_GROUPS,
    )
  ) {
    fail('Renovate semantic groups do not match the frozen group set')
  }
  for (const rule of primaryGroupRules) {
    const collisionProne = ['github-actions', 'wasm-toolchain'].includes(
      rule.groupName,
    )
    if (
      collisionProne
        ? rule.separateMajorMinor !== true
        : rule.separateMajorMinor === true
    ) {
      fail(
        `group ${rule.groupName} has invalid major branch separation policy`,
      )
    }
  }
  const overlayRules = (renovate.packageRules ?? []).filter(
    (rule) => rule.groupName && !Array.isArray(rule.matchPackageNames),
  )
  if (
    overlayRules.length !== 1 ||
    overlayRules[0].groupName !== 'node-dotnet-sdk-images' ||
    !equalArray(overlayRules[0].matchDatasources, [
      'docker',
      'dotnet-version',
      'node-version',
    ])
  ) {
    fail('SDK/runtime datasource group overlay is missing or contains extras')
  }
  const packageOwners = new Map()
  for (const rule of primaryGroupRules) {
    if (!Array.isArray(rule.matchPackageNames) || rule.matchPackageNames.length === 0) {
      fail(`group ${rule.groupName} must use explicit matchPackageNames`)
      continue
    }
    for (const packageName of rule.matchPackageNames) {
      const owners = packageOwners.get(packageName) ?? []
      owners.push(rule.groupName)
      packageOwners.set(packageName, owners)
    }
  }
  for (const entry of surface.surfaces ?? []) {
    const owners = packageOwners.get(entry.packageName) ?? []
    if (owners.length !== 1 || owners[0] !== entry.group) {
      fail(
        `${entry.datasource}:${entry.packageName} must map exactly to ${entry.group}; found ${owners.join(', ') || 'none'}`,
      )
    }
  }
  for (const [packageName, owners] of packageOwners) {
    if (owners.length !== 1) {
      fail(`${packageName} is owned by overlapping groups: ${owners.join(', ')}`)
    }
    if (
      !(surface.surfaces ?? []).some(
        (entry) => entry.packageName === packageName,
      )
    ) {
      fail(`group package is not in update surface: ${packageName}`)
    }
  }

  if (
    !equalArray(renovate.postUpgradeTasks?.commands, EXPECTED_POST_COMMANDS)
  ) {
    fail('postUpgradeTasks commands do not match deterministic projections')
  }
  if (
    !equalArray(renovate.postUpgradeTasks?.fileFilters, EXPECTED_POST_FILTERS)
  ) {
    fail('postUpgradeTasks fileFilters do not cover every projection')
  }
  if (renovate.postUpgradeTasks?.executionMode !== 'branch') {
    fail('postUpgradeTasks executionMode must be branch')
  }

  return errors
}

export function auditRepository(root = defaultRoot) {
  const readJson = (relative) =>
    JSON.parse(readFileSync(path.join(root, relative), 'utf8'))
  const surface = readJson(UPDATE_SURFACE_REL)
  const schema = readJson(UPDATE_SURFACE_SCHEMA_REL)
  const renovate = JSON5.parse(
    readFileSync(path.join(root, RENOVATE_REL), 'utf8'),
  )
  const expected = buildExpectedUpdateSurface(root)
  const errors = auditModels({ surface, schema, renovate, expected })

  for (const entry of surface.surfaces ?? []) {
    for (const relative of entry.files ?? []) {
      if (!existsSync(path.join(root, relative))) {
        errors.push(`owned file missing: ${entry.id}:${relative}`)
      }
    }
  }
  for (const relative of expectedNugetLockfiles(root)) {
    if (!existsSync(path.join(root, relative))) {
      errors.push(`NuGet lockfile missing: ${relative}`)
    }
  }
  const buildProps = readFileSync(
    path.join(root, 'dotnet/Directory.Build.props'),
    'utf8',
  )
  if (
    !/<RestorePackagesWithLockFile>true<\/RestorePackagesWithLockFile>/u.test(
      buildProps,
    )
  ) {
    errors.push('Directory.Build.props must enable NuGet lockfiles')
  }
  const formGeneratorTests = readFileSync(
    path.join(
      root,
      'dotnet/FsusUI.Avalonia.FormGenerator.Tests/FsusUI.Avalonia.FormGenerator.Tests.csproj',
    ),
    'utf8',
  )
  if (
    /ManagePackageVersionsCentrally>false/u.test(formGeneratorTests) ||
    /<PackageReference\b[^>]*\bVersion=/u.test(formGeneratorTests)
  ) {
    errors.push('FormGenerator.Tests must use central NuGet versions')
  }

  return {
    errors,
    summary: {
      exclusions: surface.exclusions?.length ?? 0,
      groups: FIXED_GROUPS.length,
      surfaces: surface.surfaces?.length ?? 0,
    },
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const result = auditRepository()
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`[check:update-surface] FAIL ${error}`)
    }
    console.error(
      `[check:update-surface] FAILED errors=${result.errors.length}`,
    )
    process.exit(1)
  }
  console.log(
    `[check:update-surface] ok surfaces=${result.summary.surfaces} exclusions=${result.summary.exclusions} groups=${result.summary.groups}`,
  )
}
