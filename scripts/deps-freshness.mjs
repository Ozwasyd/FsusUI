#!/usr/bin/env node
/**
 * pnpm deps:freshness — three-state dependency freshness check (#411).
 *
 * For every entry in update-surface.json, classifies the dependency as:
 *   current          — already on the latest stable version
 *   latest-target-pr — an open Renovate PR targets the latest stable
 *   exception        — a valid temporary exception covers the gap
 *
 * Fails (exit 1) if any dependency is stale without PR or exception.
 */

import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evaluateFreshnessEntry,
  selectRenovatePullRequests,
  validateExceptionRegistry,
} from './dependency-freshness-evaluator.mjs'
import {
  resolveCurrentVersion,
  resolveLatestVersion,
} from './dependency-freshness-adapters.mjs'
import { writeFreshnessReport } from './deps-freshness-report.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const SURFACE_REL = 'config/dependencies/update-surface.json'
const EXCEPTIONS_REL = 'config/dependencies/exceptions.json'
const REQUIRED_CHECKS_REL = 'config/dependencies/required-checks.json'
const outputIndex = process.argv.indexOf('--output')
const outputPath = outputIndex < 0 ? null : process.argv[outputIndex + 1]
const operationalErrors = []

if (outputIndex >= 0 && !outputPath) {
  console.error('[deps:freshness] --output requires a path')
  process.exit(2)
}

function operationalError(source, identity) {
  const message = `${source} lookup failed for ${identity}`
  operationalErrors.push({ source, identity, message })
  return null
}

function readJson(relPath) {
  const fullPath = path.resolve(repoRoot, relPath)
  if (!existsSync(fullPath)) return null
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

function npmLatest(name) {
  try {
    const r = execSync(`npm view "${name}" version 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim()
    return r || null
  } catch {
    return operationalError('npm-registry', name)
  }
}

function githubTags(repo) {
  try {
    const r = execSync(
      `gh api --paginate --slurp "repos/${repo}/tags?per_page=100" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 15_000 },
    ).trim()
    return r
      ? JSON.parse(r)
          .flat()
          .map((entry) => entry.name)
      : null
  } catch {
    return operationalError('github-api', repo)
  }
}

let openRenovatePullRequests

function loadOpenRenovatePullRequests() {
  try {
    const r = execSync(
      'gh pr list --state open --json title,headRefName,number,url,body,createdAt,statusCheckRollup,labels --limit 100 2>/dev/null',
      { encoding: 'utf-8', timeout: 15_000 },
    ).trim()
    if (!r || r === '[]') return []
    const prs = JSON.parse(r)
    if (prs.length >= 100) {
      operationalError(
        'github-api',
        'open pull request inventory reached limit',
      )
      return null
    }
    return prs
  } catch {
    return operationalError('github-api', 'open pull requests')
  }
}

function findRenovatePRs(entry) {
  if (openRenovatePullRequests === undefined) {
    openRenovatePullRequests = loadOpenRenovatePullRequests()
  }
  return selectRenovatePullRequests(openRenovatePullRequests ?? [], entry)
}

function curlJson(url) {
  try {
    const r = execSync(`curl -sSL "${url}" 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim()
    return r ? JSON.parse(r) : null
  } catch {
    return operationalError('upstream-registry', url)
  }
}

// ===== Version resolvers per datasource =====

function resolveCurrent(entry) {
  return resolveCurrentVersion(entry, repoRoot)
}

function nugetVersions(packageName) {
  const id = encodeURIComponent(packageName.toLowerCase())
  return curlJson(`https://api.nuget.org/v3-flatcontainer/${id}/index.json`)
    ?.versions
}

function resolveLatest(entry, currentVersion) {
  return resolveLatestVersion(entry, currentVersion, {
    npm: npmLatest,
    nuget: nugetVersions,
    githubTags,
    githubReleases: githubTags,
    dotnet: () =>
      curlJson(
        'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json',
      ),
    node: () => curlJson('https://nodejs.org/dist/index.json'),
  })
}

// ===== Main =====

const surface = readJson(SURFACE_REL)
if (!surface) {
  console.error('[deps:freshness] missing update-surface.json')
  process.exit(1)
}

const exceptions = readJson(EXCEPTIONS_REL)
const requiredChecks =
  readJson(REQUIRED_CHECKS_REL)?.branchProtection?.requiredChecks
const now = new Date()
const exceptionRegistry = validateExceptionRegistry(
  exceptions,
  surface.surfaces ?? [],
  now.toISOString(),
)
for (const error of exceptionRegistry.errors) {
  operationalErrors.push({
    source: 'exception-config',
    identity: error.split(':')[0],
    message: error,
  })
}

const results = []
let failures = exceptionRegistry.errors.length > 0 ? 1 : 0

for (const entry of surface.surfaces || []) {
  const current = resolveCurrent(entry)
  const latest = resolveLatest(entry, current)
  const pullRequests =
    current && latest && current !== latest ? findRenovatePRs(entry) : []
  const recordedExceptions = exceptionRegistry.byDependency.get(entry.id) ?? []
  const evaluated = evaluateFreshnessEntry({
    entry,
    currentVersion: current,
    latestVersion: latest,
    pullRequests,
    exceptions: recordedExceptions,
    now: now.toISOString(),
  })
  for (const error of evaluated.errors) {
    operationalErrors.push({
      source: 'freshness-evaluator',
      identity: entry.id,
      message: `${entry.id}:${error}`,
    })
  }
  if (evaluated.state === 'stale' || evaluated.errors.length > 0) failures += 1
  const exception = evaluated.selectedException
    ? {
        id: evaluated.selectedException.id,
        owner: evaluated.selectedException.owner,
        expiresAt: evaluated.selectedException.expiresAt,
      }
    : null

  results.push({
    dependencyId: entry.id,
    datasource: entry.datasource,
    packageName: entry.packageName,
    currentVersion: current,
    targetVersion: latest,
    state: evaluated.state,
    detail: evaluated.detail,
    pullRequests,
    exception,
    blockerReasons: evaluated.blockerReasons,
  })
  console.log(
    `[deps:freshness] ${evaluated.state.padEnd(16)} ${entry.id}: ${evaluated.detail}`,
  )
}

const summary = {
  total: results.length,
  current: results.filter((r) => r.state === 'current').length,
  'latest-target-pr': results.filter((r) => r.state === 'latest-target-pr')
    .length,
  exception: results.filter((r) => r.state === 'exception').length,
  stale: results.filter((r) => r.state === 'stale').length,
  skipped: results.filter((r) => r.state === 'skipped').length,
}
console.log(`\n[deps:freshness] summary ${JSON.stringify(summary)}`)

const report = {
  schemaVersion: 1,
  generatedAt: now.toISOString(),
  requiredChecks: requiredChecks ?? [],
  results,
  errors: operationalErrors,
  summary,
}
if (outputPath) {
  writeFreshnessReport(outputPath, report, repoRoot)
  console.log(`[deps:freshness] structured result ${outputPath}`)
}

if (failures > 0 || operationalErrors.length > 0) {
  console.error(`[deps:freshness] FAILED stale=${failures}`)
  process.exit(1)
}
console.log('[deps:freshness] ok all dependencies current or accounted for')
