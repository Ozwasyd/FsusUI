import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '..')
const args = new Set(process.argv.slice(2))
const checkMode = args.has('--check')

const registryPath = path.join(
  root,
  'spec/components/contracts/v1/vue-public-contracts.json',
)
const baselinePath = path.join(root, 'spec/baselines/vue-current.json')

const allowedReleaseClassifications = new Set(['preview', 'stable'])
const allowedChangeClassifications = new Set([
  'patch',
  'minor',
  'breaking-preview',
  'breaking-stable',
])
const allowedPlatformClassifications = new Set([
  'portable',
  'native-adapter',
  'platform-override',
  'web-only',
])

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}
const parseJson = (file) => JSON.parse(read(file))
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const formatGenerated = async (file, content) => {
  const prettier = await import('prettier')
  return prettier.format(content, { filepath: file })
}

const sha256 = (content) =>
  crypto.createHash('sha256').update(content).digest('hex')

const toKebab = (value) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

const sortById = (items) =>
  [...items].sort((first, second) => first.id.localeCompare(second.id))

const requiredFields = [
  'id',
  'version',
  'releaseClassification',
  'owner',
  'supportedPlatforms',
  'changeClassification',
  'platformClassification',
  'source',
  'props',
  'events',
  'contentRegions',
  'defaults',
  'stateMachine',
  'keyboardBehavior',
  'pointerBehavior',
  'accessibilityMapping',
  'themeTokens',
  'motionPolicy',
  'performanceBudget',
]

const validateContract = (contract) => {
  const errors = []
  for (const field of requiredFields) {
    if (!(field in contract))
      errors.push(`${contract.id ?? '<unknown>'} missing ${field}`)
  }
  if (!/^[a-z0-9][a-z0-9.-]+$/.test(contract.id ?? '')) {
    errors.push(`${contract.id ?? '<unknown>'} has invalid stable id`)
  }
  if (!/^\d+\.\d+\.\d+$/.test(contract.version ?? '')) {
    errors.push(`${contract.id ?? '<unknown>'} has invalid version`)
  }
  if (!allowedReleaseClassifications.has(contract.releaseClassification)) {
    errors.push(
      `${contract.id ?? '<unknown>'} has invalid releaseClassification`,
    )
  }
  if (!allowedChangeClassifications.has(contract.changeClassification)) {
    errors.push(
      `${contract.id ?? '<unknown>'} has invalid changeClassification`,
    )
  }
  if (!allowedPlatformClassifications.has(contract.platformClassification)) {
    errors.push(
      `${contract.id ?? '<unknown>'} has invalid platformClassification`,
    )
  }
  if (
    !contract.supportedPlatforms?.web ||
    !contract.supportedPlatforms?.avalonia
  ) {
    errors.push(
      `${contract.id ?? '<unknown>'} missing supported platform matrix`,
    )
  }
  for (const arrayField of [
    'props',
    'events',
    'contentRegions',
    'themeTokens',
  ]) {
    if (!Array.isArray(contract[arrayField])) {
      errors.push(
        `${contract.id ?? '<unknown>'} ${arrayField} must be an array`,
      )
    }
  }
  return errors
}

