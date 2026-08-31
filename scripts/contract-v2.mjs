import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '..')

export const CONTRACT_V2_SCHEMA_VERSION = 2
export const CONTRACT_V2_REGISTRY_VERSION = '2.0.0'
export const CONTRACT_V2_RELEASE_CLASSIFICATION = 'preview'
export const CONTRACT_V2_OWNER = 'FsusUI Core'

export const MEMBER_STATUSES = [
  'aligned-candidate',
  'partial',
  'missing',
  'web-only',
]
export const GOVERNANCE_FIELDS = [
  'reason',
  'owner',
  'testPolicy',
  'reviewPolicy',
]
export const MARKDOWN_EDITOR_MODES = ['source', 'live', 'split', 'preview']
export const MARKDOWN_EDITOR_CAPABILITIES = [
  'supported',
  'unsupported-platform',
  'runtime-unavailable',
  'projection-failed',
  'feature-degraded',
  'fatal',
]

const AVALONIA_MEMBER_BINDINGS = {
  ElTableV2: {
    inputs: {
      cache: { member: 'Overscan' },
      height: { member: 'ViewportHeight' },
      maxHeight: { member: 'ViewportMaxHeight' },
      width: { member: 'ViewportWidth' },
    },
  },
  ElCheckTag: {
    outputs: {
      change: { member: 'CheckedChanged', payloadMember: 'NewChecked' },
      'update:checked': {
        member: 'CheckedChanged',
        payloadMember: 'NewChecked',
      },
    },
  },
}

const AVALONIA_COMPONENT_BINDINGS = {
  ElVisuallyHidden: 'FsusUI.Avalonia.Controls.FsusVisualHidden',
}

const PUBLIC_VALUE_BINDINGS = {
  TableV2Alignment: {
    avaloniaType: 'FsusUI.Avalonia.Controls.FsusLayoutAlignment',
    valueMap: { CENTER: 'Center', RIGHT: 'End' },
    reason:
      'The existing layout enum is the native counterpart, but right/end directionality requires behavior evidence before alignment.',
  },
  TableV2FixedDir: {
    avaloniaType: 'FsusUI.Avalonia.Controls.FsusDataTableFixedColumn',
    valueMap: { LEFT: 'Left', RIGHT: 'Right' },
    reason:
      'The existing fixed-column enum carries the shared directions plus the Avalonia-only None state.',
  },
  TableV2SortOrder: {
    avaloniaType: 'FsusUI.Avalonia.Controls.FsusSortDirection',
    valueMap: { ASC: 'Ascending', DESC: 'Descending' },
    reason:
      'The existing sort enum carries the shared directions plus the Avalonia-only None state.',
  },
  TableV2Placeholder: {
    webOnly: true,
    reason:
      'The Symbol is a Vue renderer identity sentinel; Avalonia owns native placeholder row lifecycle and cannot expose the JavaScript identity value.',
    alternative:
      'Use the native placeholder row lifecycle instead of a JavaScript identity sentinel.',
    reviewedAt: '2026-08-30',
  },
}

export const VUE_BASELINE_PATH = 'spec/baselines/vue-current.json'
export const AVALONIA_SEMANTIC_PATHS = {
  avalonia: 'spec/avalonia/semantic/FsusUI.Avalonia.semantic.json',
  avaloniaThemes: 'spec/avalonia/semantic/FsusUI.Avalonia.Themes.semantic.json',
  avaloniaIcons: 'spec/avalonia/semantic/FsusUI.Avalonia.Icons.semantic.json',
}
export const MARKDOWN_EDITOR_GATE_PATH =
  'spec/components/contracts/v2/markdown-editor-gate.json'
export const CONTRACT_V2_REGISTRY_PATH =
  'spec/components/contracts/v2/contract-v2.json'
export const CONTRACT_V1_REGISTRY_PATH =
  'spec/components/contracts/v1/vue-public-contracts.json'

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}
const parseJson = (file) => JSON.parse(read(file))
const sha256 = (content) =>
  crypto.createHash('sha256').update(content).digest('hex')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const toKebab = (value) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

// Component-level name equality: strip the platform prefix and kebab-case.
// This is an explicit per-component basis and never derives a counterpart from
// the portable/native-adapter/platform-override classification.
export const kebabName = (value) =>
  toKebab(value.replace(/^El/, '').replace(/^Fsus/, ''))

// Member-level name normalization used only for candidate matching. It is
// narrow (single member), documented, and never hides a member gap: every
// member that does not resolve to a real counterpart is explicitly registered.
export const normalizeMemberName = (value) => {
  let normalized = value
    .replace(/^Is(?=[A-Z])/, '')
    .replace(/^Can(?=[A-Z])/, '')
    .replace(/^Has(?=[A-Z])/, '')
  normalized = normalized.replace(/Changed$/, '')
  return toKebab(normalized)
}

const CLR_TO_CATEGORY = {
  'System.String': 'string',
  'System.Boolean': 'boolean',
  'System.Double': 'number',
  'System.Single': 'number',
  'System.Decimal': 'number',
  'System.Int32': 'number',
  'System.Int64': 'number',
  'System.Int16': 'number',
  'System.UInt32': 'number',
  'System.UInt64': 'number',
  'System.Byte': 'number',
  'System.SByte': 'number',
  'System.Object': 'object',
  'System.DateTime': 'date',
  'System.DateTimeOffset': 'date',
  'System.Uri': 'string',
  'System.Guid': 'string',
  'FsusUI.Avalonia.Controls.FsusTableV2Sort': 'object',
}

export const categoriesFromClrType = (type) => {
  const trimmed = (type ?? '').replace(/\?$/, '').trim()
  if (!trimmed) return ['unknown']
  const base = trimmed.split('<')[0].trim()
  if (CLR_TO_CATEGORY[base]) return [CLR_TO_CATEGORY[base]]
  if (
    base.startsWith('System.Collections') ||
    base.startsWith('System.Linq') ||
    base.endsWith('[]')
  ) {
    return ['array']
  }
  if (
    base === 'System.Action' ||
    base === 'System.Func' ||
    base === 'System.EventHandler'
  ) {
    return ['function']
  }
  return [base.split('.').pop() || 'unknown']
}

const VUE_RUNTIME_TO_CATEGORY = {
  String: 'string',
  Boolean: 'boolean',
  Number: 'number',
  BigInt: 'number',
  Array: 'array',
  Function: 'function',
  Object: 'object',
  Date: 'date',
  Symbol: 'symbol',
}

const normalizeVueSemanticType = (value) =>
  (value ?? '')
    .trim()
    .replace(/^readonly\s+/, '')
    .replace(/^PropType<(.+)>$/, '$1')
    .replace(/^Array<(.+)>$/, '$1[]')
    .replace(/\s*\|\s*undefined$/, '')

export const categoriesFromVueProp = (prop) => {
  if (prop?.runtimeType && VUE_RUNTIME_TO_CATEGORY[prop.runtimeType]) {
    return [VUE_RUNTIME_TO_CATEGORY[prop.runtimeType]]
  }
  const semanticType = normalizeVueSemanticType(prop?.semanticType)
  if (semanticType) {
    return semanticType
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const normalized = normalizeVueSemanticType(part)
        if (normalized === 'string') return 'string'
        if (
          normalized === 'boolean' ||
          normalized === 'true' ||
          normalized === 'false'
        )
          return 'boolean'
        if (normalized === 'number') return 'number'
        if (normalized.endsWith('[]') || normalized.startsWith('SingleOrRange'))
          return 'array'
        if (normalized.includes('Component') || normalized.includes('VNode'))
          return 'component'
        return 'unknown'
      })
  }
  return ['unknown']
}

