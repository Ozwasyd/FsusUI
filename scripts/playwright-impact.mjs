import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  computePlaywrightRegistryHash,
  loadPlaywrightRegistry,
} from './playwright-registry.mjs'

const digestOf = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')

const escapeRegex = (value) => value.replace(/[.+^${}()|[\]\\]/gu, '\\$&')

const globToRegex = (pattern) => {
  let source = ''
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        i++
        source += pattern[i + 1] === '/' ? '(?:.*/)?' : '.*'
        if (pattern[i + 1] === '/') i++
      } else {
        source += '[^/]*'
      }
    } else {
      source += escapeRegex(ch)
    }
  }
  return new RegExp(`^${source}$`)
}

const matchesGlob = (file, pattern) => globToRegex(pattern).test(file)

const SHARED_ROOTS = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'scripts/playwright-impact.mjs',
  'scripts/playwright-impact-plan.mjs',
  'spec/ci/playwright-suites.json',
  'scripts/with-node-heap.mjs',
  'vue/playwright.config.ts',
  'vue/vite.config.ts',
  'scripts/prepare-visual-runtime.mjs',
  'scripts/serve-visual-runtime.mjs',
  'scripts/visual-runtime-core.mjs',
  'scripts/prepare-test-artifacts.mjs',
  'scripts/test-artifact-cache.mjs',
  'scripts/ensure-wasm-artifacts.mjs',
  'scripts/run-wasm-build.mjs',
  'scripts/ensure-icons-artifacts.mjs',
  'vue/packages/demo-app/vite.config.ts',
  'vue/packages/demo-app/package.json',
  'vue/packages/demo-app/index.html',
  'vue/packages/wasm/build.config.ts',
  'vue/packages/wasm/package.json',
  'vue/packages/wasm/build.sh',
  'vue/packages/icons-vue/package.json',
  'vue/packages/theme-chalk/package.json',
]

const SUITE_REASON_CODES = {
  SUITE_SOURCE_CHANGED: 'suite-source-changed',
  SUITE_TEST_CHANGED: 'suite-test-changed',
  SHARED_RUNTIME_CHANGED: 'shared-runtime-changed',
  SHARED_BUILD_CHANGED: 'shared-build-changed',
  REGISTRY_CHANGED: 'registry-changed',
  DEPENDENCY_LOCK_CHANGED: 'dependency-lock-changed',
  DOCUMENTATION_ONLY: 'documentation-only',
  NO_RELEVANT_CHANGE: 'no-relevant-change',
  UNKNOWN_PRODUCTION_CHANGE: 'unknown-production-change',
  BASE_UNAVAILABLE: 'base-unavailable',
  ANALYSIS_FAILED: 'analysis-failed',
  FULL_PROFILE_REQUIRED: 'full-profile-required',
}

export function loadPlaywrightSuiteRegistry(repositoryRoot) {
  return JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'spec/ci/playwright-suites.json'),
      'utf8',
    ),
  )
}

function classifyDocumentationOnly(files) {
  const docPatterns = [
    /^docs?\//u,
    /\.md$/u,
    /^\.github\/(?!workflows\/)/u,
    /^LICENSE/u,
    /\.github\/dependabot/u,
    /^\.vscode\//u,
  ]
  return files.every((file) => docPatterns.some((p) => p.test(file)))
}

function isSharedRoot(file) {
  return SHARED_ROOTS.some((root) => {
    if (root.includes('*')) return matchesGlob(file, root)
    return file === root || file.startsWith(`${root}/`)
  })
}

function isLockfileChange(files) {
  return files.some((file) => file === 'pnpm-lock.yaml' || file === 'package.json')
}

function matchesImpactRoots(file, impactRoots) {
  return impactRoots.some((root) => {
    if (root.includes('*')) return matchesGlob(file, root)
    // Exact match or prefix match for directory roots
    return file === root || file.startsWith(`${root}/`) || file.startsWith(`${root.replace(/\/\*\*$/, '')}/`)
  })
}


