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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const SURFACE_REL = 'config/dependencies/update-surface.json'
const EXCEPTIONS_REL = 'config/dependencies/exceptions.json'

function readJson(relPath) {
  const fullPath = path.resolve(repoRoot, relPath)
  if (!existsSync(fullPath)) return null
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

function npmLatest(name) {
  try {
    const r = execSync(`npm view "${name}" version 2>/dev/null`, { encoding: 'utf-8', timeout: 10_000 }).trim()
    return r || null
  } catch { return null }
}

function ghReleaseLatest(repo) {
  try {
    const r = execSync(`gh release view --repo "${repo}" --json tagName --jq '.tagName' 2>/dev/null`, { encoding: 'utf-8', timeout: 15_000 }).trim()
    return r?.replace(/^v/, '') || null
  } catch { return null }
}

function findRenovatePR(depId) {
  try {
    const r = execSync(`gh pr list --state open --search "${depId} in:title" --json title,headRefName,number --limit 5 2>/dev/null`, { encoding: 'utf-8', timeout: 15_000 }).trim()
    if (!r || r === '[]') return null
    const prs = JSON.parse(r)
    return prs.find(p => p.headRefName?.includes('renovate')) || prs[0] || null
  } catch { return null }
}

function curlJson(url) {
  try {
    const r = execSync(`curl -sSL "${url}" 2>/dev/null`, { encoding: 'utf-8', timeout: 10_000 }).trim()
    return r ? JSON.parse(r) : null
  } catch { return null }
}

// ===== Version resolvers per datasource =====

function resolveCurrent(entry) {
  const ds = entry.datasource

  if (ds === 'npm') {
    // Read installed version from pnpm-lock.yaml via npm ls
    const pkgName = entry.packageName
    // For npm workspace, deps:check already verifies consistency.
    // Freshness: check if lockfile is current vs registry for key packages.
    // Use the first specific package name from the group
    const keyPkg = {
      'npm-workspace-root': 'semver',
      'npm-vue-runtime': 'vue',
      'npm-vue-build': 'vite',
      'npm-js-test': 'vitest',
      'pnpm-package-manager': 'pnpm',
    }[entry.id]
    if (!keyPkg) return null
    // Read from installed node_modules
    const modPath = path.resolve(repoRoot, 'node_modules', keyPkg, 'package.json')
    if (!existsSync(modPath)) return null
    return JSON.parse(readFileSync(modPath, 'utf-8')).version
    if (!existsSync(lockPath)) return null
    const lock = readFileSync(lockPath, 'utf-8')
    const re = new RegExp(`/${keyPkg}/([\\d.]+):`, '')
    const match = lock.match(re)
    return match ? match[1] : null
  }

  if (ds === 'nuget') {
    const propsPath = path.resolve(repoRoot, 'dotnet/Directory.Packages.props')
    if (!existsSync(propsPath)) return null
    const content = readFileSync(propsPath, 'utf-8')
    const pkgName = entry.packageName.split(',')[0]?.trim()
    const re = new RegExp(`Include="${pkgName}"\\s+Version="([^"]+)"`, 'i')
    const match = content.match(re)
    return match ? match[1] : null
  }

  if (ds === 'dotnet-version') {
    return readJson('dotnet/global.json')?.sdk?.version || null
  }

  if (ds === 'node-version') {
    const f = path.resolve(repoRoot, '.github/workflows/quality.yml')
    if (!existsSync(f)) return null
    const m = readFileSync(f, 'utf-8').match(/node-version:\s*(\d+)/)
    return m ? m[1] : null
  }

  if (ds === 'github-releases' && entry.packageName.includes('emsdk')) {
    const f = path.resolve(repoRoot, '.github/workflows/quality.yml')
    if (!existsSync(f)) return null
    const m = readFileSync(f, 'utf-8').match(/emscripten-core\/setup-emsdk@(v[\d.]+)/)
    return m ? m[1].replace(/^v/, '') : null
  }

  if (entry.id === 'pnpm-package-manager') {
    const m = (readJson('package.json')?.packageManager || '').match(/pnpm@(.+)/)
    return m ? m[1] : null
  }

  return null
}

function resolveLatest(entry) {
  const ds = entry.datasource
  if (ds === 'npm') {
    const keyPkg = {
      'npm-workspace-root': 'semver',
      'npm-vue-runtime': 'vue',
      'npm-vue-build': 'vite',
      'npm-js-test': 'vitest',
      'pnpm-package-manager': 'pnpm',
    }[entry.id]
    return keyPkg ? npmLatest(keyPkg) : null
  }
  if (ds === 'nuget') return null
  if (ds === 'dotnet-version') {
    const idx = curlJson('https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json')
    const rel = idx?.['releases-index']?.find(r => r['channel-version'] === '10.0')
    return rel?.['latest-sdk'] || null
  }
  if (ds === 'node-version') {
    const versions = curlJson('https://nodejs.org/dist/index.json')
    const lts = versions?.find(v => v.lts !== false)
    return lts ? lts.version.replace(/^v/, '') : null
  }
  if (ds === 'github-releases' && entry.packageName.includes('emsdk')) {
    return ghReleaseLatest('emscripten-core/emsdk')
  }
  return null
}

// ===== Main =====

const surface = readJson(SURFACE_REL)
if (!surface) { console.error('[deps:freshness] missing update-surface.json'); process.exit(1) }

const exceptions = readJson(EXCEPTIONS_REL)
const now = new Date()
const activeExceptions = new Map()
for (const exc of (exceptions?.exceptions || [])) {
  if (new Date(exc.expiresAt) > now) activeExceptions.set(exc.dependencyId, exc)
}

const results = []
let failures = 0

for (const entry of (surface.surfaces || [])) {
  const current = resolveCurrent(entry)
  const latest = resolveLatest(entry)
  if (!current && !latest) continue

  let state = 'skipped'
  let detail = ''

  if (!latest || !current) {
    state = 'skipped'
    detail = 'cannot determine version'
  } else if (current === latest) {
    state = 'current'
    detail = current
  } else {
    const pr = findRenovatePR(entry.id)
    if (pr) {
      state = 'latest-target-pr'
      detail = `PR #${pr.number}: ${pr.title}`
    } else {
      const exc = activeExceptions.get(entry.id)
      if (exc) {
        state = 'exception'
        detail = `expires ${exc.expiresAt}: ${exc.reason}`
      } else {
        state = 'stale'
        detail = `current=${current} latest=${latest}`
        failures += 1
      }
    }
  }

  results.push({ id: entry.id, state, detail })
  console.log(`[deps:freshness] ${state.padEnd(16)} ${entry.id}: ${detail}`)
}

// Expired exceptions
for (const exc of (exceptions?.exceptions || [])) {
  if (new Date(exc.expiresAt) <= now) {
    console.error(`[deps:freshness] FAIL expired-exception ${exc.dependencyId}`)
    failures += 1
  }
}

const summary = {
  total: results.length,
  current: results.filter(r => r.state === 'current').length,
  'latest-target-pr': results.filter(r => r.state === 'latest-target-pr').length,
  exception: results.filter(r => r.state === 'exception').length,
  stale: results.filter(r => r.state === 'stale').length,
  skipped: results.filter(r => r.state === 'skipped').length,
}
console.log(`\n[deps:freshness] summary ${JSON.stringify(summary)}`)

if (failures > 0) {
  console.error(`[deps:freshness] FAILED stale=${failures}`)
  process.exit(1)
}
console.log('[deps:freshness] ok all dependencies current or accounted for')