const categoriesOverlap = (first, second) => {
  const a = first.includes('unknown')
    ? first.filter((x) => x !== 'unknown')
    : first
  const b = second.includes('unknown')
    ? second.filter((x) => x !== 'unknown')
    : second
  if (a.length === 0 || b.length === 0) return null // not comparable
  return a.some((value) => b.includes(value))
}

const comparableValues = (values) => [
  ...new Set(
    (values ?? [])
      .filter((value) => value != null)
      .map((value) => String(value).toLowerCase()),
  ),
]

const enumMemberNames = (enumMembers) => [
  ...new Set(
    (enumMembers ?? []).map((member) => String(member.name).toLowerCase()),
  ),
]

const literalDefaultValue = (webDefault) =>
  webDefault?.kind === 'literal' ? webDefault.value : undefined

const normalizeDefault = (value) => {
  if (typeof value === 'string') return value.toLowerCase()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'object' && value !== null)
    return String(value.value ?? value)
  return value == null ? undefined : String(value)
}

const COMPARISON_KEY = [
  'type',
  'default',
  'nullability',
  'eventPayload',
  'operationSignature',
  'enumValues',
]

const emptyDrift = () =>
  Object.fromEntries(COMPARISON_KEY.map((key) => [key, null]))

const setDrift = (drift, key, detail) => {
  drift[key] = detail
  return drift
}

// Compare a single Vue member against a real Avalonia member and record every
// drift that would be required to fail. Returns null when no counterpart exists.
export const compareMembers = ({ web, avalonia, kind }) => {
  const drift = emptyDrift()

  const webCategories = web.categories ?? ['unknown']
  const avaloniaCategories = avalonia?.categories ?? ['unknown']
  const typeCompatibility = categoriesOverlap(webCategories, avaloniaCategories)
  if (typeCompatibility === false) {
    setDrift(
      drift,
      'type',
      `web ${webCategories.join('|')} vs avalonia ${avaloniaCategories.join('|')}`,
    )
  } else if (typeCompatibility === null && kind === 'input') {
    setDrift(drift, 'type', 'web type not comparable to avalonia type')
  }

  if (kind === 'input') {
    const webNullable = Boolean(web.nullable)
    const avaloniaNullable = avalonia?.nullable
    const optionalAbsenceMatchesNullable =
      web.required === false &&
      webNullable === false &&
      avaloniaNullable === true
    if (
      avaloniaNullable != null &&
      webNullable !== Boolean(avaloniaNullable) &&
      !optionalAbsenceMatchesNullable
    ) {
      setDrift(
        drift,
        'nullability',
        `web nullable=${webNullable} vs avalonia nullable=${Boolean(avaloniaNullable)}`,
      )
    }

    const webLiteral = literalDefaultValue(web.default)
    const avaloniaDefault = avalonia?.defaultValue
    if (webLiteral !== undefined && avaloniaDefault !== undefined) {
      if (normalizeDefault(webLiteral) !== normalizeDefault(avaloniaDefault)) {
        setDrift(
          drift,
          'default',
          `web default=${JSON.stringify(webLiteral)} vs avalonia default=${JSON.stringify(avaloniaDefault)}`,
        )
      }
    }

    const webValues = comparableValues(web.values)
    const avaloniaValues = enumMemberNames(avalonia?.enumMembers)
    if (webValues.length > 0 && avaloniaValues.length > 0) {
      const overlap = webValues.some((value) => avaloniaValues.includes(value))
      if (!overlap) {
        setDrift(
          drift,
          'enumValues',
          `web values [${webValues.join(', ')}] vs avalonia enum [${avaloniaValues.join(', ')}]`,
        )
      }
    }
  }

  if (kind === 'output') {
    const webPayload = web.payloadType
    const avaloniaPayload = avalonia?.payloadType ?? avalonia?.argsType
    if (webPayload && avaloniaPayload) {
      const payloadCompatible = categoriesOverlap(
        categoriesFromClrType(avaloniaPayload),
        categoriesFromVueProp({ semanticType: webPayload }),
      )
      if (payloadCompatible !== true) {
        setDrift(
          drift,
          'eventPayload',
          `web payload ${webPayload} vs avalonia payload ${avaloniaPayload}`,
        )
      }
    }
  }

  if (kind === 'operation') {
    const webSignature = web.signature
    const avaloniaSignature = avalonia?.signature
    if (webSignature && avaloniaSignature) {
      const signatureCompatible = categoriesOverlap(
        categoriesFromClrType(avaloniaSignature.returnType),
        categoriesFromVueProp({
          runtimeType: webSignature.returnType,
          semanticType: webSignature.returnType,
        }),
      )
      if (signatureCompatible === false) {
        setDrift(
          drift,
          'operationSignature',
          `web return ${webSignature.returnType} vs avalonia return ${avaloniaSignature.returnType}`,
        )
      }
    }
  }

  const drifts = Object.entries(drift).filter(([, value]) => value != null)
  if (drifts.length === 0) return { compatible: true, drift }
  return { compatible: false, drift }
}

const defaultGovernance = (reason) => ({
  reason,
  owner: CONTRACT_V2_OWNER,
  testPolicy: 'contract',
  reviewPolicy: 'pr-review',
})

const scenarioId = (contractKebab, kind, member) =>
  `scenario.v2.${contractKebab}.${kind}.${toKebab(member)}`

const memberRef = (kind) => ({
  baseline: VUE_BASELINE_PATH,
  kind,
})

const webPropRef = (prop) => ({
  member: prop.name,
  categories: categoriesFromVueProp(prop),
  runtimeType: prop.runtimeType ?? null,
  semanticType: prop.semanticType ?? null,
  nullable: Boolean(prop.nullable),
  default: prop.default ?? { kind: 'missing' },
  values: prop.values ?? null,
  required: Boolean(prop.required),
  readonly: Boolean(prop.readonly),
})

const avaloniaPropRef = (property) => ({
  member: property.name,
  categories: categoriesFromClrType(property.type),
  type: property.type,
  nullable: Boolean(property.nullable),
  defaultValue: property.defaultValue ?? undefined,
  enumMembers: property.enumMembers ?? undefined,
})

const avaloniaEventRef = (event, binding = null) => {
  const payload = binding?.payloadMember
    ? event.payloadMembers?.find(
        (member) => member.name === binding.payloadMember,
      )
    : null
  return {
    member: event.name,
    categories: categoriesFromClrType(payload?.type ?? event.argsType),
    argsType: event.argsType,
    payloadMember: payload?.name ?? null,
    payloadType: payload?.type ?? null,
  }
}

const webEventRef = (emit) => ({
  member: emit.name,
  baseline: VUE_BASELINE_PATH,
  payload: emit.payload ?? [],
  payloadType:
    emit.payload?.length === 1 ? (emit.payload[0].type ?? null) : null,
})

const avaloniaMethodRef = (method) => ({
  member: method.name,
  signature: {
    returnType: method.returnType,
    parameters: (method.parameters ?? []).map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      optional: Boolean(parameter.optional),
    })),
  },
})

const avaloniaSemanticIndex = (baselines) => {
  const index = new Map()
  for (const [packageId] of Object.entries(AVALONIA_SEMANTIC_PATHS)) {
    for (const type of baselines[packageId]?.semanticTypes ?? []) {
      index.set(type.name, { ...type, packageId })
    }
  }
  for (const type of index.values()) {
    for (const event of type.events ?? []) {
      const argsType = event.argsType?.match(
        /^System\.EventHandler<(.+)>$/u,
      )?.[1]
      const payloadType = argsType ? index.get(argsType) : null
      event.payloadMembers = payloadType?.properties ?? []
    }
  }
  return index
}

