#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { devices } from '@playwright/test'
import {
  loadPlaywrightSuiteRegistry,
  validatePlaywrightSuiteRegistry,
} from './playwright-suites.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OWNERS_PATH = 'spec/ci/playwright-owners.json'
const GROUP_NAMES = Object.freeze(['pr', 'main', 'nightly', 'release'])

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

const digestOf = (value) =>
  createHash('sha256').update(stableStringify(value)).digest('hex')

const sha256File = (file) => {
  if (!existsSync(file)) fail(`file missing for digest: ${file}`)
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

const sanitizeArtifactName = (value) =>
  value.replace(/[^a-zA-Z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '')

export function loadPlaywrightOwners(repositoryRoot = root) {
  const absolute = resolve(repositoryRoot, OWNERS_PATH)
  if (!existsSync(absolute)) fail(`playwright owners spec missing: ${OWNERS_PATH}`)
  return JSON.parse(readFileSync(absolute, 'utf8'))
}

export function validatePlaywrightOwners(owners, registry) {
  if (owners?.schemaVersion !== 1) {
    fail('playwright-owners schemaVersion must be 1')
  }
  if (!owners.owners || typeof owners.owners !== 'object') {
    fail('playwright-owners.owners must be an object')
  }
  const suites = registry?.suites
  for (const [ownerId, owner] of Object.entries(owners.owners)) {
    if (!/^[a-z][a-z0-9-]*$/u.test(ownerId)) {
      fail(`owner id must be lowercase kebab-case: ${ownerId}`)
    }
    if (!owner.gate || typeof owner.gate !== 'string') {
      fail(`owner ${ownerId} missing gate`)
    }
    if (!Array.isArray(owner.suiteIds) || owner.suiteIds.length === 0) {
      fail(`owner ${ownerId} must declare non-empty suiteIds`)
    }
    if (!['prepared-preview', 'native'].includes(owner.runtimeMode)) {
      fail(
        `owner ${ownerId} runtimeMode must be prepared-preview|native, got ${JSON.stringify(owner.runtimeMode)}`,
      )
    }
    if (!owner.receiptDirectory || typeof owner.receiptDirectory !== 'string') {
      fail(`owner ${ownerId} missing receiptDirectory`)
    }
    if (!owner.evidenceDirectory || typeof owner.evidenceDirectory !== 'string') {
      fail(`owner ${ownerId} missing evidenceDirectory`)
    }
    if (!owner.artifactNamespace || typeof owner.artifactNamespace !== 'object') {
      fail(`owner ${ownerId} missing artifactNamespace map`)
    }
    for (const suiteId of owner.suiteIds) {
      if (!owner.artifactNamespace[suiteId]) {
        fail(`owner ${ownerId} missing artifact namespace for suite ${suiteId}`)
      }
      if (suites) {
        const suite = suites.find((entry) => entry.id === suiteId)
        if (!suite) fail(`owner ${ownerId} references unknown suite ${suiteId}`)
        for (const cell of suite.cells) {
          const namespace = renderArtifactNamespace(
            owner.artifactNamespace[suiteId],
            suiteId,
            cell,
          )
          if (!namespace) fail(`owner ${ownerId} empty namespace for ${cell.id}`)
        }
      }
    }
    for (const [suiteId, template] of Object.entries(owner.artifactNamespace)) {
      if (!owner.suiteIds.includes(suiteId)) {
        fail(`owner ${ownerId} namespace map has undeclared suite ${suiteId}`)
      }
      if (!template.includes('{') || !template.includes('}')) {
        fail(`owner ${ownerId} namespace template for ${suiteId} must be parameterized`)
      }
    }
    if (owner.deviceByProject) {
      for (const [cellId, deviceName] of Object.entries(owner.deviceByProject)) {
        if (!devices[deviceName]) {
          fail(`owner ${ownerId} unknown Playwright device ${JSON.stringify(deviceName)}`)
        }
        const knownCell = owner.suiteIds.some((suiteId) => {
          const suite = suites?.find((entry) => entry.id === suiteId)
          return suite?.cells?.some((cell) => `${suiteId}/${cell.project}` === cellId)
        })
        if (!knownCell) {
          fail(`owner ${ownerId} deviceByProject references unknown cell ${cellId}`)
        }
      }
    }
  }
  return true
}

export const renderArtifactNamespace = (template, suiteId, cell) => {
  const values = {
    suite: suiteId,
    cell: cell.id,
    project: cell.project,
    browser: cell.dimensions?.browser ?? 'unknown',
  }
  return sanitizeArtifactName(
    template.replace(/\{(\w+)\}/gu, (match, key) => values[key] ?? match),
  )
}

export function resolveDeviceScaleFactor(cell, owner) {
  const deviceName = owner.deviceByProject?.[cell.id]
  if (!deviceName) return null
  const device = devices[deviceName]
  return typeof device?.deviceScaleFactor === 'number'
    ? device.deviceScaleFactor
    : null
}

export function planOwnerCells(
  ownerId,
  group,
  registry = loadPlaywrightSuiteRegistry(),
  owners = loadPlaywrightOwners(),
) {
  if (!GROUP_NAMES.includes(group)) {
    fail(`unknown group ${JSON.stringify(group)}; expected ${GROUP_NAMES.join(', ')}`)
  }
  const owner = owners.owners?.[ownerId]
  if (!owner) fail(`unknown playwright owner ${JSON.stringify(ownerId)}`)
  validatePlaywrightOwners(owners, registry)
  validatePlaywrightSuiteRegistry(registry)

  const selectedSuiteIds =
    group === 'pr'
      ? owner.suiteIds.filter((suiteId) =>
          (registry.profiles.pr.suiteIds ?? []).includes(suiteId),
        )
      : [...owner.suiteIds]
  if (selectedSuiteIds.length === 0) {
    // PR profiles can exclude all suites before impact planner is implemented;
    // return an empty plan with a valid digest so downstream runners can emit skip receipts.
    const emptyPlan = {
      schemaVersion: 1,
      owner: ownerId,
      gate: owner.gate,
      group,
      generatedFrom: 'spec/ci/playwright-suites.json',
      ownersFrom: OWNERS_PATH,
      runtimeMode: owner.runtimeMode,
      receiptDirectory: owner.receiptDirectory,
      evidenceDirectory: owner.evidenceDirectory,
      cells: [],
    }
    emptyPlan.digest = digestOf({ owner: emptyPlan.owner, group: emptyPlan.group, cells: [] })
    return emptyPlan
  }

  const cells = []
  const outputDirectories = new Set()
  const reportDirectories = new Set()
  const namespaces = new Set()
  for (const suiteId of selectedSuiteIds) {
    const suite = registry.suites.find((entry) => entry.id === suiteId)
    if (!suite) fail(`owner ${ownerId} references unknown suite ${suiteId}`)
    for (const cell of suite.cells) {
      const project = cell.project
      const outputDirectory = resolve(root, owner.evidenceDirectory, 'output', suiteId, project)
      const reportDirectory = resolve(root, owner.evidenceDirectory, 'reports', suiteId, project)
      const receiptPath = resolve(root, owner.receiptDirectory, `${cell.id.replaceAll('/', '-')}.json`)
      const namespace = renderArtifactNamespace(
        owner.artifactNamespace[suiteId],
        suiteId,
        cell,
      )
      if (outputDirectories.has(outputDirectory)) {
        fail(`owner ${ownerId} duplicate output directory for ${cell.id}`)
      }
      if (reportDirectories.has(reportDirectory)) {
        fail(`owner ${ownerId} duplicate report directory for ${cell.id}`)
      }
      if (namespaces.has(namespace)) {
        fail(`owner ${ownerId} duplicate artifact namespace ${namespace}`)
      }
      outputDirectories.add(outputDirectory)
      reportDirectories.add(reportDirectory)
      namespaces.add(namespace)
      const command = [
        'pnpm',
        'exec',
        'playwright',
        'test',
        `--config=${suite.config}`,
        `--project=${project}`,
        '--reporter=json',
        `--output=${outputDirectory}`,
      ]
      cells.push({
        id: cell.id,
        suiteId,
        project,
        command: command.join(' '),
        config: suite.config,
        dimensions: {
          browser: cell.dimensions.browser,
          viewport: cell.dimensions.viewport ?? null,
          theme: cell.dimensions.theme ?? null,
          deviceScaleFactor: resolveDeviceScaleFactor(
            { id: cell.id, dimensions: cell.dimensions },
            owner,
          ),
        },
        outputDirectory: outputDirectory.slice(root.length + 1),
        reportDirectory: reportDirectory.slice(root.length + 1),
        receiptPath: receiptPath.slice(root.length + 1),
        artifactNamespace: namespace,
        configSha256: sha256File(resolve(root, suite.config)),
      })
    }
  }
  const plan = {
    schemaVersion: 1,
    owner: ownerId,
    gate: owner.gate,
    group,
    generatedFrom: 'spec/ci/playwright-suites.json',
    ownersFrom: OWNERS_PATH,
    runtimeMode: owner.runtimeMode,
    receiptDirectory: owner.receiptDirectory,
    evidenceDirectory: owner.evidenceDirectory,
    cells,
  }
  plan.digest = digestOf({ owner: plan.owner, group: plan.group, cells: plan.cells })
  return plan
}

export function assertOwnerFixedCells(plan, expectedCellIds, label = 'owner plan') {
  const actual = plan.cells.map((cell) => cell.id)
  if (JSON.stringify(actual) !== JSON.stringify(expectedCellIds)) {
    fail(
      `${label} must contain exactly ${JSON.stringify(expectedCellIds)}, got ${JSON.stringify(actual)}`,
    )
  }
  return true
}

export function validatePlanIsolation(plan) {
  const failures = []
  const outputDirectories = new Set()
  const reportDirectories = new Set()
  const namespaces = new Set()
  for (const cell of plan.cells) {
    if (outputDirectories.has(cell.outputDirectory)) {
      failures.push(`duplicate output directory ${cell.outputDirectory}`)
    }
    if (reportDirectories.has(cell.reportDirectory)) {
      failures.push(`duplicate report directory ${cell.reportDirectory}`)
    }
    if (namespaces.has(cell.artifactNamespace)) {
      failures.push(`duplicate artifact namespace ${cell.artifactNamespace}`)
    }
    outputDirectories.add(cell.outputDirectory)
    reportDirectories.add(cell.reportDirectory)
    namespaces.add(cell.artifactNamespace)
  }
  return failures
}

export function formatOwnerPlan(plan, { json = false } = {}) {
  if (json) return `${JSON.stringify(plan, null, 2)}\n`
  const lines = [
    `Playwright owner ${plan.owner} group=${plan.group} digest=${plan.digest}`,
    `gate=${plan.gate} runtimeMode=${plan.runtimeMode} cells=${plan.cells.length}`,
  ]
  for (const cell of plan.cells) {
    lines.push(
      `- ${cell.id} project=${cell.project} namespace=${cell.artifactNamespace}`,
      `    dims=${JSON.stringify(cell.dimensions)}`,
      `    command=${cell.command}`,
      `    receipt=${cell.receiptPath}`,
    )
  }
  return `${lines.join('\n')}\n`
}

const option = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

const hasFlag = (args, name) => args.includes(`--${name}`)

function main(argv = process.argv.slice(2)) {
  const command = argv[0]
  if (command === 'owners') {
    const owners = loadPlaywrightOwners()
    process.stdout.write(
      hasFlag(argv, 'json')
        ? `${JSON.stringify(owners, null, 2)}\n`
        : `${Object.entries(owners.owners)
            .map(([id, owner]) => `${id}\tgate=${owner.gate}\tsuites=${owner.suiteIds.join(',')}`)
            .join('\n')}\n`,
    )
    return
  }
  if (command === 'owner-plan') {
    const ownerId = option(argv, 'owner')
    const group = option(argv, 'group', 'main')
    if (!ownerId) fail('owner-plan requires --owner')
    const plan = planOwnerCells(ownerId, group, loadPlaywrightSuiteRegistry())
    process.stdout.write(formatOwnerPlan(plan, { json: hasFlag(argv, 'json') }))
    return
  }
  if (command === 'cell-command') {
    const ownerId = option(argv, 'owner')
    const cellId = option(argv, 'cell')
    if (!ownerId || !cellId) fail('cell-command requires --owner and --cell')
    const plan = planOwnerCells(ownerId, option(argv, 'group', 'main'), loadPlaywrightSuiteRegistry())
    const cell = plan.cells.find((entry) => entry.id === cellId)
    if (!cell) fail(`unknown cell ${cellId} for owner ${ownerId}`)
    process.stdout.write(`FSUS_PLAYWRIGHT_EXTERNAL_SERVER=http://127.0.0.1:4181 ${cell.command}\n`)
    return
  }
  if (command === 'check') {
    const registry = loadPlaywrightSuiteRegistry()
    const owners = loadPlaywrightOwners()
    validatePlaywrightOwners(owners, registry)
    validatePlaywrightSuiteRegistry(registry)
    for (const ownerId of Object.keys(owners.owners)) {
      for (const group of GROUP_NAMES) {
        const plan = planOwnerCells(ownerId, group, registry, owners)
        const isolation = validatePlanIsolation(plan)
        if (isolation.length > 0) {
          fail(`plan isolation failed for ${ownerId} ${group}: ${isolation.join('; ')}`)
        }
      }
    }
    console.log('[layout-playwright] owners + plan check ok')
    return
  }
  fail(
    'Usage: layout-playwright-plan.mjs <owners|owner-plan|cell-command|check> [options]',
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