const validateRegistry = (registry, baseline) => {
  const errors = []
  if (registry.schemaVersion !== 1)
    errors.push('registry schemaVersion must be 1')
  if (!registry.registryVersion) errors.push('registryVersion is required')
  if (!registry.owner) errors.push('registry owner is required')
  if (!registry.releaseClassification) {
    errors.push('registry releaseClassification is required')
  }
  if (!Array.isArray(registry.contracts))
    errors.push('contracts must be an array')
  if (!Array.isArray(registry.webOnlyDecisions)) {
    errors.push('webOnlyDecisions must be an array')
  }

  const contractIds = new Set()
  for (const contract of registry.contracts ?? []) {
    if (contractIds.has(contract.id))
      errors.push(`duplicate contract id ${contract.id}`)
    contractIds.add(contract.id)
    errors.push(...validateContract(contract))
  }

  const contractNames = new Set(
    (registry.contracts ?? []).map((contract) => contract.source?.name),
  )
  const webOnlyNames = new Set(
    (registry.webOnlyDecisions ?? []).map((decision) => decision.source?.name),
  )
  const baselineEntries = [
    ...baseline.components.map((entry) => ({ ...entry, kind: 'component' })),
    ...baseline.directives.map((entry) => ({ ...entry, kind: 'directive' })),
    ...baseline.services.map((entry) => ({ ...entry, kind: 'service' })),
  ]

  for (const entry of baselineEntries) {
    if (entry.classification === 'web-only') {
      if (!webOnlyNames.has(entry.name)) {
        errors.push(
          `${entry.kind} ${entry.name} must have an explicit web-only decision`,
        )
      }
      continue
    }
    if (!contractNames.has(entry.name)) {
      errors.push(`${entry.kind} ${entry.name} must have a stable contract`)
    }
  }

  for (const decision of registry.webOnlyDecisions ?? []) {
    if (
      !decision.id ||
      !decision.reason ||
      !decision.owner ||
      !decision.reviewAfter
    ) {
      errors.push(
        `${decision.source?.name ?? '<unknown>'} web-only decision is incomplete`,
      )
    }
  }

  return errors
}

const platformMatrix = (classification) => ({
  web: {
    status: 'source',
    package: '@ozwasyd/element-plus',
  },
  avalonia: {
    status:
      classification === 'portable'
        ? 'required'
        : classification === 'native-adapter'
          ? 'native-adapter'
          : 'platform-override',
    package: 'FsusUI.Avalonia',
  },
})

const performanceBudget = (classification) => ({
  renderMs:
    classification === 'native-adapter'
      ? 16
      : classification === 'platform-override'
        ? 12
        : 8,
  interactionMs: 50,
  memory: 'no retained unbounded per-item state without virtualization budget',
})

const stateMachine = (kind, classification) => ({
  initial: 'default',
  states:
    kind === 'service'
      ? ['idle', 'requested', 'visible', 'dismissed']
      : classification === 'platform-override'
        ? ['default', 'opening', 'open', 'closing', 'disabled']
        : ['default', 'hover', 'focus-visible', 'active', 'disabled'],
  transitions: {
    'default->focus-visible': 'keyboard focus enters the control',
    'default->disabled': 'disabled or unavailable state is applied',
  },
  platformNotes:
    classification === 'native-adapter'
      ? 'Avalonia may use native control primitives while preserving public state names.'
      : 'Avalonia state names must remain contract-compatible with Web.',
})

const contractForEntry = (entry, kind) => ({
  id: `${kind}.${toKebab(entry.name)}`,
  version: '1.0.0',
  releaseClassification: 'preview',
  owner: 'FsusUI Core',
  supportedPlatforms: platformMatrix(entry.classification),
  changeClassification: 'minor',
  platformClassification: entry.classification,
  source: {
    kind,
    name: entry.name,
    module: entry.module,
    baseline: 'spec/baselines/vue-current.json',
  },
  props: (entry.props ?? []).map((name) => ({
    name,
    type: 'vue-source',
    default: 'vue-baseline',
    required: false,
  })),
  events: (entry.emits ?? []).map((name) => ({
    name,
    payload: 'vue-source',
  })),
  contentRegions: (entry.slots ?? []).map((slot) => ({
    name: slot.name,
    scoped: Boolean(slot.scoped),
    required: false,
  })),
  defaults: {
    source: 'vue-baseline',
    policy:
      'Preserve Vue defaults unless the platform override registry documents a supported difference.',
  },
  stateMachine: stateMachine(kind, entry.classification),
  keyboardBehavior: {
    focus:
      'platform-native focus entry must expose the same public focus state',
    activation: 'keyboard activation follows the component accessibility role',
    escape:
      'dismiss only when the component contract exposes a dismissible surface',
  },
  pointerBehavior: {
    primary:
      'pointer/tap activation maps to the same public event as Web click or selection',
    hover: 'hover-only affordances must have keyboard and touch alternatives',
  },
  accessibilityMapping: {
    role: 'derived from public component semantics',
    name: 'required when the component is interactive or status-bearing',
    automation:
      'Avalonia AutomationProperties must expose equivalent role, name, state, and value.',
  },
  themeTokens: ['color', 'typography', 'space', 'radius', 'motion'],
  motionPolicy: {
    source: 'spec/motion/README.md',
    reducedMotion: 'must honor user reduced-motion preference',
  },
  performanceBudget: performanceBudget(entry.classification),
})