const findAvaloniaType = (componentName, typeIndex) => {
  const explicitType = AVALONIA_COMPONENT_BINDINGS[componentName]
  if (explicitType) return typeIndex.get(explicitType) ?? null
  const kebab = kebabName(componentName)
  for (const [fullName, type] of typeIndex) {
    const shortName = fullName.split('.').pop() ?? ''
    if (kebabName(shortName) === kebab && type.kind === 'class') {
      return type
    }
  }
  return null
}

const matchAvaloniaProperty = (webName, avaloniaType, componentName) => {
  const binding = memberBinding(componentName, 'inputs', webName)
  const normalized = normalizeMemberName(binding?.member ?? webName)
  const properties = [
    ...(avaloniaType.avaloniaProperties ?? []),
    ...(avaloniaType.properties ?? []),
  ]
  const seen = new Set()
  for (const property of properties) {
    if (seen.has(property.name)) continue
    seen.add(property.name)
    if (normalizeMemberName(property.name) === normalized) return property
  }
  return null
}

const memberBinding = (componentName, kind, webName) =>
  AVALONIA_MEMBER_BINDINGS[componentName]?.[kind]?.[webName] ?? null

const matchAvaloniaEvent = (webName, avaloniaType, componentName) => {
  const binding = memberBinding(componentName, 'outputs', webName)
  const normalized = normalizeMemberName(binding?.member ?? webName)
  for (const event of avaloniaType.events ?? []) {
    if (normalizeMemberName(event.name) === normalized)
      return { event, binding }
  }
  return null
}

const matchAvaloniaMethod = (webName, avaloniaType) => {
  const normalized = normalizeMemberName(webName)
  for (const method of avaloniaType.methods ?? []) {
    if (normalizeMemberName(method.name) === normalized) return method
  }
  return null
}

const matchAvaloniaContentProperty = (webName, avaloniaType) => {
  const candidates = new Set([toKebab(webName), toKebab(`${webName}Content`)])
  const properties = [
    ...(avaloniaType.avaloniaProperties ?? []),
    ...(avaloniaType.properties ?? []),
  ]
  return (
    properties.find((property) => candidates.has(toKebab(property.name))) ??
    null
  )
}

const inputMember = ({
  componentName,
  contractKebab,
  prop,
  avaloniaType,
  classification,
}) => {
  if (!avaloniaType) {
    return {
      name: prop.name,
      kind: 'input',
      web: webPropRef(prop),
      avalonia: null,
      status: classification === 'web-only' ? 'web-only' : 'missing',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'input', prop.name)],
      governance:
        classification === 'web-only'
          ? defaultGovernance(
              'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
            )
          : defaultGovernance(
              'No matching real Avalonia public member in the semantic baseline.',
            ),
    }
  }
  const avalonia = matchAvaloniaProperty(prop.name, avaloniaType, componentName)
  let status
  let governance = null
  let drift = emptyDrift()
  if (classification === 'web-only') {
    status = 'web-only'
    governance = defaultGovernance(
      'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
    )
  } else if (!avalonia) {
    status = 'missing'
    governance = defaultGovernance(
      'No matching real Avalonia public member in the semantic baseline.',
    )
  } else {
    const comparison = compareMembers({
      web: webPropRef(prop),
      avalonia: avaloniaPropRef(avalonia),
      kind: 'input',
    })
    drift = comparison.drift
    status = comparison.compatible ? 'aligned-candidate' : 'partial'
    if (status === 'partial') {
      governance = defaultGovernance(
        'Real member exists on both sides but semantic drift was detected.',
      )
    }
  }
  return {
    name: prop.name,
    kind: 'input',
    web: webPropRef(prop),
    avalonia: avalonia ? avaloniaPropRef(avalonia) : null,
    status,
    drift,
    scenarioIds: [scenarioId(contractKebab, 'input', prop.name)],
    governance,
  }
}

const outputMember = ({
  componentName,
  contractKebab,
  emit,
  avaloniaType,
  classification,
}) => {
  const web = webEventRef(emit)
  if (!avaloniaType) {
    return {
      name: emit.name,
      kind: 'output',
      web,
      avalonia: null,
      status: classification === 'web-only' ? 'web-only' : 'missing',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'output', emit.name)],
      governance:
        classification === 'web-only'
          ? defaultGovernance(
              'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
            )
          : defaultGovernance(
              'No matching real Avalonia public event in the semantic baseline.',
            ),
    }
  }
  const avaloniaMatch = matchAvaloniaEvent(
    emit.name,
    avaloniaType,
    componentName,
  )
  const avalonia = avaloniaMatch?.event ?? null
  const avaloniaRef = avalonia
    ? avaloniaEventRef(avalonia, avaloniaMatch.binding)
    : null
  let status
  let governance = null
  let drift = emptyDrift()
  if (classification === 'web-only') {
    status = 'web-only'
    governance = defaultGovernance(
      'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
    )
  } else if (!avalonia) {
    status = 'missing'
    governance = defaultGovernance(
      'No matching real Avalonia public event in the semantic baseline.',
    )
  } else {
    const comparison = compareMembers({
      web: { ...web, categories: ['unknown'] },
      avalonia: avaloniaRef,
      kind: 'output',
    })
    drift = comparison.drift
    status = comparison.compatible ? 'aligned-candidate' : 'partial'
    if (status === 'partial') {
      governance = defaultGovernance(
        'Real event exists on both sides but payload semantics are not comparable or drift was detected.',
      )
    }
  }
  return {
    name: emit.name,
    kind: 'output',
    web,
    avalonia: avaloniaRef,
    status,
    drift,
    scenarioIds: [scenarioId(contractKebab, 'output', emit.name)],
    governance,
  }
}

const operationMember = ({
  contractKebab,
  exposed,
  avaloniaType,
  classification,
}) => {
  const web = {
    member: exposed.name,
    baseline: VUE_BASELINE_PATH,
    signature: {
      returnType: exposed.returnType ?? null,
      parameters: exposed.parameters ?? [],
    },
  }
  if (!avaloniaType) {
    return {
      name: exposed.name,
      kind: 'operation',
      web,
      avalonia: null,
      status: classification === 'web-only' ? 'web-only' : 'missing',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'operation', exposed.name)],
      governance:
        classification === 'web-only'
          ? defaultGovernance(
              'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
            )
          : defaultGovernance(
              'No matching real Avalonia public method in the semantic baseline.',
            ),
    }
  }
  const avalonia = matchAvaloniaMethod(exposed.name, avaloniaType)
  let status
  let governance = null
  let drift = emptyDrift()
  if (classification === 'web-only') {
    status = 'web-only'
    governance = defaultGovernance(
      'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
    )
  } else if (!avalonia) {
    status = 'missing'
    governance = defaultGovernance(
      'No matching real Avalonia public method in the semantic baseline.',
    )
  } else {
    const comparison = compareMembers({
      web: { categories: ['unknown'], signature: web.signature },
      avalonia: avaloniaMethodRef(avalonia),
      kind: 'operation',
    })
    drift = comparison.drift
    status = comparison.compatible ? 'aligned-candidate' : 'partial'
    if (status === 'partial') {
      governance = defaultGovernance(
        'Real operation exists on both sides but the signature is not comparable or drift was detected.',
      )
    }
  }
  return {
    name: exposed.name,
    kind: 'operation',
    web,
    avalonia: avalonia ? avaloniaMethodRef(avalonia) : null,
    status,
    drift,
    scenarioIds: [scenarioId(contractKebab, 'operation', exposed.name)],
    governance,
  }
}

