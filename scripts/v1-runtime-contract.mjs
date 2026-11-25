import { createHash } from 'node:crypto'

export const v1RuntimeSchema = 'fsusui.v1-runtime-contract.v1'

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    )
  }
  return value
}

export const contractDigest = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')

// Inspect declarations only. Never execute user-defined default factories or validators.
const defaultDescriptor = (value, ancestors = new Set()) => {
  if (value === undefined) return { kind: 'undefined' }
  if (value === null) return { kind: 'null' }
  if (typeof value === 'function')
    return { kind: 'factory', arity: value.length }
  if (typeof value === 'number') {
    return {
      kind: 'number',
      value: Number.isFinite(value)
        ? Object.is(value, -0)
          ? '-0'
          : value
        : String(value),
    }
  }
  if (['string', 'boolean', 'bigint'].includes(typeof value))
    return { kind: typeof value, value: String(value) }
  if (typeof value !== 'object')
    throw new Error(`Unsupported prop default: ${typeof value}`)
  if (ancestors.has(value)) throw new Error('Cyclic prop default')
  const next = new Set([...ancestors, value])
  if (Array.isArray(value))
    return {
      kind: 'array',
      value: value.map((item) => defaultDescriptor(item, next)),
    }
  if (value instanceof Date) return { kind: 'date', value: value.toISOString() }
  if (value instanceof RegExp)
    return { kind: 'regexp', source: value.source, flags: value.flags }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new Error('Unsupported prop default object prototype')
  return {
    kind: 'object',
    value: Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, defaultDescriptor(value[key], next)]),
    ),
  }
}

const runtimeType = (type) => {
  if (type == null) return null
  if (Array.isArray(type)) return type.map(runtimeType)
  if (typeof type !== 'function' || !type.name)
    throw new Error('Unresolved runtime prop type')
  return type.name
}

export function describeRuntimeProps(props) {
  if (props == null) return {}
  if (Array.isArray(props)) {
    if (props.some((name) => typeof name !== 'string'))
      throw new Error('Unresolved prop declaration name')
    return Object.fromEntries(
      [...new Set(props)].sort().map((name) => [name, null]),
    )
  }
  if (typeof props !== 'object') throw new Error('Unresolved props declaration')
  return Object.fromEntries(
    Object.keys(props)
      .sort()
      .map((name) => {
        const declaration = props[name]
        const options =
          declaration &&
          typeof declaration === 'object' &&
          !Array.isArray(declaration)
            ? declaration
            : { type: declaration }
        return [
          name,
          {
            type: runtimeType(options.type),
            required: Boolean(options.required),
            default: Object.hasOwn(options, 'default')
              ? defaultDescriptor(options.default)
              : { kind: 'absent' },
            validator: typeof options.validator === 'function',
          },
        ]
      }),
  )
}

export function describeRuntimeEmits(emits) {
  if (emits == null) return []
  if (!Array.isArray(emits) && typeof emits !== 'object')
    throw new Error('Unresolved emits declaration')
  const names = Array.isArray(emits) ? emits : Object.keys(emits)
  if (names.some((name) => typeof name !== 'string'))
    throw new Error('Unresolved emit declaration name')
  return [...new Set(names)].sort()
}

export function describeComponent(component, name) {
  if (!component || !['object', 'function'].includes(typeof component))
    throw new Error(`Missing component export: ${name}`)
  // These need explicit Vue option-merge semantics, not silently empty contracts.
  if (component.extends || component.mixins?.length)
    throw new Error(
      `Inherited component options require explicit inspection: ${name}`,
    )
  const props = describeRuntimeProps(component.props)
  return {
    propCount: Object.keys(props).length,
    propDigest: contractDigest(props),
    emits: describeRuntimeEmits(component.emits),
  }
}

export function describeInstaller(app) {
  return {
    components: Object.keys(app._context.components).sort(),
    directives: Object.keys(app._context.directives).sort(),
    globals: Object.fromEntries(
      Object.keys(app.config.globalProperties)
        .sort()
        .map((name) => [name, typeof app.config.globalProperties[name]]),
    ),
  }
}

export function describeExports(exports) {
  const entries = Object.fromEntries(
    Object.keys(exports)
      .sort()
      .map((name) => [name, typeof exports[name]]),
  )
  return { count: Object.keys(entries).length, digest: contractDigest(entries) }
}

export function describePackage(manifest) {
  // Version and release metadata may change. Import/peer/build contracts may not.
  const fields = [
    'main',
    'module',
    'types',
    'typings',
    'exports',
    'typesVersions',
    'style',
    'sideEffects',
    'peerDependencies',
    'peerDependenciesMeta',
    'engines',
  ]
  return Object.fromEntries(
    fields
      .filter((name) => Object.hasOwn(manifest, name))
      .map((name) => [name, manifest[name]]),
  )
}

export function compareRuntimeContract(baseline, candidate) {
  if (baseline.schema !== v1RuntimeSchema)
    throw new Error(
      `Unsupported V1 runtime contract schema: ${baseline.schema}`,
    )
  const failures = []
  for (const name of Object.keys(baseline.components)) {
    const expected = baseline.components[name]
    const actual = candidate.components[name]
    if (!actual) {
      failures.push(`${name}: component export missing`)
      continue
    }
    for (const field of ['propCount', 'emits', 'propDigest']) {
      if (contractDigest(actual[field]) !== contractDigest(expected[field]))
        failures.push(`${name}: ${field} changed`)
    }
  }
  for (const field of ['exports', 'installer', 'package']) {
    if (
      !Object.hasOwn(candidate, field) ||
      contractDigest(candidate[field]) !== contractDigest(baseline[field])
    )
      failures.push(`${field}: V1 contract changed`)
  }
  return failures
}
