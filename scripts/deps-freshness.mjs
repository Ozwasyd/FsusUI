#!/usr/bin/env node
/* global AbortSignal, fetch */
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
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
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

const execFileAsync = promisify(execFile)
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

async function fetchJson(url, { headers = {}, timeoutMs = 10_000 } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.json()
}

async function fetchNpmLatest(name) {
  try {
    const encoded = encodeURIComponent(name)
    const data = await fetchJson(
      `https://registry.npmjs.org/${encoded}/latest`,
      { timeoutMs: 10_000 },
    )
    const version = typeof data?.version === 'string' ? data.version.trim() : ''
    return version || null
  } catch {
    try {
      const { stdout } = await execFileAsync('npm', ['view', name, 'version'], {
        encoding: 'utf-8',
        timeout: 10_000,
      })
      return stdout.trim() || null
    } catch {
      return operationalError('npm-registry', name)
    }
  }
}

async function fetchGithubTags(repo) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ''
  try {
    const headers = {
      accept: 'application/vnd.github+json',
      'user-agent': 'FsusUI-deps-freshness',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    }
    const tags = []
    let nextUrl = `https://api.github.com/repos/${repo}/tags?per_page=100`
    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers,
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const page = await response.json()
      if (Array.isArray(page)) {
        for (const entry of page) {
          if (typeof entry?.name === 'string') tags.push(entry.name)
        }
      }
      const link = response.headers.get('link') ?? ''
      const nextMatch = link.match(/<([^>]+)>;\s*rel="next"/u)
      nextUrl = nextMatch ? nextMatch[1] : null
    }
    return tags
  } catch {
    try {
      const { stdout } = await execFileAsync(
        'gh',
        ['api', '--paginate', '--slurp', `repos/${repo}/tags?per_page=100`],
        { encoding: 'utf-8', timeout: 15_000 },
      )
      const trimmed = stdout.trim()
      return trimmed
        ? JSON.parse(trimmed)
            .flat()
            .map((entry) => entry.name)
        : null
    } catch {
      return operationalError('github-api', repo)
    }
  }
}

async function loadOpenRenovatePullRequests() {
  try {
    const { stdout } = await execFileAsync(
      'gh',
      [
        'pr',
        'list',
        '--state',
        'open',
        '--json',
        'title,headRefName,number,url,body,createdAt,statusCheckRollup,labels',
        '--limit',
        '100',
      ],
      { encoding: 'utf-8', timeout: 15_000 },
    )
    const trimmed = stdout.trim()
    if (!trimmed || trimmed === '[]') return []
    const prs = JSON.parse(trimmed)
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

async function fetchUpstreamJson(url) {
  try {
    return await fetchJson(url, { timeoutMs: 15_000 })
  } catch {
    return operationalError('upstream-registry', url)
  }
}

async function fetchNugetVersions(packageName) {
  const id = encodeURIComponent(packageName.toLowerCase())
  const data = await fetchUpstreamJson(
    `https://api.nuget.org/v3-flatcontainer/${id}/index.json`,
  )
  return data?.versions ?? null
}

async function runWithConcurrency(items, concurrency, task) {
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await task(items[index], index)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
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

const entries = surface.surfaces || []
const npmCache = new Map()
const nugetCache = new Map()
const githubTagsCache = new Map()
let dotnetIndex = null
let nodeIndex = null

const uniqueJobs = []
const seen = new Set()
const enqueue = (key, fn) => {
  if (seen.has(key)) return
  seen.add(key)
  uniqueJobs.push(fn)
}

for (const entry of entries) {
  if (entry.datasource === 'npm') {
    enqueue(`npm:${entry.packageName}`, async () => {
      npmCache.set(entry.packageName, await fetchNpmLatest(entry.packageName))
    })
  } else if (entry.datasource === 'nuget') {
    enqueue(`nuget:${entry.packageName}`, async () => {
      nugetCache.set(
        entry.packageName,
        await fetchNugetVersions(entry.packageName),
      )
    })
  } else if (
    entry.datasource === 'github-tags' ||
    entry.datasource === 'github-releases'
  ) {
    enqueue(`gh:${entry.packageName}`, async () => {
      githubTagsCache.set(
        entry.packageName,
        await fetchGithubTags(entry.packageName),
      )
    })
  } else if (entry.datasource === 'dotnet-version') {
    enqueue('dotnet:index', async () => {
      dotnetIndex = await fetchUpstreamJson(
        'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json',
      )
    })
  } else if (entry.datasource === 'node-version') {
    enqueue('node:index', async () => {
      nodeIndex = await fetchUpstreamJson('https://nodejs.org/dist/index.json')
    })
  }
}

const lookupConcurrency = Math.max(
  1,
  Number(process.env.FSUS_DEPS_FRESHNESS_CONCURRENCY) || 12,
)
const [openRenovatePullRequests] = await Promise.all([
  entries.length > 0 ? loadOpenRenovatePullRequests() : Promise.resolve([]),
  runWithConcurrency(uniqueJobs, lookupConcurrency, (job) => job()),
])

const results = []
let failures = exceptionRegistry.errors.length > 0 ? 1 : 0

for (const entry of entries) {
  const current = resolveCurrentVersion(entry, repoRoot)
  const latest = resolveLatestVersion(entry, current, {
    npm: (name) => npmCache.get(name) ?? null,
    nuget: (name) => nugetCache.get(name) ?? null,
    githubTags: (repo) => githubTagsCache.get(repo) ?? null,
    githubReleases: (repo) => githubTagsCache.get(repo) ?? null,
    dotnet: () => dotnetIndex,
    node: () => nodeIndex,
  })
  const pullRequests =
    current && latest
      ? selectRenovatePullRequests(openRenovatePullRequests ?? [], entry)
      : []
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