const contentRegionMember = ({
  contractKebab,
  slot,
  avaloniaType,
  classification,
}) => {
  if (!avaloniaType) {
    return {
      name: slot.name,
      kind: 'contentRegion',
      scoped: Boolean(slot.scoped),
      web: {
        member: slot.name,
        scoped: Boolean(slot.scoped),
        baseline: VUE_BASELINE_PATH,
      },
      avalonia: null,
      status: classification === 'web-only' ? 'web-only' : 'missing',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'content-region', slot.name)],
      governance:
        classification === 'web-only'
          ? defaultGovernance(
              'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
            )
          : defaultGovernance(
              'No matching real Avalonia content region in the semantic baseline.',
            ),
    }
  }
  const namedContentProperty =
    slot.name === 'default'
      ? null
      : matchAvaloniaContentProperty(slot.name, avaloniaType)
  const avalonia =
    slot.name === 'default' && avaloniaType?.contentProperty
      ? { member: avaloniaType.contentProperty, content: true }
      : namedContentProperty
        ? { member: namedContentProperty.name, content: true }
        : null
  let status
  let governance = null
  if (classification === 'web-only') {
    status = 'web-only'
    governance = defaultGovernance(
      'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
    )
  } else if (!avalonia) {
    status = 'missing'
    governance = defaultGovernance(
      'No matching real Avalonia content region in the semantic baseline.',
    )
  } else {
    status = 'aligned-candidate'
  }
  return {
    name: slot.name,
    kind: 'contentRegion',
    scoped: Boolean(slot.scoped),
    web: {
      member: slot.name,
      scoped: Boolean(slot.scoped),
      baseline: VUE_BASELINE_PATH,
    },
    avalonia,
    status,
    drift: emptyDrift(),
    scenarioIds: [scenarioId(contractKebab, 'content-region', slot.name)],
    governance,
  }
}

const deriveStates = ({ component, inputs, outputs }) => {
  const inputNames = new Set(inputs.map((input) => input.name))
  const outputNames = new Set(outputs.map((output) => output.name))
  const states = [{ name: 'default', kind: 'initial' }]
  if (inputNames.has('disabled'))
    states.push({ name: 'disabled', kind: 'derived' })
  if (inputNames.has('loading'))
    states.push({ name: 'loading', kind: 'derived' })
  if (inputNames.has('readonly'))
    states.push({ name: 'readonly', kind: 'derived' })
  if (outputNames.has('open') || outputNames.has('visible')) {
    states.push({ name: 'open', kind: 'derived' })
    states.push({ name: 'closed', kind: 'derived' })
  }
  if (component.name === 'ElMarkdownEditor') {
    for (const mode of MARKDOWN_EDITOR_MODES) {
      states.push({ name: mode, kind: 'derived-mode' })
    }
  }
  const transitions = []
  if (states.some((state) => state.name === 'disabled')) {
    transitions.push({
      from: 'default',
      to: 'disabled',
      trigger: 'disabled input becomes true',
    })
  }
  if (states.some((state) => state.name === 'loading')) {
    transitions.push({
      from: 'default',
      to: 'loading',
      trigger: 'loading input becomes true',
    })
  }
  if (states.some((state) => state.name === 'open')) {
    transitions.push({
      from: 'closed',
      to: 'open',
      trigger: 'open/visible output is raised',
    })
    transitions.push({
      from: 'open',
      to: 'closed',
      trigger: 'close/hide output is raised',
    })
  }
  return { machine: `fsus-${kebabName(component.name)}`, states, transitions }
}

const deriveRequirements = ({
  inputs,
  outputs,
  operations,
  contentRegions,
}) => {
  const inputNames = new Set(inputs.map((input) => input.name))
  const hasInteractiveSurface =
    outputs.length > 0 || inputNames.has('disabled') || operations.length > 0
  const keyboard = []
  if (operations.length > 0) {
    keyboard.push(
      'All public operations must be keyboard reachable and activatable.',
    )
  } else if (hasInteractiveSurface) {
    keyboard.push(
      'Interactive activation must be keyboard reachable and activatable.',
    )
  }
  const pointer = []
  if (outputs.length > 0) {
    pointer.push(
      'Pointer/tap activation must raise the corresponding public output.',
    )
  }
  if (inputNames.has('disabled')) {
    pointer.push('Disabled surfaces must not respond to pointer activation.')
  }
  const focus = []
  if (hasInteractiveSurface || inputNames.has('autofocus')) {
    focus.push(
      'Focus entry must surface the same public focus state on both platforms.',
    )
  }
  if (inputNames.has('autofocus')) {
    focus.push(
      'autofocus input must map to initial focus on Web and equivalent Avalonia focus behavior.',
    )
  }
  const a11y = []
  if (hasInteractiveSurface) {
    a11y.push('Interactive surfaces must expose an accessible name and role.')
  }
  if (contentRegions.length > 0) {
    a11y.push(
      'Content regions must preserve accessible text content semantics.',
    )
  }
  const motion = ['Honor user reduced-motion preference.']
  if (inputNames.has('loading')) {
    motion.push(
      'Loading transitions must not trap focus and must remain within the motion budget.',
    )
  }
  const perf = [
    'Render and interaction budgets must match the component performance contract.',
  ]
  const requirements = { keyboard, pointer, focus, a11y, motion, perf }
  const requirementApplicability = Object.fromEntries(
    Object.entries(requirements).map(([kind, entries]) => [
      kind,
      entries.length > 0
        ? { status: 'required' }
        : {
            status: 'not-applicable',
            governance: defaultGovernance(
              kind === 'keyboard' || kind === 'focus'
                ? 'The shared contract exposes no public operation, activation output, disabled interaction, or autofocus input requiring direct keyboard activation or focus entry.'
                : `The shared contract exposes no ${kind} behavior requiring cross-platform execution.`,
            ),
          },
    ]),
  )
  return { requirements, requirementApplicability }
}

const markdownEditorSection = () => ({
  modes: [...MARKDOWN_EDITOR_MODES],
  capabilities: [...MARKDOWN_EDITOR_CAPABILITIES],
  writeAlias: false,
  canonical: true,
})

const contractCoverage = (members) => {
  const counts = Object.fromEntries(
    MEMBER_STATUSES.map((status) => [status, 0]),
  )
  for (const member of members) counts[member.status] += 1
  const total = members.length
  const mapped = counts['aligned-candidate'] + counts['partial']
  return {
    total,
    alignedCandidate: counts['aligned-candidate'],
    partial: counts['partial'],
    missing: counts['missing'],
    webOnly: counts['web-only'],
    mappedPercent: total === 0 ? 0 : Math.round((mapped / total) * 1000) / 10,
  }
}