function finalizePlanDigest(plan) {
  // Compute digest on a clean contract (no planDigest, no generatedAt)
  const contract = {}
  for (const key of Object.keys(plan).sort()) {
    if (key === 'planDigest' || key === 'generatedAt') continue
    contract[key] = plan[key]
  }
  plan.planDigest = digestOf(contract)
  return plan
}

export function createPlaywrightImpactPlan({
  changedFiles,
  registry,
  registryHash,
  baseRef,
  headRef,
  fallbackReason,
  group,
}) {
  const effectiveRegistryHash =
    registryHash ??
    registry._hash ??
    computePlaywrightRegistryHash(loadPlaywrightRegistry(path.resolve(import.meta.dirname, '..')))
  const plan = {
    schemaVersion: 1,
    baseRef: baseRef || null,
    headRef: headRef || null,
    group: group || 'pr',
    registryHash: effectiveRegistryHash,
    generatedAt: new Date().toISOString(),
    changedFiles: [...new Set(changedFiles.map((f) => f.replaceAll('\\', '/').trim()).filter(Boolean))].sort(),
    decisions: [],
    planDigest: null,
  }

  const files = plan.changedFiles
  const isNonPrGroup = group !== 'pr'

  if (isNonPrGroup) {
    // main/nightly/release always run full profile
    for (const suite of registry.suites) {
      plan.decisions.push({
        suiteId: suite.id,
        decision: 'run',
        reasonCode: SUITE_REASON_CODES.FULL_PROFILE_REQUIRED,
        reason: `${group} profile requires full execution`,
        cells: suite.cells.map((c) => c.id),
        matchedRoots: [],
      })
    }
    finalizePlanDigest(plan)
    return plan
  }

  plan.planDigest = null

  if (fallbackReason) {
    for (const suite of registry.suites) {
      plan.decisions.push({
        suiteId: suite.id,
        decision: 'run',
        reasonCode: fallbackReason.includes('base') ? SUITE_REASON_CODES.BASE_UNAVAILABLE : SUITE_REASON_CODES.ANALYSIS_FAILED,
        reason: fallbackReason,
        cells: suite.cells.map((c) => c.id),
        matchedRoots: [],
      })
    }
    finalizePlanDigest(plan)
    return plan
  }

  plan.planDigest = null

  if (files.length === 0) {
    for (const suite of registry.suites) {
      plan.decisions.push({
        suiteId: suite.id,
        decision: 'skip',
        reasonCode: SUITE_REASON_CODES.NO_RELEVANT_CHANGE,
        reason: 'no changed files detected',
        cells: [],
        matchedRoots: [],
      })
    }
    finalizePlanDigest(plan)
    return plan
  }

  if (classifyDocumentationOnly(files)) {
    for (const suite of registry.suites) {
      plan.decisions.push({
        suiteId: suite.id,
        decision: 'skip',
        reasonCode: SUITE_REASON_CODES.DOCUMENTATION_ONLY,
        reason: 'documentation-only change',
        cells: [],
        matchedRoots: [],
      })
    }
    finalizePlanDigest(plan)
    return plan
  }

  plan.planDigest = null

  const hasSharedChange = files.some((f) => isSharedRoot(f))
  const hasLockfileChange = isLockfileChange(files)

  const affectedSuiteIds = new Set()

  if (hasLockfileChange || hasSharedChange) {
    // Shared infrastructure changes trigger all suites
    for (const suite of registry.suites) {
      affectedSuiteIds.add(suite.id)
    }
  }

  for (const suite of registry.suites) {
    const matchedRoots = []
    for (const file of files) {
      if (matchesImpactRoots(file, suite.impactRoots || [])) {
        matchedRoots.push(file)
      }
    }

    if (matchedRoots.length > 0) {
      affectedSuiteIds.add(suite.id)
    }

    const decision = affectedSuiteIds.has(suite.id) ? 'run' : 'skip'
    let reasonCode
    let reason

    if (decision === 'run') {
      if (hasLockfileChange && matchedRoots.length === 0) {
        reasonCode = SUITE_REASON_CODES.DEPENDENCY_LOCK_CHANGED
        reason = 'lockfile changed; all suites must run'
      } else if (hasSharedChange && matchedRoots.length === 0) {
        reasonCode = SUITE_REASON_CODES.SHARED_RUNTIME_CHANGED
        reason = 'shared runtime/build infrastructure changed'
      } else if (matchedRoots.some((r) => r.includes('test') || r.includes('tests') || r.includes('.spec.') || r.includes('.test.'))) {
        reasonCode = SUITE_REASON_CODES.SUITE_TEST_CHANGED
        reason = `suite test/config changed: ${matchedRoots.slice(0, 3).join(', ')}${matchedRoots.length > 3 ? ` +${matchedRoots.length - 3} more` : ''}`
      } else {
        reasonCode = SUITE_REASON_CODES.SUITE_SOURCE_CHANGED
        reason = `suite source changed: ${matchedRoots.slice(0, 3).join(', ')}${matchedRoots.length > 3 ? ` +${matchedRoots.length - 3} more` : ''}`
      }
    } else {
      const hasUnknownProd = files.some((f) => {
        if (f.startsWith('docs/') || f.endsWith('.md')) return false
        if (isSharedRoot(f)) return false
        return !registry.suites.some((s) => matchesImpactRoots(f, s.impactRoots || []))
      })
      if (hasUnknownProd) {
        // Conservative: unknown production changes trigger this suite
        reasonCode = SUITE_REASON_CODES.UNKNOWN_PRODUCTION_CHANGE
        reason = 'unknown production change; conservative run'
        plan.decisions.push({
          suiteId: suite.id,
          decision: 'run',
          reasonCode,
          reason,
          cells: suite.cells.map((c) => c.id),
          matchedRoots: [],
        })
        continue
      }
      reasonCode = SUITE_REASON_CODES.NO_RELEVANT_CHANGE
      reason = 'no relevant source or test change'
    }

    plan.decisions.push({
      suiteId: suite.id,
      decision,
      reasonCode,
      reason,
      cells: decision === 'run' ? suite.cells.map((c) => c.id) : [],
      matchedRoots,
    })
  }

  finalizePlanDigest(plan)
  return plan
}

