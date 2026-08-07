#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY_PATH = 'spec/ci/playwright-suites.json'
const SCHEMA_PATH = 'spec/ci/playwright-suites.schema.json'
const FIXED_SUITE_IDS = Object.freeze([
  'view-transitions',
  'motion-ssr',
  'dom-layout',
  'geometry-smoke',
  'markdown-editor-interaction',
  'visual-boundary-audit',
  'visual-runtime-reuse',
])
const PROFILE_NAMES = Object.freeze(['pr', 'main', 'nightly', 'release'])
const DIMENSION_KEYS = Object.freeze([
  'browser',
  'viewport',
  'theme',
  'safeArea',
  'runtimeMode',
])

export const PLAYWRIGHT_SUITE_REGISTRY_PATH = REGISTRY_PATH

const fail = (message) => {
  throw new Error(message)
}

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/** Minimal schema checks without external ajv (keeps check install-free). */
export function validateRegistryShape(registry) {
  if (registry?.schemaVersion !== 1) {
    fail('playwright-suites schemaVersion must be 1')
  }
  if (!Array.isArray(registry.suites) || registry.suites.length === 0) {
    fail('playwright-suites.suites must be a non-empty array')
  }
  if (!registry.profiles || typeof registry.profiles !== 'object') {
    fail('playwright-suites.profiles must be an object')
  }
  for (const name of PROFILE_NAMES) {
    if (!registry.profiles[name]) {
      fail(`playwright-suites.profiles.${name} is required`)
    }
    if (!Array.isArray(registry.profiles[name].suiteIds)) {
      fail(`playwright-suites.profiles.${name}.suiteIds must be an array`)
    }
  }
}

export function loadPlaywrightSuiteRegistry(
  repositoryRoot = root,
  registryPath = REGISTRY_PATH,
) {
  const absolute = resolve(repositoryRoot, registryPath)
  if (!existsSync(absolute)) {
    fail(`playwright suite registry missing: ${registryPath}`)
  }
  if (!existsSync(resolve(repositoryRoot, SCHEMA_PATH))) {
    fail(`playwright suite schema missing: ${SCHEMA_PATH}`)
  }
  const registry = JSON.parse(readFileSync(absolute, 'utf8'))
  validateRegistryShape(registry)
  return registry
}

const loadProjectContract = (repositoryRoot, relativePath) => {
  if (!relativePath) fail('suite.projectContract is required')
  const absolute = resolve(repositoryRoot, relativePath)
  if (!existsSync(absolute)) {
    fail(`project contract missing: ${relativePath}`)
  }
  return JSON.parse(readFileSync(absolute, 'utf8'))
}

/**
 * Pure-data project contract is the authority for config project cells.
 * Config files must declare the same project names (structural presence).
 */
