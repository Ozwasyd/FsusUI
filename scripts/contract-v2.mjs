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

export const VUE_BASELINE_PATH = 'spec/baselines/vue-current.json'
export const AVALONIA_SEMANTIC_PATHS = {
  avalonia: 'spec/avalonia/semantic/FsusUI.Avalonia.semantic.json',
  avaloniaThemes: 'spec/avalonia/semantic/FsusUI.Avalonia.Themes.semantic.json',
  avaloniaIcons: 'spec/avalonia/semantic/FsusUI.Avalonia.Icons.semantic.json',
}
export const MARKDOWN_EDITOR_GATE_PATH =
  'spec/components/contracts/v2/markdown-editor-gate.json'
export const SEMANTIC_MEMBER_BINDINGS_PATH =
  'spec/components/contracts/v2/semantic-member-bindings.json'
export const CONTRACT_V2_REGISTRY_PATH =
  'spec/components/contracts/v2/contract-v2.json'

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
  'System.Void': 'void',
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
        if (normalized === 'void') return 'void'
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

const knownBoolean = (value) => (typeof value === 'boolean' ? value : null)

const normalizeDefault = (value) => {
  if (value === null) return 'null'
  if (value === undefined) return undefined
  if (typeof value === 'string') return value.toLowerCase()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'object' && value !== null)
    return String(value.value ?? value)
  return String(value)
}