const webOnlyDecisionForEntry = (entry, kind) => ({
  id: `web-only.${kind}.${toKebab(entry.name)}`,
  source: {
    kind,
    name: entry.name,
    module: entry.module,
    baseline: 'spec/baselines/vue-current.json',
  },
  owner: 'FsusUI Core',
  reviewAfter: '2026-12-31',
  reason:
    'This public Vue surface depends on browser or DOM behavior and is not part of the stable Avalonia parity target.',
  alternative:
    'Document an Avalonia-native contract in a future minor registry version before implementation.',
})

const buildRegistry = (baseline) => {
  const entries = [
    ...baseline.components.map((entry) => ({ ...entry, kind: 'component' })),
    ...baseline.directives.map((entry) => ({ ...entry, kind: 'directive' })),
    ...baseline.services.map((entry) => ({ ...entry, kind: 'service' })),
  ]
  const contracts = []
  const webOnlyDecisions = []

  for (const entry of entries) {
    if (entry.classification === 'web-only') {
      webOnlyDecisions.push(webOnlyDecisionForEntry(entry, entry.kind))
    } else {
      contracts.push(contractForEntry(entry, entry.kind))
    }
  }

  return {
    schemaVersion: 1,
    registryVersion: '1.0.0',
    releaseClassification: 'preview',
    owner: 'FsusUI Core',
    baseline: {
      path: 'spec/baselines/vue-current.json',
      hash: sha256(stableJson(baseline)),
      packageVersion: baseline.source.packageVersion,
      tokenHash: baseline.source.tokenHash,
      iconHash: baseline.source.iconHash,
    },
    changeClassifications: [
      'patch',
      'minor',
      'breaking-preview',
      'breaking-stable',
    ],
    contracts: sortById(contracts),
    webOnlyDecisions: sortById(webOnlyDecisions),
  }
}

const runFixtureAssertions = () => {
  const valid = parseJson(
    path.join(root, 'tests/fixtures/component-contracts/valid-contract.json'),
  )
  const invalid = parseJson(
    path.join(root, 'tests/fixtures/component-contracts/invalid-contract.json'),
  )
  const validErrors = validateContract(valid)
  if (validErrors.length) {
    throw new Error(`valid contract fixture failed: ${validErrors.join('; ')}`)
  }
  const invalidErrors = validateContract(invalid)
  for (const expected of [
    'missing version',
    'invalid changeClassification',
    'missing supported platform matrix',
  ]) {
    if (!invalidErrors.some((error) => error.includes(expected))) {
      throw new Error(`invalid contract fixture did not report ${expected}`)
    }
  }
}

const main = async () => {
  runFixtureAssertions()

  const baseline = parseJson(baselinePath)
  const registry = buildRegistry(baseline)
  const errors = validateRegistry(registry, baseline)
  if (errors.length) {
    throw new Error(
      `component contract registry invalid:\n- ${errors.join('\n- ')}`,
    )
  }

  const next = await formatGenerated(registryPath, stableJson(registry))
  if (checkMode) {
    if (!exists(registryPath)) {
      throw new Error(
        'spec/components/contracts/v1/vue-public-contracts.json missing',
      )
    }
    const current = read(registryPath)
    if (current !== next) {
      throw new Error(
        'component contract registry is stale; run pnpm run component-contracts:generate',
      )
    }
    console.log('component-contracts check passed')
    return
  }

  write(registryPath, next)
  console.log('component-contracts generated')
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