const contractForComponent = ({
  component,
  avaloniaType,
  gate,
  performanceBudget,
}) => {
  // Keep the full export name in the stable id so distinct public exports such
  // as ElCollectionSummary and FsusCollectionSummary never collide.
  const contractKebab = toKebab(component.name)
  const classification = component.classification ?? 'portable'
  const inputs = (component.semantic?.props ?? []).map((prop) =>
    inputMember({
      componentName: component.name,
      contractKebab,
      prop,
      avaloniaType,
      classification,
    }),
  )
  const semanticEmits =
    component.semantic?.emits ??
    (component.emits ?? []).map((name) => ({ name, payload: [] }))
  const semanticExposed =
    component.semantic?.exposed ??
    (component.exposed ?? []).map((name) => ({
      name,
      parameters: [],
      returnType: null,
    }))
  const outputs = semanticEmits.map((emit) =>
    outputMember({
      componentName: component.name,
      contractKebab,
      emit,
      avaloniaType,
      classification,
    }),
  )
  const operations = semanticExposed.map((exposed) =>
    operationMember({ contractKebab, exposed, avaloniaType, classification }),
  )
  const contentRegions = (component.slots ?? []).map((slot) =>
    contentRegionMember({ contractKebab, slot, avaloniaType, classification }),
  )

  const isMarkdownEditor = component.name === 'ElMarkdownEditor'
  const gateBlocked = isMarkdownEditor && Boolean(gate?.blocked)
  let exportStatus
  if (gateBlocked) {
    exportStatus = gate?.requiredStatus ?? 'partial'
  } else if (classification === 'web-only') {
    exportStatus = 'web-only'
  } else if (
    inputs.some((input) => input.status === 'partial') ||
    outputs.some((output) => output.status === 'partial') ||
    operations.some((operation) => operation.status === 'partial')
  ) {
    exportStatus = 'partial'
  } else if (
    inputs.some((input) => input.status === 'missing') ||
    outputs.some((output) => output.status === 'missing') ||
    operations.some((operation) => operation.status === 'missing') ||
    contentRegions.some((region) => region.status === 'missing')
  ) {
    exportStatus = 'missing'
  } else {
    exportStatus = 'aligned-candidate'
  }

  const members = [...inputs, ...outputs, ...operations, ...contentRegions]
  const avaloniaExtras = avaloniaType
    ? extractAvaloniaExtras({
        contractKebab,
        component,
        avaloniaType,
        inputs,
        outputs,
        operations,
        contentRegions,
      })
    : []
  const states = deriveStates({ component, inputs, outputs })
  const { requirements, requirementApplicability } = deriveRequirements({
    component,
    inputs,
    outputs,
    operations,
    contentRegions,
  })

  const contract = {
    id: `component-v2.${contractKebab}`,
    version: '2.0.0',
    releaseClassification: CONTRACT_V2_RELEASE_CLASSIFICATION,
    owner: CONTRACT_V2_OWNER,
    component: {
      name: component.name,
      module: component.module,
      classification,
      exportStatus,
      exports: [component.name, ...(component.exportIdentity?.aliases ?? [])],
    },
    bindings: {
      web: {
        status: 'source',
        package: '@ozwasyd/element-plus',
        memberRef: memberRef('component'),
        exports: [component.name, ...(component.exportIdentity?.aliases ?? [])],
      },
      avalonia: avaloniaType
        ? {
            status: 'bound',
            package: 'FsusUI.Avalonia',
            type: avaloniaType.name,
          }
        : { status: 'unbound', package: null, type: null },
    },
    inputs,
    outputs,
    operations,
    contentRegions,
    states,
    requirements,
    requirementApplicability,
    performanceBudget,
    platformDifferences: members
      .filter(
        (member) =>
          member.status !== 'aligned-candidate' && member.status !== 'web-only',
      )
      .map((member) => ({
        member: member.name,
        kind: member.kind,
        status: member.status,
        governance: member.governance,
      })),
    avaloniaExtras,
    scenarioIds: [
      ...members.flatMap((member) => member.scenarioIds),
      ...states.states.map(
        (state) => `scenario.v2.${contractKebab}.state.${toKebab(state.name)}`,
      ),
      ...requirements.keyboard.map(
        () => `scenario.v2.${contractKebab}.keyboard`,
      ),
      ...requirements.pointer.map(() => `scenario.v2.${contractKebab}.pointer`),
      ...requirements.focus.map(() => `scenario.v2.${contractKebab}.focus`),
      ...requirements.a11y.map(() => `scenario.v2.${contractKebab}.a11y`),
      ...requirements.motion.map(() => `scenario.v2.${contractKebab}.motion`),
      ...requirements.perf.map(() => `scenario.v2.${contractKebab}.perf`),
    ],
    coverage: contractCoverage(members),
  }
  if (isMarkdownEditor) {
    contract.markdownEditor = markdownEditorSection()
    contract.markdownEditorGate = {
      blocked: Boolean(gate?.blocked),
      blockedBy: gate?.blockedBy ?? [],
      requiredStatus: gate?.requiredStatus ?? 'partial',
    }
  }
  return contract
}

const extractAvaloniaExtras = ({
  contractKebab,
  avaloniaType,
  inputs,
  outputs,
  operations,
  contentRegions,
}) => {
  const matchedAvaloniaNames = new Set([
    ...inputs.map((input) => input.avalonia?.member),
    ...outputs.map((output) => output.avalonia?.member),
    ...operations.map((operation) => operation.avalonia?.member),
    ...contentRegions.map((region) => region.avalonia?.member),
  ])
  const extras = []
  const addExtra = (member) => {
    const normalized = normalizeMemberName(member.name)
    const matched = [...matchedAvaloniaNames].some(
      (avaloniaName) =>
        avaloniaName && normalizeMemberName(avaloniaName) === normalized,
    )
    if (matched) return
    extras.push({
      member: member.name,
      kind: 'avalonia-extra',
      governance: defaultGovernance(
        'Avalonia-only public member explicitly registered; no Vue counterpart exists in the baseline.',
      ),
      scenarioIds: [
        `scenario.v2.${contractKebab}.avalonia-extra.${toKebab(member.name)}`,
      ],
    })
  }
  for (const property of avaloniaType.properties ?? []) addExtra(property)
  for (const event of avaloniaType.events ?? []) addExtra(event)
  for (const method of avaloniaType.methods ?? []) addExtra(method)
  return extras.sort((first, second) =>
    first.member.localeCompare(second.member),
  )
}

const avaloniaOnlyType = ({ type, packageId }) => ({
  type: type.name,
  kind: type.kind,
  packageId,
  baseline: AVALONIA_SEMANTIC_PATHS[packageId],
  memberCount:
    (type.properties?.length ?? 0) +
    (type.avaloniaProperties?.length ?? 0) +
    (type.events?.length ?? 0) +
    (type.methods?.length ?? 0) +
    (type.enumMembers?.length ?? 0),
  scenarioIds: [
    `scenario.v2.avalonia-only.${toKebab(type.name.split('.').pop() ?? type.name)}`,
  ],
  governance: defaultGovernance(
    'Avalonia-only public type explicitly registered; no Vue component counterpart exists in the baseline.',
  ),
})

const buildPublicValueBindings = ({ vueBaseline, typeIndex }) =>
  (vueBaseline.publicValues ?? [])
    .map((value) => {
      const binding = PUBLIC_VALUE_BINDINGS[value.name]
      const scenarioIds = [`scenario.v2.public-value.${toKebab(value.name)}`]
      if (!binding) {
        return {
          id: `public-value.${toKebab(value.name)}`,
          name: value.name,
          module: value.module,
          kind: value.kind,
          web: value,
          avalonia: null,
          status: 'missing',
          valueMap: null,
          scenarioIds,
          governance: defaultGovernance(
            'No explicit public value counterpart binding exists.',
          ),
        }
      }
      if (binding.webOnly) {
        return {
          id: `public-value.${toKebab(value.name)}`,
          name: value.name,
          module: value.module,
          kind: value.kind,
          web: value,
          avalonia: null,
          status: 'web-only',
          valueMap: null,
          scenarioIds,
          governance: {
            ...defaultGovernance(binding.reason),
            alternative: binding.alternative,
            reviewedAt: binding.reviewedAt,
          },
        }
      }
      const avaloniaType = typeIndex.get(binding.avaloniaType) ?? null
      return {
        id: `public-value.${toKebab(value.name)}`,
        name: value.name,
        module: value.module,
        kind: value.kind,
        web: value,
        avalonia: avaloniaType
          ? {
              type: avaloniaType.name,
              packageId: avaloniaType.packageId,
              kind: avaloniaType.kind,
              values: avaloniaType.enumMembers ?? [],
            }
          : null,
        status: avaloniaType ? 'partial' : 'missing',
        valueMap: binding.valueMap ?? null,
        scenarioIds,
        governance: defaultGovernance(
          avaloniaType
            ? binding.reason
            : `Configured Avalonia public value type ${binding.avaloniaType} is missing from the semantic baseline.`,
        ),
      }
    })
    .sort((first, second) => first.name.localeCompare(second.name))