const collectConfigSources = (repositoryRoot, configRelative, seen = new Set()) => {
  const absolute = resolve(repositoryRoot, configRelative)
  if (seen.has(absolute) || !existsSync(absolute)) return []
  seen.add(absolute)
  const source = readFileSync(absolute, 'utf8')
  const sources = [source]
  // Follow relative config imports (e.g. reuse.config → playwright.config)
  for (const match of source.matchAll(
    /from\s+['"](\.\/[^'"]+\.ts|\.\/[^'"]+\.js|\.\/[^'"]+)['"]/gu,
  )) {
    let relative = match[1]
    if (!relative.endsWith('.ts') && !relative.endsWith('.js')) {
      relative = `${relative}.ts`
    }
    const child = resolve(dirname(absolute), relative)
    const childRelative = child.startsWith(repositoryRoot)
      ? child.slice(repositoryRoot.length + 1)
      : null
    if (childRelative) {
      sources.push(...collectConfigSources(repositoryRoot, childRelative, seen))
    }
  }
  return sources
}

const assertConfigDeclaresProjects = (
  repositoryRoot,
  configRelative,
  projects,
  suiteId,
) => {
  const sources = collectConfigSources(repositoryRoot, configRelative)
  const configSource = sources.join('\n')
  // Presence of each pure-data project name in the config graph is the
  // structural check (configs may also re-export base projects).
  for (const project of projects) {
    if (project.name === 'default') {
      if (
        !/browserName:\s*['"]chromium['"]/u.test(configSource) &&
        !/projects:\s*\[/u.test(configSource)
      ) {
        // Implicit default project is allowed when pure-data uses name "default".
      }
      continue
    }
    const pattern = new RegExp(
      `name:\\s*['"]${project.name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}['"]`,
      'u',
    )
    if (!pattern.test(configSource)) {
      fail(
        `suite ${suiteId}: Playwright config does not declare project ${JSON.stringify(project.name)}`,
      )
    }
  }
}

const dimensionsEqual = (left, right) =>
  stableStringify(left) === stableStringify(right)

export function validatePlaywrightSuiteRegistry(
  registry,
  repositoryRoot = root,
  { packageJson } = {},
) {
  validateRegistryShape(registry)
  const pkg =
    packageJson ??
    JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'))
  const scripts = pkg.scripts ?? {}

  const suiteIds = registry.suites.map((suite) => suite.id)
  const missingFixed = FIXED_SUITE_IDS.filter((id) => !suiteIds.includes(id))
  if (missingFixed.length) {
    fail(
      `playwright suite registry missing fixed suite ids: ${missingFixed.join(', ')}`,
    )
  }
  if (suiteIds.length !== FIXED_SUITE_IDS.length) {
    fail(
      `playwright suite registry must contain exactly the seven fixed suites, found ${suiteIds.length}`,
    )
  }
  if (new Set(suiteIds).size !== suiteIds.length) {
    fail('playwright suite ids must be unique')
  }

  const namespaces = new Set()
  const cellIds = new Set()
  const receiptPaths = new Set()

  for (const suite of registry.suites) {
    if (!FIXED_SUITE_IDS.includes(suite.id)) {
      fail(`unknown suite id ${suite.id}`)
    }
    if (!suite.command || typeof suite.command !== 'string') {
      fail(`suite ${suite.id} missing command`)
    }
    if (!suite.config || !existsSync(resolve(repositoryRoot, suite.config))) {
      fail(`suite ${suite.id} config missing: ${suite.config}`)
    }
    if (!Array.isArray(suite.cells) || suite.cells.length === 0) {
      fail(`suite ${suite.id} must declare non-empty cells`)
    }
    if (!suite.artifacts?.namespace) {
      fail(`suite ${suite.id} missing artifacts.namespace`)
    }
    if (namespaces.has(suite.artifacts.namespace)) {
      fail(
        `duplicate artifact namespace ${JSON.stringify(suite.artifacts.namespace)}`,
      )
    }
    namespaces.add(suite.artifacts.namespace)
    if (receiptPaths.has(suite.artifacts.receiptPath)) {
      fail(`duplicate receipt path ${suite.artifacts.receiptPath}`)
    }
    receiptPaths.add(suite.artifacts.receiptPath)

    // package.json command consistency: registry command is `pnpm <script>` or full
    const scriptMatch = /^pnpm\s+(\S+)$/u.exec(suite.command.trim())
    if (!scriptMatch) {
      fail(
        `suite ${suite.id} command must be "pnpm <script>", got ${JSON.stringify(suite.command)}`,
      )
    }
    const scriptName = scriptMatch[1]
    if (!scripts[scriptName]) {
      fail(
        `suite ${suite.id} command script ${JSON.stringify(scriptName)} missing from package.json`,
      )
    }
    if (!scripts[scriptName].includes(suite.config.replace(/^vue\//u, ''))) {
      // config path may appear with vue/ prefix in scripts
      if (!scripts[scriptName].includes(suite.config)) {
        fail(
          `suite ${suite.id}: package.json script ${scriptName} does not reference config ${suite.config}`,
        )
      }
    }

    if (suite.runtime === 'runtime-contract') {
      if (suite.countsTowardProductBrowserCoverage !== false) {
        fail(
          `suite ${suite.id} runtime-contract must set countsTowardProductBrowserCoverage=false`,
        )
      }
    }

    const contract = loadProjectContract(
      repositoryRoot,
      suite.projectContract ??
        `spec/ci/playwright-project-contracts/${suite.id}.json`,
    )
    if (contract.suiteId !== suite.id) {
      fail(
        `project contract suiteId ${contract.suiteId} does not match suite ${suite.id}`,
      )
    }
    if (contract.config !== suite.config) {
      fail(
        `project contract config mismatch for ${suite.id}: ${contract.config} vs ${suite.config}`,
      )
    }
    if (!Array.isArray(contract.projects) || contract.projects.length === 0) {
      fail(`project contract for ${suite.id} has empty projects`)
    }

    // Bidirectional: registry cells ↔ pure-data contract
    if (suite.cells.length !== contract.projects.length) {
      fail(
        `suite ${suite.id}: cell count ${suite.cells.length} != contract projects ${contract.projects.length}`,
      )
    }
    const contractByName = new Map(
      contract.projects.map((project) => [project.name, project]),
    )
    for (const cell of suite.cells) {
      if (cellIds.has(cell.id)) {
        fail(`duplicate cell id ${cell.id}`)
      }
      cellIds.add(cell.id)
      if (!cell.dimensions?.browser) {
        fail(`cell ${cell.id} must explicitly declare dimensions.browser`)
      }
      // Forbid composite fake browser names
      if (
        typeof cell.dimensions.browser === 'string' &&
        cell.dimensions.browser.includes('-')
      ) {
        fail(
          `cell ${cell.id}: browser must not be a composite like desktop-dark (got ${cell.dimensions.browser})`,
        )
      }
      for (const key of Object.keys(cell.dimensions)) {
        if (!DIMENSION_KEYS.includes(key)) {
          fail(`cell ${cell.id}: unknown dimension key ${key}`)
        }
      }
      const contractProject = contractByName.get(cell.project)
      if (!contractProject) {
        fail(
          `suite ${suite.id}: cell project ${cell.project} missing from pure-data contract`,
        )
      }
      if (!dimensionsEqual(cell.dimensions, contractProject.dimensions)) {
        fail(
          `suite ${suite.id}: dimensions mismatch for project ${cell.project}`,
        )
      }
    }
    for (const project of contract.projects) {
      if (!suite.cells.some((cell) => cell.project === project.name)) {
        fail(
          `suite ${suite.id}: contract project ${project.name} missing from registry cells`,
        )
      }
    }

    assertConfigDeclaresProjects(
      repositoryRoot,
      suite.config,
      contract.projects,
      suite.id,
    )
  }

  // Profiles
  const known = new Set(suiteIds)
  for (const name of PROFILE_NAMES) {
    for (const suiteId of registry.profiles[name].suiteIds) {
      if (!known.has(suiteId)) {
        fail(
          `profile ${name} references unknown suite ${JSON.stringify(suiteId)}`,
        )
      }
    }
  }
  // release must list required suites explicitly (full set for mainline critical suites)
  for (const suiteId of FIXED_SUITE_IDS) {
    if (!registry.profiles.release.suiteIds.includes(suiteId)) {
      fail(`release profile must explicitly list suite ${suiteId}`)
    }
  }

  // Product browser coverage: visual-runtime-reuse must not be counted
  const reuse = registry.suites.find(
    (suite) => suite.id === 'visual-runtime-reuse',
  )
  if (!reuse || reuse.countsTowardProductBrowserCoverage !== false) {
    fail(
      'visual-runtime-reuse must not count toward product browser coverage',
    )
  }

  return true
}

export function planPlaywrightSuites(group, registry = loadPlaywrightSuiteRegistry()) {
  if (!PROFILE_NAMES.includes(group)) {
    fail(
      `unknown group ${JSON.stringify(group)}; expected one of ${PROFILE_NAMES.join(', ')}`,
    )
  }
  validatePlaywrightSuiteRegistry(registry)
  const suiteIds = registry.profiles[group].suiteIds
  const byId = new Map(registry.suites.map((suite) => [suite.id, suite]))
  const plan = {
    group,
    schemaVersion: registry.schemaVersion,
    generatedFrom: REGISTRY_PATH,
    // Release/main cells bind to the current workflow run at execution time;
    // the plan never points at historical external evidence.
    runBinding: 'current-workflow-run',
    suites: suiteIds.map((suiteId) => {
      const suite = byId.get(suiteId)
      return {
        id: suite.id,
        command: suite.command,
        config: suite.config,
        runtime: suite.runtime,
        cells: suite.cells.map((cell) => ({
          id: cell.id,
          project: cell.project,
          dimensions: cell.dimensions,
        })),
        profile: group,
        impactRoots: suite.impactRoots,
        artifacts: suite.artifacts,
        allowAffectedSkip: suite.allowAffectedSkip,
        skipReasonTypes: suite.skipReasonTypes,
        countsTowardProductBrowserCoverage:
          suite.countsTowardProductBrowserCoverage,
      }
    }),
  }
  plan.digest = createHash('sha256')
    .update(stableStringify(plan.suites))
    .digest('hex')
  return plan
}

export function formatPlaywrightPlan(plan, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify(plan, null, 2)}\n`
  }
  const lines = [
    `Playwright suite plan group=${plan.group} digest=${plan.digest}`,
    `runBinding=${plan.runBinding}`,
  ]
  for (const suite of plan.suites) {
    lines.push(
      `- ${suite.id}: command=${suite.command} cells=${suite.cells.length} skip=${suite.allowAffectedSkip} coverage=${suite.countsTowardProductBrowserCoverage}`,
    )
    for (const cell of suite.cells) {
      lines.push(
        `    cell ${cell.id} project=${cell.project} dims=${JSON.stringify(cell.dimensions)}`,
      )
    }
  }
  return `${lines.join('\n')}\n`
}

function parseArgs(argv) {
  const args = argv.filter((argument) => argument !== '--')
  const command = args[0]
  const json = args.includes('--json')
  let group = 'main'
  const groupIndex = args.indexOf('--group')
  if (groupIndex >= 0) {
    group = args[groupIndex + 1]
  }
  return { command, json, group }
}

function main(argv = process.argv.slice(2)) {
  const { command, json, group } = parseArgs(argv)
  if (command === 'check') {
    validatePlaywrightSuiteRegistry(loadPlaywrightSuiteRegistry())
    console.log('[playwright-suites] check ok')
    return
  }
  if (command === 'plan') {
    const plan = planPlaywrightSuites(group)
    process.stdout.write(formatPlaywrightPlan(plan, { json }))
    return
  }
  fail(
    'Usage: node scripts/playwright-suites.mjs <plan|check> [--group pr|main|nightly|release] [--json]',
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