const COMPARISON_KEY = [
  'type',
  'default',
  'required',
  'readWrite',
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

const compareInputDefaults = (web, avalonia) => {
  const webDefault = web.default
  if (typeof webDefault !== 'object' || webDefault == null) {
    return 'web default metadata unavailable'
  }
  if (avalonia?.defaultKnown !== true) {
    return 'avalonia default metadata unavailable'
  }
  if (!['literal', 'null'].includes(webDefault.kind)) {
    return `web default kind ${webDefault.kind ?? 'unknown'} is not comparable`
  }
  const webValue = webDefault.kind === 'null' ? null : webDefault.value
  if (normalizeDefault(webValue) !== normalizeDefault(avalonia.defaultValue)) {
    return (
      `web default=${JSON.stringify(webValue)} vs ` +
      `avalonia default=${JSON.stringify(avalonia.defaultValue)}`
    )
  }
  return null
}

const compareOperationSignatures = (web, avalonia) => {
  if (!web) return 'web signature unavailable'
  if (!avalonia) return 'avalonia signature unavailable'

  const differences = []
  if (!web.returnType) {
    differences.push('web return type unavailable')
  } else {
    const webReturn = categoriesFromVueProp({
      runtimeType: web.returnType,
      semanticType: web.returnType,
    })
    const avaloniaReturn = categoriesFromClrType(avalonia.returnType)
    const compatible = categoriesOverlap(webReturn, avaloniaReturn)
    if (compatible !== true) {
      differences.push(
        `return type ${compatible === false ? 'mismatch' : 'not comparable'}: web ${webReturn.join('|')} vs avalonia ${avaloniaReturn.join('|')}`,
      )
    }
  }

  const webParameters = web.parameters ?? []
  const avaloniaParameters = avalonia.parameters ?? []
  if (webParameters.length !== avaloniaParameters.length) {
    differences.push(
      `parameter count mismatch: web ${webParameters.length} vs avalonia ${avaloniaParameters.length}`,
    )
  }
  const comparableCount = Math.min(
    webParameters.length,
    avaloniaParameters.length,
  )
  for (let index = 0; index < comparableCount; index += 1) {
    const webParameter = webParameters[index]
    const avaloniaParameter = avaloniaParameters[index]
    if (
      Boolean(webParameter.optional) !== Boolean(avaloniaParameter.optional)
    ) {
      differences.push(
        `parameter ${index + 1} optionality mismatch: web ${Boolean(webParameter.optional)} vs avalonia ${Boolean(avaloniaParameter.optional)}`,
      )
    }
    if (webParameter.rest === true) {
      differences.push(
        `parameter ${index + 1} rest semantics unavailable on avalonia`,
      )
    }
    const webType = categoriesFromVueProp({
      runtimeType: webParameter.type,
      semanticType: webParameter.type,
    })
    const avaloniaType = categoriesFromClrType(avaloniaParameter.type)
    const compatible = categoriesOverlap(webType, avaloniaType)
    if (compatible !== true) {
      differences.push(
        `parameter ${index + 1} type ${compatible === false ? 'mismatch' : 'not comparable'}: web ${webType.join('|')} vs avalonia ${avaloniaType.join('|')}`,
      )
    }
  }

  return differences.length > 0 ? differences.join('; ') : null
}

const payloadFieldKey = (name) => toKebab(name ?? '')

const comparePayloadFields = (webShape, avaloniaShape) => {
  if (webShape?.kind !== 'object') {
    return `web payload shape unavailable: ${webShape?.reason ?? 'unknown type'}`
  }
  if (avaloniaShape?.kind !== 'object') {
    return `avalonia event args shape unavailable: ${avaloniaShape?.reason ?? 'unknown type'}`
  }

  const differences = []
  const avaloniaFields = new Map(
    avaloniaShape.fields.map((field) => [payloadFieldKey(field.name), field]),
  )
  const webFields = new Map(
    webShape.fields.map((field) => [payloadFieldKey(field.name), field]),
  )
  for (const webField of webShape.fields) {
    const key = payloadFieldKey(webField.name)
    const avaloniaField = avaloniaFields.get(key)
    if (!avaloniaField) {
      differences.push(`missing avalonia field ${webField.name}`)
      continue
    }
    if (Boolean(webField.optional) !== Boolean(avaloniaField.optional)) {
      differences.push(
        `field ${webField.name} optionality mismatch: web ${Boolean(webField.optional)} vs avalonia ${Boolean(avaloniaField.optional)}`,
      )
    }
    if (Boolean(webField.nullable) !== Boolean(avaloniaField.nullable)) {
      differences.push(
        `field ${webField.name} nullability mismatch: web ${Boolean(webField.nullable)} vs avalonia ${Boolean(avaloniaField.nullable)}`,
      )
    }
    const webCategories = categoriesFromVueProp({
      runtimeType: webField.type,
      semanticType: webField.type,
    })
    const avaloniaCategories = categoriesFromClrType(avaloniaField.type)
    const compatible = categoriesOverlap(webCategories, avaloniaCategories)
    if (compatible !== true) {
      differences.push(
        `field ${webField.name} type ${compatible === false ? 'mismatch' : 'not comparable'}: web ${webCategories.join('|')} vs avalonia ${avaloniaCategories.join('|')}`,
      )
    }
  }
  for (const avaloniaField of avaloniaShape.fields) {
    if (!webFields.has(payloadFieldKey(avaloniaField.name))) {
      differences.push(`extra avalonia field ${avaloniaField.name}`)
    }
  }
  return differences.length > 0 ? differences.join('; ') : null
}

const compareEventPayloads = (web, avalonia) => {
  if (!Array.isArray(web?.payload)) return 'web payload signature unavailable'
  if (web.payload.length !== 1) {
    return `web payload parameter count ${web.payload.length} is not comparable to Avalonia EventArgs`
  }
  const parameter = web.payload[0]
  const differences = []
  if (parameter.rest === true) {
    differences.push('web rest payload is not comparable to Avalonia EventArgs')
  }
  if (parameter.optional === true) {
    differences.push(
      'web optional payload is not comparable to Avalonia EventArgs',
    )
  }

  let avaloniaShape = avalonia?.argsShape
  if (
    avaloniaShape?.kind === 'object' &&
    avaloniaShape.fields.length === 1 &&
    payloadFieldKey(avaloniaShape.fields[0].name) ===
      payloadFieldKey(parameter.name) &&
    avaloniaShape.fields[0].shape?.kind === 'object'
  ) {
    const wrapper = avaloniaShape.fields[0]
    if (Boolean(parameter.nullable) !== Boolean(wrapper.nullable)) {
      differences.push(
        `payload ${parameter.name} nullability mismatch: web ${Boolean(parameter.nullable)} vs avalonia ${Boolean(wrapper.nullable)}`,
      )
    }
    avaloniaShape = wrapper.shape
  }
  const fieldDifference = comparePayloadFields(parameter.shape, avaloniaShape)
  if (fieldDifference) differences.push(fieldDifference)
  return differences.length > 0 ? differences.join('; ') : null
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
    const webNullable = web.nullable
    const avaloniaNullable = avalonia?.nullable
    if (typeof webNullable !== 'boolean') {
      setDrift(drift, 'nullability', 'web nullability metadata unavailable')
    } else if (typeof avaloniaNullable !== 'boolean') {
      setDrift(
        drift,
        'nullability',
        'avalonia nullability metadata unavailable',
      )
    } else if (webNullable !== avaloniaNullable) {
      setDrift(
        drift,
        'nullability',
        `web nullable=${webNullable} vs avalonia nullable=${avaloniaNullable}`,
      )
    }

    const defaultDifference = compareInputDefaults(web, avalonia)
    if (defaultDifference) {
      setDrift(drift, 'default', defaultDifference)
    }

    if (typeof web.required !== 'boolean') {
      setDrift(drift, 'required', 'web required metadata unavailable')
    } else if (typeof avalonia?.required !== 'boolean') {
      setDrift(drift, 'required', 'avalonia required metadata unavailable')
    } else if (web.required !== avalonia.required) {
      setDrift(
        drift,
        'required',
        `web required=${web.required} vs avalonia required=${avalonia.required}`,
      )
    }

    const readWriteDifferences = []
    if (typeof web.readonly !== 'boolean') {
      readWriteDifferences.push('web readonly metadata unavailable')
    }
    if (typeof avalonia?.canRead !== 'boolean') {
      readWriteDifferences.push('avalonia canRead metadata unavailable')
    } else if (avalonia.canRead !== true) {
      readWriteDifferences.push('avalonia canRead=false')
    }
    if (typeof avalonia?.canWrite !== 'boolean') {
      readWriteDifferences.push('avalonia canWrite metadata unavailable')
    } else if (
      typeof web.readonly === 'boolean' &&
      web.readonly === avalonia.canWrite
    ) {
      readWriteDifferences.push(
        `web readonly=${web.readonly} vs avalonia canWrite=${avalonia.canWrite}`,
      )
    }
    if (readWriteDifferences.length > 0) {
      setDrift(drift, 'readWrite', readWriteDifferences.join('; '))
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
    const difference = compareEventPayloads(web, avalonia)
    if (difference) {
      setDrift(drift, 'eventPayload', difference)
    }
  }

  if (kind === 'operation') {
    const difference = compareOperationSignatures(
      web.signature,
      avalonia?.signature,
    )
    if (difference) {
      setDrift(drift, 'operationSignature', difference)
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
  baseline: VUE_BASELINE_PATH,
  categories: categoriesFromVueProp(prop),
  runtimeType: prop.runtimeType ?? null,
  semanticType: prop.semanticType ?? null,
  nullable: knownBoolean(prop.nullable),
  default: prop.default ?? null,
  values: prop.values ?? null,
  required: knownBoolean(prop.required),
  readonly: knownBoolean(prop.readonly),
})

const avaloniaPropRef = (property) => ({
  member: property.name,
  categories: categoriesFromClrType(property.type),
  type: property.type,
  nullable: knownBoolean(property.nullable),
  propertyKind: property.propertyKind,
  defaultKnown: property.defaultKnown,
  defaultValue: property.defaultKnown ? property.defaultValue : null,
  required: knownBoolean(property.required),
  canRead: knownBoolean(property.canRead),
  canWrite: knownBoolean(property.canWrite),
  isStatic: knownBoolean(property.isStatic),
  enumMembers: property.enumMembers ?? undefined,
})

const webEventRef = (member, semantic) => ({
  member,
  baseline: VUE_BASELINE_PATH,
  payload: semantic?.payload ?? null,
  payloadShapeStatus: semantic?.payloadShapeStatus ?? null,
  payloadShapeReason: semantic?.payloadShapeReason ?? null,
})

const avaloniaPayloadShape = (
  typeName,
  typeIndex,
  depth = 0,
  seen = new Set(),
) => {
  const normalized = (typeName ?? '').replace(/[?&]$/u, '')
  if (!normalized) {
    return { kind: 'unknown', type: null, reason: 'event args type is empty' }
  }
  if (seen.has(normalized)) {
    return {
      kind: 'unknown',
      type: normalized,
      reason: 'recursive event args type',
    }
  }
  const type = typeIndex.get(normalized)
  if (!type) {
    return {
      kind: 'unknown',
      type: normalized,
      reason: 'framework or unresolved event args type',
    }
  }
  const nextSeen = new Set(seen)
  nextSeen.add(normalized)
  const properties = (type.properties ?? []).filter(
    (property) => property.canRead !== false && property.isStatic !== true,
  )
  if (properties.length === 0 || properties.length > 64) {
    return {
      kind: 'unknown',
      type: normalized,
      reason:
        properties.length === 0
          ? 'event args type has no readable fields'
          : 'event args type exceeds the 64-field comparison bound',
    }
  }
  return {
    kind: 'object',
    type: normalized,
    fields: properties
      .map((property) => ({
        name: property.name,
        type: property.type,
        optional: false,
        nullable: Boolean(property.nullable),
        shape:
          depth < 1 && typeIndex.has(property.type)
            ? avaloniaPayloadShape(
                property.type,
                typeIndex,
                depth + 1,
                nextSeen,
              )
            : undefined,
      }))
      .sort((first, second) => first.name.localeCompare(second.name)),
  }
}

const avaloniaEventRef = (event, typeIndex) => {
  const argsType =
    event.argsType?.match(/^System\.EventHandler<(.+)>$/u)?.[1] ?? null
  return {
    member: event.name,
    categories: categoriesFromClrType(event.argsType),
    argsType: event.argsType,
    argsShape: avaloniaPayloadShape(argsType, typeIndex),
  }
}

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

const webMethodRef = (member, semantic) => ({
  member,
  baseline: VUE_BASELINE_PATH,
  signature: semantic
    ? {
        returnType: semantic.returnType ?? null,
        parameters: (semantic.parameters ?? []).map((parameter) => ({
          name: parameter.name,
          type: parameter.type ?? null,
          optional: Boolean(parameter.optional),
          rest: Boolean(parameter.rest),
        })),
      }
    : null,
})

const avaloniaSemanticIndex = (baselines) => {
  const index = new Map()
  for (const [packageId] of Object.entries(AVALONIA_SEMANTIC_PATHS)) {
    for (const type of baselines[packageId]?.semanticTypes ?? []) {
      index.set(type.name, { ...type, packageId })
    }
  }
  return index
}

const canonicalAvaloniaPropertySurface = (
  property,
  avaloniaProperty,
  contentProperty,
) => ({
  kind: 'property',
  member: property.name,
  type: property.type,
  nullable: knownBoolean(property.nullable),
  canRead: knownBoolean(property.canRead),
  canWrite: knownBoolean(property.canWrite),
  isStatic: knownBoolean(property.isStatic),
  required: knownBoolean(property.required),
  isContentProperty: contentProperty === property.name,
  avaloniaProperty: avaloniaProperty
    ? {
        kind: avaloniaProperty.kind,
        type: avaloniaProperty.type,
        nullable: knownBoolean(avaloniaProperty.nullable),
        defaultKnown: Object.hasOwn(avaloniaProperty, 'defaultValue'),
        defaultValue: Object.hasOwn(avaloniaProperty, 'defaultValue')
          ? avaloniaProperty.defaultValue
          : null,
      }
    : null,
})

const canonicalAvaloniaPropertyOnlySurface = (property, contentProperty) => ({
  kind: 'avalonia-property',
  member: property.name,
  propertyKind: property.kind,
  type: property.type,
  nullable: knownBoolean(property.nullable),
  defaultKnown: Object.hasOwn(property, 'defaultValue'),
  defaultValue: Object.hasOwn(property, 'defaultValue')
    ? property.defaultValue
    : null,
  isContentProperty: contentProperty === property.name,
})

const canonicalAvaloniaEventSurface = (event) => ({
  kind: 'event',
  member: event.name,
  eventKind: event.kind,
  argsType: event.argsType,
  isStatic: knownBoolean(event.isStatic),
})

const canonicalAvaloniaMethodSurface = (method) => ({
  kind: 'method',
  member: method.name,
  isStatic: knownBoolean(method.isStatic),
  returnType: method.returnType,
  parameters: (method.parameters ?? []).map((parameter) => ({
    name: parameter.name,
    type: parameter.type,
    optional: knownBoolean(parameter.optional),
  })),
})

const canonicalAvaloniaEnumMemberSurface = (member) => ({
  kind: 'enum-member',
  member: member.name,
  value: member.value,
})

export const avaloniaPublicSurfaces = (type) => {
  const avaloniaProperties = new Map(
    (type.avaloniaProperties ?? []).map((property) => [
      property.name,
      property,
    ]),
  )
  const surfaces = (type.properties ?? []).map((property) =>
    canonicalAvaloniaPropertySurface(
      property,
      avaloniaProperties.get(property.name),
      type.contentProperty,
    ),
  )
  const clrPropertyNames = new Set(
    (type.properties ?? []).map((property) => property.name),
  )
  for (const property of type.avaloniaProperties ?? []) {
    if (clrPropertyNames.has(property.name)) continue
    surfaces.push(
      canonicalAvaloniaPropertyOnlySurface(property, type.contentProperty),
    )
  }
  surfaces.push(
    ...(type.events ?? []).map(canonicalAvaloniaEventSurface),
    ...(type.methods ?? []).map(canonicalAvaloniaMethodSurface),
    ...(type.enumMembers ?? []).map(canonicalAvaloniaEnumMemberSurface),
  )
  return surfaces.sort(
    (first, second) =>
      first.member.localeCompare(second.member) ||
      first.kind.localeCompare(second.kind) ||
      JSON.stringify(first).localeCompare(JSON.stringify(second)),
  )
}

const avaloniaSurfaceFingerprint = (surface) => sha256(JSON.stringify(surface))

const avaloniaTypeSurfaceHash = (type) =>
  sha256(
    JSON.stringify({
      type: type.name,
      kind: type.kind,
      baseType: type.baseType ?? null,
      isAbstract: knownBoolean(type.isAbstract),
      isSealed: knownBoolean(type.isSealed),
      surfaces: avaloniaPublicSurfaces(type),
    }),
  )

const findAvaloniaType = (componentName, typeIndex) => {
  const kebab = kebabName(componentName)
  for (const [fullName, type] of typeIndex) {
    const shortName = fullName.split('.').pop() ?? ''
    if (kebabName(shortName) === kebab && type.kind === 'class') {
      return type
    }
  }
  return null
}

const combinedAvaloniaProperty = (name, avaloniaType) => {
  const property =
    (avaloniaType.properties ?? []).find(
      (candidate) => candidate.name === name,
    ) ?? null
  const avaloniaProperty =
    (avaloniaType.avaloniaProperties ?? []).find(
      (candidate) => candidate.name === name,
    ) ?? null
  if (!property && !avaloniaProperty) return null
  return {
    name,
    type: avaloniaProperty?.type ?? property?.type ?? null,
    nullable:
      typeof avaloniaProperty?.nullable === 'boolean'
        ? avaloniaProperty.nullable
        : typeof property?.nullable === 'boolean'
          ? property.nullable
          : null,
    propertyKind: avaloniaProperty?.kind ?? 'clr',
    defaultKnown:
      avaloniaProperty != null &&
      Object.hasOwn(avaloniaProperty, 'defaultValue'),
    defaultValue: avaloniaProperty?.defaultValue,
    required:
      typeof property?.required === 'boolean' ? property.required : null,
    canRead: typeof property?.canRead === 'boolean' ? property.canRead : null,
    canWrite:
      typeof property?.canWrite === 'boolean' ? property.canWrite : null,
    isStatic:
      typeof property?.isStatic === 'boolean' ? property.isStatic : null,
  }
}

const matchAvaloniaProperty = (webName, avaloniaType, binding) => {
  if (binding) {
    return combinedAvaloniaProperty(binding.avalonia, avaloniaType)
  }
  const normalized = normalizeMemberName(webName)
  const properties = [
    ...(avaloniaType.avaloniaProperties ?? []),
    ...(avaloniaType.properties ?? []),
  ]
  const seen = new Set()
  for (const property of properties) {
    if (seen.has(property.name)) continue
    seen.add(property.name)
    if (normalizeMemberName(property.name) === normalized) {
      return combinedAvaloniaProperty(property.name, avaloniaType)
    }
  }
  return null
}

const matchAvaloniaEvent = (webName, avaloniaType, binding) => {
  if (binding) {
    return (
      (avaloniaType.events ?? []).find(
        (event) => event.name === binding.avalonia,
      ) ?? null
    )
  }
  const normalized = normalizeMemberName(webName)
  for (const event of avaloniaType.events ?? []) {
    if (normalizeMemberName(event.name) === normalized) return event
  }
  return null
}

const matchAvaloniaMethod = (webName, avaloniaType, binding) => {
  if (binding) {
    return (
      (avaloniaType.methods ?? []).find(
        (method) => method.name === binding.avalonia,
      ) ?? null
    )
  }
  const normalized = normalizeMemberName(webName)
  for (const method of avaloniaType.methods ?? []) {
    if (normalizeMemberName(method.name) === normalized) return method
  }
  return null
}

const bindingMetadata = (binding) =>
  binding
    ? {
        semantic: binding.semantic,
        bindingBasis: 'explicit-semantic',
      }
    : {}

const inputMember = ({
  contractKebab,
  prop,
  avaloniaType,
  classification,
  binding,
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
      ...bindingMetadata(binding),
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
  const avalonia = matchAvaloniaProperty(prop.name, avaloniaType, binding)
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
    ...bindingMetadata(binding),
    governance,
  }
}

const outputMember = ({
  contractKebab,
  emit,
  semantic,
  avaloniaType,
  typeIndex,
  classification,
  binding,
}) => {
  const web = webEventRef(emit, binding ? semantic : null)
  if (!avaloniaType) {
    return {
      name: emit,
      kind: 'output',
      web,
      avalonia: null,
      status: classification === 'web-only' ? 'web-only' : 'missing',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'output', emit)],
      ...bindingMetadata(binding),
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
  const avalonia = matchAvaloniaEvent(emit, avaloniaType, binding)
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
      web,
      avalonia: avaloniaEventRef(avalonia, typeIndex),
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
    name: emit,
    kind: 'output',
    web,
    avalonia: avalonia ? avaloniaEventRef(avalonia, typeIndex) : null,
    status,
    drift,
    scenarioIds: [scenarioId(contractKebab, 'output', emit)],
    ...bindingMetadata(binding),
    governance,
  }
}

const operationMember = ({
  contractKebab,
  exposed,
  semantic,
  avaloniaType,
  classification,
  binding,
}) => {
  if (!avaloniaType) {
    return {
      name: exposed,
      kind: 'operation',
      web: webMethodRef(exposed, semantic),
      avalonia: null,
      status: classification === 'web-only' ? 'web-only' : 'missing',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'operation', exposed)],
      ...bindingMetadata(binding),
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
  const avalonia = matchAvaloniaMethod(exposed, avaloniaType, binding)
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
      web: webMethodRef(exposed, semantic),
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
    name: exposed,
    kind: 'operation',
    web: webMethodRef(exposed, semantic),
    avalonia: avalonia ? avaloniaMethodRef(avalonia) : null,
    status,
    drift,
    scenarioIds: [scenarioId(contractKebab, 'operation', exposed)],
    ...bindingMetadata(binding),
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
  const avalonia = avaloniaType?.contentProperty
    ? { member: avaloniaType.contentProperty, content: true }
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
  const keyboard = [
    'All public operations must be keyboard reachable and activatable.',
  ]
  const pointer = []
  if (outputs.length > 0) {
    pointer.push(
      'Pointer/tap activation must raise the corresponding public output.',
    )
  }
  if (inputNames.has('disabled')) {
    pointer.push('Disabled surfaces must not respond to pointer activation.')
  }
  const focus = [
    'Focus entry must surface the same public focus state on both platforms.',
  ]
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
  return { keyboard, pointer, focus, a11y, motion, perf }
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

const semanticBindingKey = (component, kind, web) =>
  `${component}\u0000${kind}\u0000${web}`

const semanticBindingIndex = (registry) =>
  new Map(
    (registry?.mappings ?? []).map((binding) => [
      semanticBindingKey(binding.component, binding.kind, binding.web),
      binding,
    ]),
  )

const contractForComponent = ({
  component,
  avaloniaType,
  typeIndex,
  gate,
  semanticBindings,
}) => {
  // Keep the full export name in the stable id so distinct public exports such
  // as ElCollectionSummary and FsusCollectionSummary never collide.
  const contractKebab = toKebab(component.name)
  const classification = component.classification ?? 'portable'
  const bindingFor = (kind, web) =>
    semanticBindings.get(semanticBindingKey(component.name, kind, web))
  const inputs = (component.semantic?.props ?? []).map((prop) =>
    inputMember({
      contractKebab,
      prop,
      avaloniaType,
      classification,
      binding: bindingFor('input', prop.name),
    }),
  )
  const outputs = (component.emits ?? []).map((emit) =>
    outputMember({
      contractKebab,
      emit,
      semantic: (component.semantic?.emits ?? []).find(
        (member) => member.name === emit,
      ),
      avaloniaType,
      typeIndex,
      classification,
      binding: bindingFor('output', emit),
    }),
  )
  const operations = (component.exposed ?? []).map((exposed) =>
    operationMember({
      contractKebab,
      exposed,
      semantic: (component.semantic?.exposed ?? []).find(
        (member) => member.name === exposed,
      ),
      avaloniaType,
      classification,
      binding: bindingFor('operation', exposed),
    }),
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
  const requirements = deriveRequirements({
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
    },
    bindings: {
      web: {
        status: 'source',
        package: '@ozwasyd/element-plus',
        memberRef: memberRef('component'),
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

const methodSignatureMatchesSurface = (signature, surface) =>
  surface.kind === 'method' &&
  signature?.returnType === surface.returnType &&
  JSON.stringify(signature?.parameters ?? []) ===
    JSON.stringify(surface.parameters)

const resolveAvaloniaSurfaceClaims = ({
  contract,
  avaloniaType,
  errors = [],
}) => {
  const surfaces = avaloniaPublicSurfaces(avaloniaType)
  const claims = new Set()
  const sections = [
    ['inputs', new Set(['property', 'avalonia-property'])],
    ['outputs', new Set(['event'])],
    ['operations', new Set(['method'])],
    ['contentRegions', new Set(['property', 'avalonia-property'])],
  ]
  for (const [section, surfaceKinds] of sections) {
    for (const member of contract[section] ?? []) {
      if (!member.avalonia?.member) continue
      let candidates = surfaces.filter(
        (surface) =>
          surfaceKinds.has(surface.kind) &&
          surface.member === member.avalonia.member,
      )
      if (section === 'operations') {
        candidates = candidates.filter((surface) =>
          methodSignatureMatchesSurface(member.avalonia.signature, surface),
        )
      }
      const context =
        `${contract.id} ${member.kind} ${member.name} Avalonia ` +
        `${member.avalonia.member}`
      if (candidates.length !== 1) {
        errors.push(
          `${context} resolves to ${candidates.length} real public surfaces`,
        )
        continue
      }
      const fingerprint = avaloniaSurfaceFingerprint(candidates[0])
      if (claims.has(fingerprint)) {
        errors.push(
          `${context} duplicates an already registered public surface`,
        )
      }
      claims.add(fingerprint)
    }
  }
  return claims
}

const avaloniaExtraForSurface = (
  contractKebab,
  surface,
  disambiguateMember,
) => ({
  member: surface.member,
  kind: 'avalonia-extra',
  surfaceKind: surface.kind,
  surfaceHash: avaloniaSurfaceFingerprint(surface),
  governance: defaultGovernance(
    'Avalonia-only public member explicitly registered; no Vue counterpart exists in the baseline.',
  ),
  scenarioIds: [
    `scenario.v2.${contractKebab}.avalonia-extra.${toKebab(surface.member)}` +
      (disambiguateMember
        ? `.${toKebab(surface.kind)}.${avaloniaSurfaceFingerprint(surface).slice(0, 12)}`
        : ''),
  ],
})

const extractAvaloniaExtras = ({
  contractKebab,
  avaloniaType,
  inputs,
  outputs,
  operations,
  contentRegions,
}) => {
  const contract = {
    id: `component-v2.${contractKebab}`,
    inputs,
    outputs,
    operations,
    contentRegions,
  }
  const matchedSurfaces = resolveAvaloniaSurfaceClaims({
    contract,
    avaloniaType,
  })
  const unmatched = avaloniaPublicSurfaces(avaloniaType).filter(
    (surface) => !matchedSurfaces.has(avaloniaSurfaceFingerprint(surface)),
  )
  const memberCounts = new Map()
  for (const surface of unmatched) {
    memberCounts.set(
      surface.member,
      (memberCounts.get(surface.member) ?? 0) + 1,
    )
  }
  return unmatched.map((surface) =>
    avaloniaExtraForSurface(
      contractKebab,
      surface,
      memberCounts.get(surface.member) > 1,
    ),
  )
}

const avaloniaOnlyType = ({ type, packageId }) => ({
  type: type.name,
  kind: type.kind,
  packageId,
  baseline: AVALONIA_SEMANTIC_PATHS[packageId],
  memberCount: avaloniaPublicSurfaces(type).length,
  surfaceHash: avaloniaTypeSurfaceHash(type),
  scenarioIds: [
    `scenario.v2.avalonia-only.${toKebab(type.name.split('.').pop() ?? type.name)}`,
  ],
  governance: defaultGovernance(
    'Avalonia-only public type explicitly registered; no Vue component counterpart exists in the baseline.',
  ),
})

export const buildComponentMap = ({ vueBaseline, typeIndex }) => {
  const map = []
  for (const component of vueBaseline.components ?? []) {
    const avaloniaType = findAvaloniaType(component.name, typeIndex)
    if (!avaloniaType) continue
    map.push({
      vue: { name: component.name, module: component.module },
      avalonia: {
        type: avaloniaType.name,
        packageId: avaloniaType.packageId,
        surfaceHash: avaloniaTypeSurfaceHash(avaloniaType),
      },
      basis: 'name-equality',
    })
  }
  return map.sort((first, second) =>
    first.vue.name.localeCompare(second.vue.name),
  )
}

export const buildRegistry = ({
  vueBaseline,
  avaloniaBaseline,
  avaloniaThemesBaseline,
  avaloniaIconsBaseline,
  gate,
  semanticMemberBindings = { mappings: [] },
}) => {
  const baselines = {
    avalonia: avaloniaBaseline,
    avaloniaThemes: avaloniaThemesBaseline,
    avaloniaIcons: avaloniaIconsBaseline,
  }
  const typeIndex = avaloniaSemanticIndex(baselines)
  const semanticBindings = semanticBindingIndex(semanticMemberBindings)
  const componentMap = buildComponentMap({ vueBaseline, typeIndex })
  const mappedTypes = new Set(componentMap.map((entry) => entry.avalonia.type))
  const contracts = []
  for (const component of vueBaseline.components ?? []) {
    const avaloniaType = findAvaloniaType(component.name, typeIndex)
    contracts.push(
      contractForComponent({
        component,
        avaloniaType,
        typeIndex,
        gate,
        semanticBindings,
      }),
    )
  }
  contracts.sort((first, second) => first.id.localeCompare(second.id))

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
      toolVersion: '1.2.0',
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
      semanticMemberBindings: {
        path: SEMANTIC_MEMBER_BINDINGS_PATH,
        hash: sha256(read(path.join(root, SEMANTIC_MEMBER_BINDINGS_PATH))),
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
      semanticMemberBindings:
        'explicit platform-neutral semantic ids bind non-equivalent framework member names before normalized candidate matching',
      statusDerivation: {
        alignedCandidate:
          'real member matched with no type/default/required/read-write/nullability/enum/payload drift',
        partial:
          'real member matched but semantic drift or non-comparable typing',
        missing: 'no real counterpart member on the other platform',
        webOnly: 'explicit web-only registration with governance',
      },
      aligned:
        'final aligned status is never hand-written; only aligned-candidate is derived',
    },
    componentMap,
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

const vueMembersForKind = (component, kind) => {
  if (kind === 'input') {
    return (component.semantic?.props ?? []).map((item) => item.name)
  }
  if (kind === 'output') return component.emits ?? []
  if (kind === 'operation') return component.exposed ?? []
  if (kind === 'contentRegion') {
    return (component.slots ?? []).map((item) => item.name)
  }
  return []
}

const avaloniaMembersForKind = (type, kind) => {
  if (kind === 'input') {
    return [...(type.avaloniaProperties ?? []), ...(type.properties ?? [])].map(
      (item) => item.name,
    )
  }
  if (kind === 'output') return (type.events ?? []).map((item) => item.name)
  if (kind === 'operation') return (type.methods ?? []).map((item) => item.name)
  if (kind === 'contentRegion') {
    return type.contentProperty ? [type.contentProperty] : []
  }
  return []
}

export const validateSemanticMemberBindings = ({
  registry,
  vueBaseline,
  avaloniaBaselines,
}) => {
  const errors = []
  if (registry?.schemaVersion !== 1) {
    errors.push('semantic member bindings schemaVersion must be 1')
  }
  if (!Array.isArray(registry?.mappings)) {
    return [...errors, 'semantic member bindings mappings must be an array']
  }
  const typeIndex = avaloniaSemanticIndex(avaloniaBaselines)
  const components = new Map(
    (vueBaseline.components ?? []).map((component) => [
      component.name,
      component,
    ]),
  )
  const seenBindings = new Set()
  const seenSemantics = new Set()
  for (const binding of registry.mappings) {
    const context =
      `semantic binding ${binding?.component ?? '<unknown>'}/` +
      `${binding?.kind ?? '<unknown>'}/${binding?.web ?? '<unknown>'}`
    for (const field of ['component', 'semantic', 'kind', 'web', 'avalonia']) {
      if (
        typeof binding?.[field] !== 'string' ||
        binding[field].trim() === ''
      ) {
        errors.push(`${context} missing ${field}`)
      }
    }
    if (
      !['input', 'output', 'operation', 'contentRegion'].includes(binding?.kind)
    ) {
      errors.push(`${context} has invalid kind ${binding?.kind}`)
      continue
    }
    const key = semanticBindingKey(binding.component, binding.kind, binding.web)
    if (seenBindings.has(key)) errors.push(`${context} is duplicated`)
    seenBindings.add(key)
    const semanticKey = `${binding.component}\u0000${binding.kind}\u0000${binding.semantic}`
    if (seenSemantics.has(semanticKey)) {
      errors.push(`${context} duplicates semantic id ${binding.semantic}`)
    }
    seenSemantics.add(semanticKey)
    const component = components.get(binding.component)
    if (!component) {
      errors.push(`${context} references an unknown Vue component`)
      continue
    }
    if (!vueMembersForKind(component, binding.kind).includes(binding.web)) {
      errors.push(`${context} references a missing real Vue member`)
    }
    const avaloniaType = findAvaloniaType(component.name, typeIndex)
    if (!avaloniaType) {
      errors.push(`${context} has no real Avalonia component type`)
      continue
    }
    if (
      !avaloniaMembersForKind(avaloniaType, binding.kind).includes(
        binding.avalonia,
      )
    ) {
      errors.push(
        `${context} references a missing real Avalonia member ${binding.avalonia}`,
      )
    }
  }
  return errors
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
  if (member.bindingBasis === 'explicit-semantic') {
    if (typeof member.semantic !== 'string' || member.semantic.trim() === '') {
      errors.push(`${context} explicit semantic binding is missing semantic id`)
    }
    if (member.avalonia == null) {
      errors.push(
        `${context} explicit semantic binding is missing its Avalonia member`,
      )
    }
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
  for (const section of ['states', 'requirements', 'bindings']) {
    if (typeof contract[section] !== 'object' || contract[section] == null) {
      contractErrors.push(`${contract.id} ${section} must be an object`)
    }
  }
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
    if (
      typeof extra.surfaceKind !== 'string' ||
      !/^[a-f0-9]{64}$/.test(extra.surfaceHash ?? '')
    ) {
      contractErrors.push(
        `${contract.id} avalonia extra ${extra.member ?? '<unknown>'} missing canonical public surface identity`,
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

export const validateAvaloniaSurfaceRegistration = ({
  registry,
  avaloniaBaselines,
}) => {
  const errors = []
  const types = new Map()
  for (const [packageId] of Object.entries(AVALONIA_SEMANTIC_PATHS)) {
    for (const type of avaloniaBaselines[packageId]?.semanticTypes ?? []) {
      if (types.has(type.name)) {
        errors.push(`duplicate Avalonia baseline type ${type.name}`)
        continue
      }
      types.set(type.name, { ...type, packageId })
    }
  }

  const contracts = new Map()
  for (const contract of registry.contracts ?? []) {
    const componentName = contract.component?.name
    if (!componentName) continue
    if (contracts.has(componentName)) {
      errors.push(`duplicate contract component ${componentName}`)
      continue
    }
    contracts.set(componentName, contract)
  }

  const mappedTypes = new Set()
  const mappedComponents = new Set()
  let mappedSurfaceStates = 0
  let mappedClaims = 0
  let avaloniaExtras = 0
  for (const mapping of registry.componentMap ?? []) {
    const componentName = mapping.vue?.name
    const typeName = mapping.avalonia?.type
    const context =
      `componentMap ${componentName ?? '<unknown>'} -> ` +
      `${typeName ?? '<unknown>'}`
    if (mappedComponents.has(componentName)) {
      errors.push(`${context} duplicates a Vue component mapping`)
      continue
    }
    mappedComponents.add(componentName)
    const type = types.get(typeName)
    if (!type) {
      errors.push(`${context} references a missing Avalonia baseline type`)
      continue
    }
    mappedTypes.add(typeName)
    if (mapping.avalonia?.packageId !== type.packageId) {
      errors.push(`${context} has stale package ownership`)
    }
    if (mapping.avalonia?.surfaceHash !== avaloniaTypeSurfaceHash(type)) {
      errors.push(`${context} has stale public surface hash`)
    }
    const contract = contracts.get(componentName)
    if (!contract) {
      errors.push(`${context} has no component contract`)
      continue
    }

    const surfaces = avaloniaPublicSurfaces(type)
    const claims = resolveAvaloniaSurfaceClaims({
      contract,
      avaloniaType: type,
      errors,
    })
    mappedSurfaceStates += surfaces.length
    mappedClaims += claims.size

    const unmatchedSurfaces = surfaces.filter(
      (surface) => !claims.has(avaloniaSurfaceFingerprint(surface)),
    )
    const unmatchedMemberCounts = new Map()
    for (const surface of unmatchedSurfaces) {
      unmatchedMemberCounts.set(
        surface.member,
        (unmatchedMemberCounts.get(surface.member) ?? 0) + 1,
      )
    }
    const expectedExtras = new Map(
      unmatchedSurfaces.map((surface) => [
        avaloniaSurfaceFingerprint(surface),
        surface,
      ]),
    )
    const actualExtras = new Map()
    for (const extra of contract.avaloniaExtras ?? []) {
      avaloniaExtras += 1
      const extraContext = `${contract.id} avalonia extra ${extra.member ?? '<unknown>'}`
      if (extra.kind !== 'avalonia-extra') {
        errors.push(`${extraContext} has invalid status ${extra.kind}`)
      }
      if (
        typeof extra.surfaceKind !== 'string' ||
        typeof extra.surfaceHash !== 'string'
      ) {
        errors.push(`${extraContext} has no canonical public surface identity`)
        continue
      }
      const fingerprint = extra.surfaceHash
      if (actualExtras.has(fingerprint)) {
        errors.push(`${extraContext} duplicates a public surface registration`)
      }
      actualExtras.set(fingerprint, extra)
      const expectedSurface = expectedExtras.get(fingerprint)
      if (!expectedSurface) {
        errors.push(
          `${extraContext} does not match an unmatched real public surface`,
        )
      } else if (
        extra.member !== expectedSurface.member ||
        extra.surfaceKind !== expectedSurface.kind
      ) {
        errors.push(
          `${extraContext} member or kind disagrees with its real public surface`,
        )
      } else {
        const expectedEntry = avaloniaExtraForSurface(
          toKebab(componentName),
          expectedSurface,
          unmatchedMemberCounts.get(expectedSurface.member) > 1,
        )
        if (
          JSON.stringify(extra.scenarioIds) !==
          JSON.stringify(expectedEntry.scenarioIds)
        ) {
          errors.push(
            `${extraContext} has stale or non-unique scenario coverage identity`,
          )
        }
      }
    }
    for (const [fingerprint, surface] of expectedExtras) {
      if (actualExtras.has(fingerprint)) continue
      errors.push(
        `${contract.id} real Avalonia ${surface.kind} ${surface.member} is neither mapped nor registered as avalonia-extra`,
      )
    }
  }

  const onlyTypes = new Map()
  for (const entry of registry.avaloniaOnlyTypes ?? []) {
    const context = `avalonia-only type ${entry.type ?? '<unknown>'}`
    if (onlyTypes.has(entry.type)) {
      errors.push(`${context} is registered more than once`)
      continue
    }
    onlyTypes.set(entry.type, entry)
    const type = types.get(entry.type)
    if (!type) {
      errors.push(`${context} does not exist in the Avalonia baselines`)
      continue
    }
    if (mappedTypes.has(entry.type)) {
      errors.push(`${context} is also registered as a Vue counterpart`)
    }
    const expected = avaloniaOnlyType({
      type,
      packageId: type.packageId,
    })
    for (const field of [
      'kind',
      'packageId',
      'baseline',
      'memberCount',
      'surfaceHash',
    ]) {
      if (entry[field] !== expected[field]) {
        errors.push(`${context} has stale ${field}`)
      }
    }
  }

  let avaloniaOnlySurfaces = 0
  let mappedTypeSurfaces = 0
  for (const type of types.values()) {
    const surfaceCount = avaloniaPublicSurfaces(type).length
    if (mappedTypes.has(type.name)) {
      mappedTypeSurfaces += surfaceCount
      continue
    }
    avaloniaOnlySurfaces += surfaceCount
    if (!onlyTypes.has(type.name)) {
      errors.push(
        `real Avalonia type ${type.name} has no Vue counterpart and is not registered as avalonia-extra`,
      )
    }
  }

  return {
    errors,
    stats: {
      baselineTypes: types.size,
      mappedTypes: mappedTypes.size,
      mappedContracts: mappedComponents.size,
      avaloniaOnlyTypes: types.size - mappedTypes.size,
      avaloniaOnlySurfaces,
      mappedTypeSurfaces,
      baselineSurfaces: mappedTypeSurfaces + avaloniaOnlySurfaces,
      mappedSurfaceStates,
      mappedClaims,
      avaloniaExtras,
      internalSurfaces: 0,
    },
  }
}

export const validateRegistry = (
  registry,
  gate,
  { avaloniaBaselines = null } = {},
) => {
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
    if (entry.basis !== 'name-equality') {
      errors.push(
        `componentMap ${entry.vue?.name ?? '<unknown>'} must use name-equality basis`,
      )
    }
  }
  if (avaloniaBaselines) {
    errors.push(
      ...validateAvaloniaSurfaceRegistration({
        registry,
        avaloniaBaselines,
      }).errors,
    )
  }
  return errors
}

const main = () => {
  const args = new Set(process.argv.slice(2))
  const checkMode = args.has('--check')
  const registryPath = path.join(root, CONTRACT_V2_REGISTRY_PATH)
  const gatePath = path.join(root, MARKDOWN_EDITOR_GATE_PATH)
  const semanticBindingsPath = path.join(root, SEMANTIC_MEMBER_BINDINGS_PATH)

  for (const requiredPath of [gatePath, semanticBindingsPath]) {
    if (exists(requiredPath)) continue
    console.error(`${path.relative(root, requiredPath)} must exist`)
    process.exitCode = 1
    return
  }

  const vueBaseline = parseJson(path.join(root, VUE_BASELINE_PATH))
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
  const semanticMemberBindings = parseJson(semanticBindingsPath)
  const avaloniaBaselines = {
    avalonia: avaloniaBaseline,
    avaloniaThemes: avaloniaThemesBaseline,
    avaloniaIcons: avaloniaIconsBaseline,
  }
  const bindingErrors = validateSemanticMemberBindings({
    registry: semanticMemberBindings,
    vueBaseline,
    avaloniaBaselines,
  })
  if (bindingErrors.length > 0) {
    console.error('semantic member binding validation failed:')
    for (const error of bindingErrors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }
  const registry = buildRegistry({
    vueBaseline,
    avaloniaBaseline,
    avaloniaThemesBaseline,
    avaloniaIconsBaseline,
    gate,
    semanticMemberBindings,
  })
  const surfaceAudit = validateAvaloniaSurfaceRegistration({
    registry,
    avaloniaBaselines,
  })
  const errors = validateRegistry(registry, gate, { avaloniaBaselines })
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
      `contract-v2:check passed (${registry.contracts.length} contracts, ${registry.coverage.total} members; ` +
        `${surfaceAudit.stats.baselineTypes} Avalonia types/${surfaceAudit.stats.baselineSurfaces} public surfaces, ` +
        `${surfaceAudit.stats.mappedSurfaceStates} mapped-contract surface states, ` +
        `${surfaceAudit.stats.avaloniaOnlyTypes} avalonia-only types)`,
    )
    return
  }

  write(registryPath, output)
  console.log(
    `contract-v2:generate wrote ${CONTRACT_V2_REGISTRY_PATH} (${registry.contracts.length} contracts, ${registry.coverage.total} members; ` +
      `${surfaceAudit.stats.baselineTypes} Avalonia types/${surfaceAudit.stats.baselineSurfaces} public surfaces, ` +
      `${surfaceAudit.stats.mappedSurfaceStates} mapped-contract surface states, ` +
      `${surfaceAudit.stats.avaloniaOnlyTypes} avalonia-only types)`,
  )
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