export const buildComponentMap = ({ vueBaseline, typeIndex }) => {
  const map = []
  for (const component of vueBaseline.components ?? []) {
    if (component.exportIdentity?.role === 'alias') continue
    const avaloniaType = findAvaloniaType(component.name, typeIndex)
    if (!avaloniaType) continue
    map.push({
      vue: {
        name: component.name,
        module: component.module,
        aliases: component.exportIdentity?.aliases ?? [],
      },
      avalonia: { type: avaloniaType.name, packageId: avaloniaType.packageId },
      basis: AVALONIA_COMPONENT_BINDINGS[component.name]
        ? 'explicit-component-binding'
        : 'canonical-export-name-equality',
    })
  }
  return map.sort((first, second) =>
    first.vue.name.localeCompare(second.vue.name),
  )
}

export const buildRegistry = ({
  vueBaseline,
  v1Registry,
  avaloniaBaseline,
  avaloniaThemesBaseline,
  avaloniaIconsBaseline,
  gate,
}) => {
  const baselines = {
    avalonia: avaloniaBaseline,
    avaloniaThemes: avaloniaThemesBaseline,
    avaloniaIcons: avaloniaIconsBaseline,
  }
  const typeIndex = avaloniaSemanticIndex(baselines)
  const performanceBudgetByComponent = new Map(
    [...(v1Registry.contracts ?? []), ...(v1Registry.webOnlyDecisions ?? [])]
      .filter((contract) => contract.source?.kind === 'component')
      .map((contract) => [contract.source?.name, contract.performanceBudget]),
  )
  const componentMap = buildComponentMap({ vueBaseline, typeIndex })
  const mappedTypes = new Set(componentMap.map((entry) => entry.avalonia.type))
  const publicValueBindings = buildPublicValueBindings({
    vueBaseline,
    typeIndex,
  })
  for (const binding of publicValueBindings) {
    if (binding.avalonia?.type) mappedTypes.add(binding.avalonia.type)
  }
  const contracts = []
  for (const component of vueBaseline.components ?? []) {
    if (component.exportIdentity?.role === 'alias') continue
    const avaloniaType = findAvaloniaType(component.name, typeIndex)
    contracts.push(
      contractForComponent({
        component,
        avaloniaType,
        gate,
        performanceBudget: performanceBudgetByComponent.get(component.name),
      }),
    )
  }
  contracts.sort((first, second) => first.id.localeCompare(second.id))

  const publicExportMap = (vueBaseline.components ?? [])
    .map((component) => {
      const canonical = component.exportIdentity?.canonical ?? component.name
      return {
        name: component.name,
        module: component.module,
        role: component.exportIdentity?.role ?? 'canonical',
        canonical,
        contractId: `component-v2.${toKebab(canonical)}`,
      }
    })
    .sort((first, second) => first.name.localeCompare(second.name))

  const avaloniaOnlyTypes = []
  for (const type of typeIndex.values()) {
    if (mappedTypes.has(type.name)) continue
    avaloniaOnlyTypes.push(
      avaloniaOnlyType({ type, packageId: type.packageId }),
    )
  }
  avaloniaOnlyTypes.sort((first, second) =>
    first.type.localeCompare(second.type),
  )

  const allMembers = contracts.flatMap((contract) => [
    ...contract.inputs,
    ...contract.outputs,
    ...contract.operations,
    ...contract.contentRegions,
  ])
  const coverage = Object.fromEntries(
    MEMBER_STATUSES.map((status) => [status, 0]),
  )
  for (const member of allMembers) coverage[member.status] += 1
  coverage.total = allMembers.length
  coverage.mappedPercent =
    coverage.total === 0
      ? 0
      : Math.round(
          ((coverage['aligned-candidate'] + coverage['partial']) /
            coverage.total) *
            1000,
        ) / 10

  return {
    schemaVersion: CONTRACT_V2_SCHEMA_VERSION,
    registryVersion: CONTRACT_V2_REGISTRY_VERSION,
    releaseClassification: CONTRACT_V2_RELEASE_CLASSIFICATION,
    owner: CONTRACT_V2_OWNER,
    generatedBy: {
      tool: 'scripts/contract-v2.mjs',
      toolVersion: '1.0.0',
    },
    baselines: {
      web: {
        path: VUE_BASELINE_PATH,
        hash: sha256(read(path.join(root, VUE_BASELINE_PATH))),
        packageVersion: vueBaseline.source?.packageVersion ?? 'unknown',
      },
      avalonia: {
        path: AVALONIA_SEMANTIC_PATHS.avalonia,
        hash: sha256(read(path.join(root, AVALONIA_SEMANTIC_PATHS.avalonia))),
        packageId: avaloniaBaseline.packageId ?? 'FsusUI.Avalonia',
      },
      avaloniaThemes: {
        path: AVALONIA_SEMANTIC_PATHS.avaloniaThemes,
        hash: sha256(
          read(path.join(root, AVALONIA_SEMANTIC_PATHS.avaloniaThemes)),
        ),
        packageId: avaloniaThemesBaseline.packageId ?? 'FsusUI.Avalonia.Themes',
      },
      avaloniaIcons: {
        path: AVALONIA_SEMANTIC_PATHS.avaloniaIcons,
        hash: sha256(
          read(path.join(root, AVALONIA_SEMANTIC_PATHS.avaloniaIcons)),
        ),
        packageId: avaloniaIconsBaseline.packageId ?? 'FsusUI.Avalonia.Icons',
      },
      markdownEditorGate: {
        path: MARKDOWN_EDITOR_GATE_PATH,
        hash: sha256(read(path.join(root, MARKDOWN_EDITOR_GATE_PATH))),
      },
      v1ContractRegistry: {
        path: CONTRACT_V1_REGISTRY_PATH,
        hash: sha256(read(path.join(root, CONTRACT_V1_REGISTRY_PATH))),
      },
    },
    rules: {
      componentMappingBasis:
        'explicit kebab name equality between the Vue export and the Avalonia public type',
      classificationBasis:
        'portable/native-adapter/platform-override classifications never claim a counterpart',
      memberNameNormalization: [
        'case-insensitive',
        'strip Is/Can/Has prefix',
        'strip Changed suffix',
        'kebab-case',
      ],
      statusDerivation: {
        alignedCandidate:
          'real member matched with no type/default/nullability/enum/payload drift',
        partial:
          'real member matched but semantic drift or non-comparable typing',
        missing: 'no real counterpart member on the other platform',
        webOnly: 'explicit web-only registration with governance',
      },
      aligned:
        'final aligned status is never hand-written; only aligned-candidate is derived',
    },
    componentMap,
    publicExportMap,
    publicValueBindings,
    contracts,
    avaloniaOnlyTypes,
    coverage,
  }
}

