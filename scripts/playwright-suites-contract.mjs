import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { playwrightSuiteProjectContracts } from './playwright-suite-projects.mjs'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const registryPath = path.join(repoRoot, 'spec/ci/playwright-suites.json')
export const schemaPath = path.join(repoRoot, 'spec/ci/playwright-suites.schema.json')
export const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))

export const stableStringify = (value) => JSON.stringify(sortValue(value))
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    )
  return value
}
export const sha256 = (value) =>
  createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex')

const fail = (pathLabel, message) => {
  throw new Error(`${pathLabel}: ${message}`)
}
const string = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) fail(label, 'must be a non-empty string')
}
const unique = (values, label) => {
  if (new Set(values).size !== values.length) fail(label, 'contains duplicate values')
}
const canonicalCell = (suiteId, cell) =>
  stableStringify({ suite: suiteId, ...cell })

export function validatePlaywrightRegistry(candidate = registry, options = {}) {
  const packageJson = options.packageJson ?? JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  const projectContracts = options.projectContracts ?? playwrightSuiteProjectContracts
  if (candidate.schemaVersion !== 1) fail('schemaVersion', 'must equal 1')
  if (!Array.isArray(candidate.dimensionKeys) || candidate.dimensionKeys.length === 0)
    fail('dimensionKeys', 'must be a non-empty array')
  unique(candidate.dimensionKeys, 'dimensionKeys')
  for (const profile of ['pr', 'main', 'nightly', 'release'])
    if (!candidate.profiles?.[profile]) fail(`profiles.${profile}`, 'is required')
  if (!Array.isArray(candidate.suites) || candidate.suites.length === 0)
    fail('suites', 'must be a non-empty array')
  const suiteIds = candidate.suites.map((suite) => suite.id)
  unique(suiteIds, 'suites[].id')
  const namespaceOwners = new Map()
  const cells = new Set()
  for (const [suiteIndex, suite] of candidate.suites.entries()) {
    const label = `suites[${suiteIndex}](${suite.id ?? 'unknown'})`
    string(suite.id, `${label}.id`)
    if (suite.id === 'default' || suite.id === 'browser-tests')
      fail(`${label}.id`, 'implicit or umbrella suite ids are forbidden')
    string(suite.command, `${label}.command`)
    string(suite.packageScript, `${label}.packageScript`)
    string(suite.config, `${label}.config`)
    if (!fs.existsSync(path.join(repoRoot, suite.config))) fail(`${label}.config`, 'file does not exist')
    const expectedCommand = `pnpm ${suite.packageScript}`
    if (suite.command !== expectedCommand)
      fail(`${label}.command`, `must equal ${expectedCommand}`)
    if (!packageJson.scripts?.[suite.packageScript])
      fail(`${label}.packageScript`, 'does not exist in package.json')
    if (!Array.isArray(suite.profiles) || suite.profiles.length === 0)
      fail(`${label}.profiles`, 'must be non-empty')
    unique(suite.profiles, `${label}.profiles`)
    for (const profile of suite.profiles)
      if (!candidate.profiles[profile]) fail(`${label}.profiles`, `unknown profile ${profile}`)
    if (!Array.isArray(suite.cells) || suite.cells.length === 0)
      fail(`${label}.cells`, 'must be non-empty; runtime matrix guessing is forbidden')
    const allowedDimensions = new Set(candidate.dimensionKeys.filter((key) => key !== 'suite'))
    const suiteCells = []
    for (const [cellIndex, cell] of suite.cells.entries()) {
      const cellLabel = `${label}.cells[${cellIndex}]`
      for (const key of Object.keys(cell))
        if (!allowedDimensions.has(key)) fail(cellLabel, `unknown dimension ${key}`)
      string(cell.project, `${cellLabel}.project`)
      if (!['chromium', 'firefox', 'webkit'].includes(cell.browser))
        fail(`${cellLabel}.browser`, 'must explicitly be chromium, firefox, or webkit')
      if (/^(desktop|mobile|tiny)-(light|dark)$/u.test(cell.browser))
        fail(`${cellLabel}.browser`, 'viewport/theme project name cannot be used as browser')
      const identity = canonicalCell(suite.id, cell)
      if (cells.has(identity)) fail(cellLabel, 'duplicates another execution cell')
      cells.add(identity)
      suiteCells.push(stableStringify(cell))
    }
    const planned = projectContracts[suite.id]
    if (!planned) fail(label, 'has no static Playwright project planner contract')
    const plannedCells = planned.map(stableStringify)
    if (stableStringify([...plannedCells].sort()) !== stableStringify([...suiteCells].sort()))
      fail(label, 'registry cells and config project planner are not bidirectionally identical')
    for (const field of ['namespace', 'report', 'trace', 'screenshot', 'receipt'])
      string(suite.artifacts?.[field], `${label}.artifacts.${field}`)
    const namespace = suite.artifacts.namespace
    if (namespaceOwners.has(namespace))
      fail(`${label}.artifacts.namespace`, `collides with ${namespaceOwners.get(namespace)}`)
    namespaceOwners.set(namespace, suite.id)
    if (!Array.isArray(suite.impactRoots) || suite.impactRoots.length === 0)
      fail(`${label}.impactRoots`, 'must be non-empty')
    unique(suite.impactRoots, `${label}.impactRoots`)
    if (typeof suite.affectedSkip?.allowed !== 'boolean')
      fail(`${label}.affectedSkip.allowed`, 'must be boolean')
    if (!Array.isArray(suite.affectedSkip?.reasonTypes))
      fail(`${label}.affectedSkip.reasonTypes`, 'must be an array')
    if (!suite.profiles.includes('release')) fail(`${label}.profiles`, 'must explicitly include release')
  }
  const reuse = candidate.suites.find((suite) => suite.id === 'visual-runtime-reuse')
  if (!reuse || reuse.coverageKind !== 'runtime-contract')
    fail('visual-runtime-reuse.coverageKind', 'must be runtime-contract')
  if (reuse.cells.some((cell) => cell.runtimeMode !== 'prepared-reuse'))
    fail('visual-runtime-reuse.cells', 'must declare runtimeMode=prepared-reuse')
  if (candidate.profiles.release.evidenceScope !== 'current-workflow-run')
    fail('profiles.release.evidenceScope', 'must bind evidence to current-workflow-run')
  return candidate
}

export function planForProfile(profile, candidate = registry) {
  validatePlaywrightRegistry(candidate)
  if (!candidate.profiles[profile]) fail('profile', `unknown profile ${profile}`)
  const suites = candidate.suites
    .filter((suite) => suite.profiles.includes(profile))
    .map((suite) => ({
      id: suite.id,
      command: suite.command,
      config: suite.config,
      runtimeType: suite.runtimeType,
      coverageKind: suite.coverageKind,
      profile,
      cells: suite.cells.map((cell) => ({ suite: suite.id, ...cell })),
      artifacts: suite.artifacts,
      affectedSkip: suite.affectedSkip,
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
  return {
    schemaVersion: 1,
    profile,
    registryHash: sha256(candidate),
    executionScope: profile === 'pr' ? 'affected-or-receipted-skip' : 'full-current-run',
    suites,
  }
}
