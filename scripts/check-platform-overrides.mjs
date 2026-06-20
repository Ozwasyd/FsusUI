import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const requiredFields = [
  'id',
  'area',
  'component',
  'platform',
  'status',
  'reason',
  'owner',
  'reviewAfter',
  'testPolicy',
  'affectedContracts',
  'visualThreshold',
  'behaviorExpectation',
  'allowedDeviation',
  'linkedIssues',
]

const allowedAreas = new Set([
  'accessibility',
  'api',
  'behavior',
  'interaction',
  'typography',
  'visual',
])
const allowedStatuses = new Set(['accepted', 'expired'])
const allowedVisualThresholds = new Set(['none', 'low', 'medium', 'high'])

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)

const toPosix = (value) => value.split(path.sep).join('/')

const parseValue = (value) => {
  const trimmed = value.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return trimmed.replace(/^['"]|['"]$/g, '')
}

const parseOverrideFile = (file) => {
  const entries = []
  let current
  let pendingKey
  const lines = read(file).split('\n')
  for (const line of lines) {
    const start = line.match(/^ {2}- id:\s*(.+)$/)
    if (start) {
      pendingKey = undefined
      current = {
        id: parseValue(start[1]),
        file: toPosix(path.relative(root, file)),
      }
      entries.push(current)
      continue
    }
    if (!current) continue
    if (pendingKey) {
      const continuation = line.match(/^ {6,}(.+)$/)
      if (continuation) {
        current[pendingKey] = parseValue(continuation[1])
        pendingKey = undefined
        continue
      }
    }
    const field = line.match(/^ {4}([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)
    if (field) {
      if (field[2].trim() === '') {
        pendingKey = field[1]
      } else {
        current[field[1]] = parseValue(field[2])
        pendingKey = undefined
      }
    }
  }
  return entries
}

const collectOverrideFiles = () =>
  fs
    .readdirSync(path.join(root, 'spec/platform-overrides'))
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => path.join(root, 'spec/platform-overrides', file))
    .sort()

const loadContractIds = () => {
  const registryPath = path.join(
    root,
    'spec/components/contracts/v1/vue-public-contracts.json',
  )
  const registry = JSON.parse(read(registryPath))
  return new Set(registry.contracts.map((contract) => contract.id))
}

const isExpired = (reviewAfter, today = new Date()) => {
  const reviewDate = new Date(`${reviewAfter}T23:59:59Z`)
  if (Number.isNaN(reviewDate.getTime())) return true
  return reviewDate < today
}

const validateOverrides = (entries, contractIds, options = {}) => {
  const today = options.today ?? new Date()
  const errors = []
  const ids = new Set()

  for (const entry of entries) {
    const label = `${entry.file}:${entry.id ?? '<missing-id>'}`
    if (ids.has(entry.id)) errors.push(`${label} duplicate override id`)
    ids.add(entry.id)

    for (const field of requiredFields) {
      if (!(field in entry) || entry[field] === '') {
        errors.push(`${label} missing ${field}`)
      }
    }
    if (entry.area && !allowedAreas.has(entry.area)) {
      errors.push(`${label} invalid area ${entry.area}`)
    }
    if (entry.status && !allowedStatuses.has(entry.status)) {
      errors.push(`${label} invalid status ${entry.status}`)
    }
    if (
      entry.visualThreshold &&
      !allowedVisualThresholds.has(entry.visualThreshold)
    ) {
      errors.push(`${label} invalid visualThreshold ${entry.visualThreshold}`)
    }
    if (entry.reviewAfter && isExpired(entry.reviewAfter, today)) {
      errors.push(`${label} expired reviewAfter ${entry.reviewAfter}`)
    }
    if (
      !Array.isArray(entry.affectedContracts) ||
      !entry.affectedContracts.length
    ) {
      errors.push(`${label} missing affectedContracts`)
    } else {
      for (const contractId of entry.affectedContracts) {
        if (!contractIds.has(contractId)) {
          errors.push(`${label} invalid affected component id ${contractId}`)
        }
      }
    }
  }

  return errors
}

const scanForUnregisteredMarkers = () => {
  const roots = ['dotnet', 'docs', 'packages', 'scripts', 'spec', 'tests']
  const banned = [/TODO platform difference/i, /UNREGISTERED_PLATFORM_OVERRIDE/]
  const matches = []

  const walk = (directory) => {
    if (!exists(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', 'bin', 'obj'].includes(entry.name)) continue
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (
        !/\.(axaml|cs|css|json|md|mjs|scss|ts|tsx|vue|yaml)$/.test(entry.name)
      ) {
        continue
      }
      const relativePath = toPosix(path.relative(root, fullPath))
      if (relativePath === 'scripts/check-platform-overrides.mjs') continue
      const content = read(fullPath)
      for (const pattern of banned) {
        if (pattern.test(content))
          matches.push(`${relativePath} matches ${pattern}`)
      }
    }
  }

  for (const directory of roots) walk(path.join(root, directory))
  return matches
}

const validateReleaseEvidence = (entries) => {
  const evidenceFile = path.join(root, 'docs/releases/platform-overrides.md')
  if (!exists(evidenceFile))
    return ['docs/releases/platform-overrides.md missing']
  const evidence = read(evidenceFile)
  return entries
    .filter((entry) => entry.status === 'accepted')
    .filter((entry) => !evidence.includes(entry.id))
    .map((entry) => `release evidence missing ${entry.id}`)
}

const runFixtureAssertions = () => {
  const fixtureRoot = path.join(root, 'tests/fixtures/platform-overrides')
  const valid = parseOverrideFile(path.join(fixtureRoot, 'valid.yaml'))
  const invalid = parseOverrideFile(path.join(fixtureRoot, 'invalid.yaml'))
  const fixtureContracts = new Set(['component.el-button'])
  const validErrors = validateOverrides(valid, fixtureContracts, {
    today: new Date('2026-06-21T00:00:00Z'),
  })
  if (validErrors.length) {
    throw new Error(
      `valid platform override fixture failed: ${validErrors.join('; ')}`,
    )
  }
  const invalidErrors = validateOverrides(invalid, fixtureContracts, {
    today: new Date('2026-06-21T00:00:00Z'),
  })
  for (const expected of [
    'missing owner',
    'expired reviewAfter',
    'missing testPolicy',
    'invalid affected component id',
  ]) {
    if (!invalidErrors.some((error) => error.includes(expected))) {
      throw new Error(
        `invalid platform override fixture did not report ${expected}`,
      )
    }
  }
}

try {
  runFixtureAssertions()
  const contractIds = loadContractIds()
  const entries = collectOverrideFiles().flatMap(parseOverrideFile)
  const errors = [
    ...validateOverrides(entries, contractIds),
    ...scanForUnregisteredMarkers(),
    ...validateReleaseEvidence(entries),
  ]
  if (errors.length) {
    throw new Error(
      `platform override governance failed:\n- ${errors.join('\n- ')}`,
    )
  }
  console.log('platform-overrides check passed')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