const validateGovernance = (governance, context, errors) => {
  if (governance == null) {
    errors.push(`${context} missing governance`)
    return
  }
  for (const field of GOVERNANCE_FIELDS) {
    if (
      typeof governance[field] !== 'string' ||
      governance[field].trim() === ''
    ) {
      errors.push(`${context} governance missing ${field}`)
    }
  }
}

const validateMember = (member, contractId, errors) => {
  const context = `${contractId} ${member.kind ?? 'member'} ${member.name ?? '<unknown>'}`
  if (!MEMBER_STATUSES.includes(member.status)) {
    errors.push(`${context} has invalid status ${member.status}`)
  }
  if (!Array.isArray(member.scenarioIds) || member.scenarioIds.length === 0) {
    errors.push(`${context} is required semantic without scenario coverage id`)
  }
  if (member.status !== 'aligned-candidate') {
    validateGovernance(member.governance, context, errors)
  }
  if (member.status === 'aligned-candidate' && member.governance != null) {
    errors.push(
      `${context} aligned-candidate must not carry an override governance`,
    )
  }
  if (member.status === 'aligned-candidate') {
    for (const key of COMPARISON_KEY) {
      if (member.drift?.[key] != null) {
        errors.push(
          `${context} claims aligned-candidate with ${key} drift: ${member.drift[key]}`,
        )
      }
    }
  }
  if (member.status === 'aligned-candidate' && member.avalonia == null) {
    errors.push(
      `${context} claims aligned-candidate without a real Avalonia member (auto counterpart)`,
    )
  }
}

const validateMarkdownEditor = (contract, gate, errors) => {
  if (contract.component?.name !== 'ElMarkdownEditor') return
  const editor = contract.markdownEditor
  if (!editor) {
    errors.push(`${contract.id} missing markdownEditor canonical section`)
    return
  }
  if (editor.writeAlias !== false) {
    errors.push(`${contract.id} MarkdownEditor must not carry a write alias`)
  }
  if (
    JSON.stringify(editor.modes ?? []) !== JSON.stringify(MARKDOWN_EDITOR_MODES)
  ) {
    errors.push(
      `${contract.id} MarkdownEditor modes must be source/live/split/preview`,
    )
  }
  if (
    JSON.stringify(editor.capabilities ?? []) !==
    JSON.stringify(MARKDOWN_EDITOR_CAPABILITIES)
  ) {
    errors.push(
      `${contract.id} MarkdownEditor capability set must be the six canonical values`,
    )
  }
  const serialized = JSON.stringify(editor)
  if (serialized.includes('"write"')) {
    errors.push(
      `${contract.id} MarkdownEditor must not reference write anywhere`,
    )
  }
  if (gate?.blocked) {
    const required = gate.requiredStatus ?? 'partial'
    if (contract.component.exportStatus !== required) {
      errors.push(
        `${contract.id} must stay ${required} while #${(gate.blockedBy ?? []).join(', #')} are open`,
      )
    }
    if (contract.markdownEditorGate?.blocked !== true) {
      errors.push(`${contract.id} markdownEditorGate must record blocked=true`)
    }
  }
}

export const validateContract = (contract, gate, errors) => {
  const contractErrors = errors ?? []
  if (!/^component-v2\.[a-z0-9][a-z0-9.-]+$/.test(contract.id ?? '')) {
    contractErrors.push(`${contract.id ?? '<unknown>'} has invalid stable id`)
  }
  if (!/^\d+\.\d+\.\d+$/.test(contract.version ?? '')) {
    contractErrors.push(`${contract.id ?? '<unknown>'} has invalid version`)
  }
  for (const section of [
    'inputs',
    'outputs',
    'operations',
    'contentRegions',
    'platformDifferences',
    'avaloniaExtras',
    'scenarioIds',
  ]) {
    if (!Array.isArray(contract[section])) {
      contractErrors.push(`${contract.id} ${section} must be an array`)
    }
  }
  for (const section of [
    'states',
    'requirements',
    'requirementApplicability',
    'bindings',
  ]) {
    if (typeof contract[section] !== 'object' || contract[section] == null) {
      contractErrors.push(`${contract.id} ${section} must be an object`)
    }
  }
  for (const kind of [
    'keyboard',
    'pointer',
    'focus',
    'a11y',
    'motion',
    'perf',
  ]) {
    const requirements = contract.requirements?.[kind]
    if (!Array.isArray(requirements)) {
      contractErrors.push(
        `${contract.id} requirements.${kind} must be an array`,
      )
      continue
    }
    const applicability = contract.requirementApplicability?.[kind]
    if (requirements.length > 0 && applicability?.status !== 'required') {
      contractErrors.push(
        `${contract.id} requirements.${kind} must be marked required`,
      )
    }
    if (
      requirements.length === 0 &&
      applicability?.status !== 'not-applicable'
    ) {
      contractErrors.push(
        `${contract.id} requirements.${kind} omission must be governed not-applicable`,
      )
    }
    if (applicability?.status === 'not-applicable') {
      validateGovernance(
        applicability.governance,
        `${contract.id} requirements.${kind} not-applicable`,
        contractErrors,
      )
    }
  }
  if (
    !Array.isArray(contract.component?.exports) ||
    contract.component.exports.length === 0
  ) {
    contractErrors.push(`${contract.id} component.exports must be non-empty`)
  }
  if (
    JSON.stringify(contract.bindings?.web?.exports ?? []) !==
    JSON.stringify(contract.component?.exports ?? [])
  ) {
    contractErrors.push(
      `${contract.id} web exports must match component exports`,
    )
  }
  for (const field of ['renderMs', 'interactionMs']) {
    if (
      !Number.isFinite(contract.performanceBudget?.[field]) ||
      contract.performanceBudget[field] <= 0
    )
      contractErrors.push(`${contract.id} performanceBudget.${field} invalid`)
  }
  if (!contract.performanceBudget?.memory)
    contractErrors.push(`${contract.id} performanceBudget.memory missing`)
  const members = [
    ...(contract.inputs ?? []),
    ...(contract.outputs ?? []),
    ...(contract.operations ?? []),
    ...(contract.contentRegions ?? []),
  ]
  for (const member of members) {
    validateMember(member, contract.id, contractErrors)
  }
  for (const difference of contract.platformDifferences ?? []) {
    validateGovernance(
      difference.governance,
      `${contract.id} platform difference ${difference.member ?? '<unknown>'}`,
      contractErrors,
    )
    if (difference.scope && difference.scope !== 'member') {
      contractErrors.push(
        `${contract.id} platform difference ${difference.member ?? '<unknown>'} uses broad scope ${difference.scope}`,
      )
    }
  }
  for (const extra of contract.avaloniaExtras ?? []) {
    validateGovernance(
      extra.governance,
      `${contract.id} avalonia extra ${extra.member ?? '<unknown>'}`,
      contractErrors,
    )
    if (!Array.isArray(extra.scenarioIds) || extra.scenarioIds.length === 0) {
      contractErrors.push(
        `${contract.id} avalonia extra ${extra.member ?? '<unknown>'} missing scenario coverage id`,
      )
    }
  }
  if (contract.scenarioIds.length === 0) {
    contractErrors.push(`${contract.id} missing required scenario ids`)
  }
  if (/"aligned"\s*:\s*true/.test(JSON.stringify(contract))) {
    contractErrors.push(
      `${contract.id} must not hand-write final aligned: true`,
    )
  }
  validateMarkdownEditor(contract, gate, contractErrors)
  return contractErrors
}