export function formatImpactPlanForGithubOutput(plan) {
  const lines = []
  const runSuites = plan.decisions.filter((d) => d.decision === 'run')
  const skipSuites = plan.decisions.filter((d) => d.decision === 'skip')

  lines.push(`pw-run-suites=${runSuites.map((d) => d.suiteId).join(',')}`)
  lines.push(`pw-skip-suites=${skipSuites.map((d) => d.suiteId).join(',')}`)
  lines.push(`pw-plan-digest=${plan.planDigest}`)

  for (const decision of plan.decisions) {
    const safeId = decision.suiteId.replace(/[^a-zA-Z0-9_]/gu, '_')
    lines.push(`pw-suite-${safeId}=${decision.decision}`)
    lines.push(`pw-reason-${safeId}=${decision.reasonCode}`)
  }

  return lines.join('\n')
}

export function verifyPlaywrightImpactPlan(plan) {
  const { planDigest } = plan
  if (!planDigest) throw new Error('Playwright impact plan missing digest')
  const contract = {}
  for (const key of Object.keys(plan).sort()) {
    if (key === 'planDigest' || key === 'generatedAt') continue
    contract[key] = plan[key]
  }
  if (digestOf(contract) !== planDigest) {
    throw new Error('Playwright impact plan digest is invalid')
  }
  if (plan.schemaVersion !== 1) {
    throw new Error('Playwright impact plan schemaVersion must be 1')
  }
  for (const decision of plan.decisions) {
    if (decision.decision !== 'run' && decision.decision !== 'skip') {
      throw new Error(`Invalid decision ${decision.decision} for ${decision.suiteId}`)
    }
    if (decision.decision === 'run' && decision.cells.length === 0) {
      throw new Error(`Suite ${decision.suiteId} marked run but no cells selected`)
    }
  }
  return plan
}