export const validateRegistry = (registry, gate) => {
  const errors = []
  if (registry.schemaVersion !== CONTRACT_V2_SCHEMA_VERSION) {
    errors.push('registry schemaVersion must be 2')
  }
  if (registry.registryVersion !== CONTRACT_V2_REGISTRY_VERSION) {
    errors.push('registry registryVersion must be 2.0.0')
  }
  if (!Array.isArray(registry.contracts)) {
    errors.push('registry contracts must be an array')
    return errors
  }
  if (!Array.isArray(registry.avaloniaOnlyTypes)) {
    errors.push('registry avaloniaOnlyTypes must be an array')
  }
  if (!Array.isArray(registry.componentMap)) {
    errors.push('registry componentMap must be an array')
  }
  if (!Array.isArray(registry.publicExportMap)) {
    errors.push('registry publicExportMap must be an array')
  }
  if (!Array.isArray(registry.publicValueBindings)) {
    errors.push('registry publicValueBindings must be an array')
  }
  const contractIds = new Set()
  for (const contract of registry.contracts) {
    if (contractIds.has(contract.id)) {
      errors.push(`duplicate contract id ${contract.id}`)
    }
    contractIds.add(contract.id)
    validateContract(contract, gate, errors)
  }
  for (const entry of registry.avaloniaOnlyTypes ?? []) {
    const context = `avalonia-only type ${entry.type ?? '<unknown>'}`
    validateGovernance(entry.governance, context, errors)
    if (!Array.isArray(entry.scenarioIds) || entry.scenarioIds.length === 0) {
      errors.push(`${context} missing scenario coverage id`)
    }
  }
  for (const entry of registry.componentMap ?? []) {
    if (
      ![
        'canonical-export-name-equality',
        'explicit-component-binding',
      ].includes(entry.basis)
    ) {
      errors.push(
        `componentMap ${entry.vue?.name ?? '<unknown>'} must use canonical-export-name-equality basis`,
      )
    }
  }
  const exportNames = new Set()
  const exportsByContract = new Map()
  for (const entry of registry.publicExportMap ?? []) {
    const context = `public export ${entry.name ?? '<unknown>'}`
    if (exportNames.has(entry.name)) errors.push(`duplicate ${context}`)
    exportNames.add(entry.name)
    if (!['canonical', 'alias'].includes(entry.role)) {
      errors.push(`${context} has invalid role ${entry.role}`)
    }
    if (!contractIds.has(entry.contractId)) {
      errors.push(`${context} references missing contract ${entry.contractId}`)
      continue
    }
    const names = exportsByContract.get(entry.contractId) ?? []
    names.push(entry.name)
    exportsByContract.set(entry.contractId, names)
  }
  for (const contract of registry.contracts) {
    const mapped = (exportsByContract.get(contract.id) ?? []).sort()
    const declared = [...(contract.component?.exports ?? [])].sort()
    if (JSON.stringify(mapped) !== JSON.stringify(declared)) {
      errors.push(
        `${contract.id} public export map does not match component exports`,
      )
    }
  }
  const publicValueNames = new Set()
  for (const binding of registry.publicValueBindings ?? []) {
    const context = `public value ${binding.name ?? '<unknown>'}`
    if (publicValueNames.has(binding.name)) errors.push(`duplicate ${context}`)
    publicValueNames.add(binding.name)
    if (!MEMBER_STATUSES.includes(binding.status)) {
      errors.push(`${context} has invalid status ${binding.status}`)
    }
    if (!['enum', 'sentinel'].includes(binding.kind)) {
      errors.push(`${context} has invalid kind ${binding.kind}`)
    }
    if (
      !Array.isArray(binding.scenarioIds) ||
      binding.scenarioIds.length === 0
    ) {
      errors.push(`${context} missing scenario coverage id`)
    }
    if (binding.status !== 'aligned-candidate') {
      validateGovernance(binding.governance, context, errors)
    }
    if (binding.kind === 'enum' && binding.avalonia) {
      if (binding.avalonia.kind !== 'enum') {
        errors.push(`${context} counterpart is not an enum`)
      }
      const webNames = (binding.web?.values ?? [])
        .map((value) => value.name)
        .sort()
      const mappedNames = Object.keys(binding.valueMap ?? {}).sort()
      if (JSON.stringify(webNames) !== JSON.stringify(mappedNames)) {
        errors.push(`${context} value map does not cover every Web enum member`)
      }
      const avaloniaNames = new Set(
        (binding.avalonia.values ?? []).map((value) => value.name),
      )
      for (const mapped of Object.values(binding.valueMap ?? {})) {
        if (!avaloniaNames.has(mapped)) {
          errors.push(
            `${context} maps to missing Avalonia enum member ${mapped}`,
          )
        }
      }
    }
    if (binding.kind === 'sentinel' && binding.status !== 'web-only') {
      errors.push(`${context} sentinel must be explicitly web-only`)
    }
    if (
      binding.status === 'web-only' &&
      !['alternative', 'reviewedAt'].every(
        (field) =>
          typeof binding.governance?.[field] === 'string' &&
          binding.governance[field].trim() !== '',
      )
    ) {
      errors.push(`${context} web-only exception is not reviewed`)
    }
  }
  return errors
}

const main = () => {
  const args = new Set(process.argv.slice(2))
  const checkMode = args.has('--check')
  const registryPath = path.join(root, CONTRACT_V2_REGISTRY_PATH)
  const gatePath = path.join(root, MARKDOWN_EDITOR_GATE_PATH)

  if (!exists(gatePath)) {
    console.error(`${MARKDOWN_EDITOR_GATE_PATH} must exist`)
    process.exitCode = 1
    return
  }

  const vueBaseline = parseJson(path.join(root, VUE_BASELINE_PATH))
  const v1Registry = parseJson(path.join(root, CONTRACT_V1_REGISTRY_PATH))
  const avaloniaBaseline = parseJson(
    path.join(root, AVALONIA_SEMANTIC_PATHS.avalonia),
  )
  const avaloniaThemesBaseline = parseJson(
    path.join(root, AVALONIA_SEMANTIC_PATHS.avaloniaThemes),
  )
  const avaloniaIconsBaseline = parseJson(
    path.join(root, AVALONIA_SEMANTIC_PATHS.avaloniaIcons),
  )
  const gate = parseJson(gatePath)
  const registry = buildRegistry({
    vueBaseline,
    v1Registry,
    avaloniaBaseline,
    avaloniaThemesBaseline,
    avaloniaIconsBaseline,
    gate,
  })
  const errors = validateRegistry(registry, gate)
  if (errors.length > 0) {
    console.error('contract-v2 validation failed:')
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  const output = stableJson(registry)
  if (checkMode) {
    if (!exists(registryPath)) {
      console.error(
        `${CONTRACT_V2_REGISTRY_PATH} is missing; run pnpm run contract-v2:generate`,
      )
      process.exitCode = 1
      return
    }
    if (read(registryPath) !== output) {
      console.error(
        `${CONTRACT_V2_REGISTRY_PATH} drifted from generated output; run pnpm run contract-v2:generate`,
      )
      process.exitCode = 1
      return
    }
    console.log(
      `contract-v2:check passed (${registry.contracts.length} contracts, ${registry.coverage.total} members)`,
    )
    return
  }

  write(registryPath, output)
  console.log(
    `contract-v2:generate wrote ${CONTRACT_V2_REGISTRY_PATH} (${registry.contracts.length} contracts, ${registry.coverage.total} members)`,
  )
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
