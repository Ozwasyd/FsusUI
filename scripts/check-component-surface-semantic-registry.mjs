import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

const defaultRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const defaultRegistryPath =
  'spec/components/component-surface-semantic-registry.json'
const defaultSchemaPath =
  'spec/components/component-surface-semantic-registry.schema.json'
const constraintFields = [
  'geometry',
  'typography',
  'stateColor',
  'disabled',
  'motion',
  'surfaceCardMotif',
]
const exactScopes = {
  themes: new Set(['light', 'dark']),
  densities: new Set(['default', 'compact', 'touch']),
  devices: new Set(['desktop', 'mobile', 'touch']),
}
export class SemanticRegistryContractError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'SemanticRegistryContractError'
    this.code = code
  }
}

const fail = (code, message) => {
  throw new SemanticRegistryContractError(code, message)
}
const hasOwner = (owner) =>
  owner &&
  typeof owner.id === 'string' &&
  owner.id.length > 0 &&
  typeof owner.kind === 'string' &&
  owner.kind.length > 0
const sameOwner = (left, right) =>
  hasOwner(left) &&
  hasOwner(right) &&
  left.id === right.id &&
  left.kind === right.kind
const resolveInputPath = (root, inputPath) =>
  path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath)
const readJson = async (filePath, code) => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (error) {
    fail(code, `${filePath}: ${error.message}`)
  }
}

export const loadComponentSurfaceSemanticRegistry = async ({
  root = defaultRoot,
  registryPath = defaultRegistryPath,
  schemaPath = defaultSchemaPath,
} = {}) => ({
  registry: await readJson(
    resolveInputPath(root, registryPath),
    'registry-load-failed',
  ),
  schema: await readJson(
    resolveInputPath(root, schemaPath),
    'schema-load-failed',
  ),
})

const validateReviewPolicy = (
  policy,
  code = 'registry-review-policy-invalid',
) => {
  if (
    !policy ||
    policy.mode !== 'source-digest-required' ||
    policy.ownerReviewRequired !== true ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(policy.reviewAfter)
  ) {
    fail(code, 'review policy must be owner-reviewed and date-bounded')
  }
}
const validateScope = (scope) => {
  if (!scope || typeof scope !== 'object') {
    fail('registry-scope-not-exact', 'scope is required')
  }
  for (const [dimension, allowed] of Object.entries(exactScopes)) {
    const values = scope[dimension]
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      new Set(values).size !== values.length ||
      values.some((value) => !allowed.has(value))
    ) {
      fail('registry-scope-not-exact', `${dimension} must have exact values`)
    }
  }
}
const assertReferenceShape = (reference, code) => {
  if (
    !reference ||
    typeof reference !== 'object' ||
    Array.isArray(reference) ||
    Object.keys(reference).sort().join(',') !== 'path,pointer,sourceId' ||
    ['sourceId', 'path', 'pointer'].some(
      (field) =>
        typeof reference[field] !== 'string' || reference[field].length === 0,
    )
  ) {
    fail(code, 'canonical references contain only sourceId, path, and pointer')
  }
}
const markdownAnchors = (markdown) =>
  new Set(
    [...markdown.matchAll(/^#{1,6}\s+(.+)$/gmu)].map(
      ([, heading]) =>
        `#${heading
          .trim()
          .toLowerCase()
          .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
          .replace(/^-|-$/gu, '')}`,
    ),
  )
const resolveCanonicalPointer = (content, sourcePath, pointer) => {
  if (sourcePath.endsWith('.md')) return markdownAnchors(content).has(pointer)
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    return false
  }
  if (sourcePath === 'spec/tokens/tokens.json') {
    return (
      pointer.startsWith('/tokens/') &&
      parsed.tokens?.some(({ name }) => name === pointer.slice(8))
    )
  }
  if (sourcePath === 'spec/components/contracts/v1/vue-public-contracts.json') {
    return (
      pointer.startsWith('/components/') &&
      (parsed.contracts ?? []).some(({ id }) => id === pointer.slice(12))
    )
  }
  return false
}
const selectorIsDeclared = (source, selector) => {
  const classes = selector.match(
    /\.el-[\w-]+(?:__(?:[\w-]+))?(?:--(?:[\w-]+))?/gu,
  )
  if (!classes?.length) return false
  return classes.every((className) => {
    const match = /^\.el-([\w-]+?)(?:__([\w-]+))?(?:--([\w-]+))?$/u.exec(
      className,
    )
    if (!match) return false
    const [, block, element, modifier] = match
    const normalized = className.replace('.el-', '.#{$namespace}-')
    if (source.includes(normalized) || source.includes(className)) return true
    const ownsBlock =
      source.includes(`@include b(${block})`) ||
      source.includes(`@include section-shell(${block})`)
    const ownsElement =
      !element ||
      source.includes(`@include e(${element})`) ||
      source.includes(`@include e((${element},`) ||
      source.includes(`@include e((${element}))`)
    const ownsModifier =
      !modifier ||
      source.includes(`@include m(${modifier})`) ||
      source.includes(`@include m((${modifier},`) ||
      source.includes('@include m($size)')
    return ownsBlock && ownsElement && ownsModifier
  })
}
const expectedSchemaDefinitions = [
  'allowlistEntry',
  'canonicalReference',
  'constraints',
  'exception',
  'generated',
  'issueMapping',
  'owner',
  'reviewPolicy',
  'rule',
  'scope',
  'selector',
  'selectorOwnership',
  'sourceDigest',
  'sourceOwnership',
  'variant',
  'verificationPolicy',
  'viewport',
  'visualRequirement',
]
const sameMembers = (left, right) =>
  Array.isArray(left) &&
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
const typedSchemaNode = (node) => {
  if (
    !node ||
    !['type', '$ref', 'const', 'enum', 'anyOf', 'oneOf'].some(
      (field) => field in node,
    )
  ) {
    return false
  }
  if (node.type === 'array' && !typedSchemaNode(node.items)) return false
  return Object.values(node.properties ?? {}).every(typedSchemaNode)
}
const validateSchemaContract = (schema) => {
  const definitions = schema?.$defs ?? {}
  const closedDefinitions =
    sameMembers(Object.keys(definitions), expectedSchemaDefinitions) &&
    expectedSchemaDefinitions.every((name) => {
      const definition = definitions[name]
      return (
        definition?.type === 'object' &&
        definition.additionalProperties === false &&
        sameMembers(
          definition.required,
          Object.keys(definition.properties ?? {}),
        ) &&
        typedSchemaNode(definition)
      )
    })
  const canonicalArray = (node) =>
    node?.type === 'array' && node.items?.$ref === '#/$defs/canonicalReference'
  const constraintProperties = definitions.constraints?.properties ?? {}
  const constraintContract =
    sameMembers(Object.keys(constraintProperties), constraintFields) &&
    constraintFields.every((field) =>
      canonicalArray(constraintProperties[field]),
    )
  const issueContract = definitions.issueMapping?.properties?.issue

  const allowlistContract =
    schema?.properties?.allowlist?.type === 'array' &&
    schema.properties.allowlist.items?.$ref === '#/$defs/allowlistEntry'
  const visualContract = definitions.visualRequirement
  if (
    !schema ||
    schema.type !== 'object' ||
    schema.additionalProperties !== false ||
    !sameMembers(schema.required, Object.keys(schema.properties ?? {})) ||
    !schema.properties ||
    !closedDefinitions ||
    !constraintContract ||
    !allowlistContract ||
    issueContract?.type !== 'integer' ||
    issueContract.minimum !== 293 ||
    issueContract.maximum !== 310 ||
    !visualContract.required.includes('expectedSemanticEvidence') ||
    !canonicalArray(visualContract.properties.expectedSemanticEvidence) ||
    definitions.rule.properties.canonicalSources?.items?.$ref !==
      '#/$defs/canonicalReference' ||
    definitions.rule.properties.selectorOwnership?.$ref !==
      '#/$defs/selectorOwnership' ||
    definitions.rule.properties.sourceOwnership?.$ref !==
      '#/$defs/sourceOwnership'
  ) {
    fail(
      'registry-schema-contract-weak',
      'schema is not a closed typed contract',
    )
  }
}
const executeSchema = (schema, registry) => {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  let validate
  try {
    validate = ajv.compile(schema)
  } catch (error) {
    fail('registry-schema-contract-weak', error.message)
  }
  if (!validate(registry)) {
    fail(
      'registry-schema-invalid',
      ajv.errorsText(validate.errors, { separator: '; ' }),
    )
  }
}
const validateIssueMappings = (registry) => {
  if (
    !Array.isArray(registry.issueMappings) ||
    registry.issueMappings.some(
      (mapping) =>
        !mapping ||
        !Number.isInteger(mapping.issue) ||
        mapping.issue < 293 ||
        mapping.issue > 310 ||
        typeof mapping.errorId !== 'string' ||
        !mapping.errorId ||
        !Array.isArray(mapping.ruleIds) ||
        !mapping.ruleIds.length ||
        !Array.isArray(mapping.semanticRoles) ||
        !mapping.semanticRoles.length,
    )
  ) {
    fail('registry-issue-mapping-invalid', 'issue mappings are malformed')
  }
  const issues = registry.issueMappings.map(({ issue }) => issue)
  if (new Set(issues).size !== issues.length) {
    fail('registry-issue-mapping-invalid', 'issue mappings must be unique')
  }
  if (
    registry.schemaVersion ===
      'fsusui.component-surface-semantic-registry.v1' &&
    (issues.length !== 18 ||
      Array.from({ length: 18 }, (_, index) => 293 + index).some(
        (issue) => !issues.includes(issue),
      ))
  ) {
    fail(
      'registry-issue-mapping-mismatch',
      'complete v1 registries must cover issues 293 through 310 exactly once',
    )
  }
  const byId = new Map(registry.rules.map((rule) => [rule.id, rule]))
  for (const mapping of registry.issueMappings) {
    const mappedRules = mapping.ruleIds.map((id) => byId.get(id))
    if (
      mappedRules.some((rule) => !rule) ||
      new Set(mapping.ruleIds).size !== mapping.ruleIds.length ||
      new Set(mapping.semanticRoles).size !== mapping.semanticRoles.length ||
      mappedRules.some(
        (rule) => !mapping.semanticRoles.includes(rule.surfaceRole),
      ) ||
      mapping.semanticRoles.some(
        (role) =>
          !mappedRules.some((rule) => rule.surfaceRole === role) ||
          /[\\/]|(?:\.css|\.scss|\.vue|\.ts|\.md|\.json)$/u.test(role),
      )
    ) {
      fail(
        'registry-issue-mapping-mismatch',
        `issue #${mapping.issue} mismatch`,
      )
    }
  }
}

const slugifyComponentName = (name) =>
  name
    .replace(/^El/u, '')
    .replace(/([a-z\d])([A-Z])/gu, '$1-$2')
    .toLowerCase()

const implementationOwnershipNames = (rule) =>
  new Set(
    rule.sourceOwnership.sources.flatMap((source) => {
      const relative = source.path.split('/src/').at(-1)
      const segments = relative.split('/')
      const basename = segments.at(-1).replace(/\.scss$/u, '')
      const directory = segments.length > 1 ? segments[0] : basename
      const selector = source.pointer.startsWith('selector:')
        ? source.pointer.slice('selector:'.length)
        : ''
      const blocks =
        selector.match(/\.el-[\w-]+/gu)?.map((className) =>
          className
            .slice('.el-'.length)
            .replace(/__(?:[\w-]+)$/u, '')
            .replace(/--(?:[\w-]+)$/u, ''),
        ) ?? []
      return [basename, directory, ...blocks]
    }),
  )

const componentAuthorityMatches = (rule, contract, componentContracts) => {
  if (
    !contract ||
    contract.source?.kind !== 'component' ||
    typeof contract.source.module !== 'string' ||
    typeof contract.source.name !== 'string'
  ) {
    return false
  }
  const ruleComponent = rule.componentId.replace(/^web\./u, '')
  const contractComponent = contract.id.replace(/^component\.el-/u, '')
  const directContractId = `component.el-${ruleComponent}`
  if (componentContracts.has(directContractId)) {
    return contract.id === directContractId
  }
  const primaryOwnershipKeys = new Set(
    rule.selectorOwnership.selectors.map(
      ({ source }) => `${source.path}|${source.pointer}`,
    ),
  )
  const contractIdsForReferences = (references, requireElement = false) =>
    new Set(
      references.flatMap((reference) => {
        const selector = reference.pointer.startsWith('selector:')
          ? reference.pointer.slice('selector:'.length)
          : ''
        const pattern = requireElement
          ? /\.el-[\w-]+__[\w-]+/gu
          : /\.el-[\w-]+/gu
        return (selector.match(pattern) ?? [])
          .map((className) => {
            const block = className
              .slice('.el-'.length)
              .replace(/__[\w-]+$/u, '')
              .replace(/--[\w-]+$/u, '')
            return `component.el-${block}`
          })
          .filter((contractId) => componentContracts.has(contractId))
      }),
    )
  const consumerContractIds = contractIdsForReferences(
    rule.sourceOwnership.sources.filter(
      (reference) =>
        !primaryOwnershipKeys.has(`${reference.path}|${reference.pointer}`),
    ),
  )
  if (consumerContractIds.size) {
    return consumerContractIds.has(contract.id)
  }
  const exactBemContractIds = new Set(
    contractIdsForReferences(
      rule.selectorOwnership.selectors.map(({ source }) => source),
      true,
    ),
  )
  if (exactBemContractIds.size) {
    return exactBemContractIds.has(contract.id)
  }

  const contractNames = new Set([
    contractComponent,
    contract.source.module,
    slugifyComponentName(contract.source.name),
  ])
  const ownershipNames = implementationOwnershipNames(rule)
  return [...ownershipNames].some((name) =>
    [...contractNames].some((contractName) => name === contractName),
  )
}
const validateOverrides = ({ entries, category, registry, contents }) => {
  for (const entry of entries ?? []) {
    if (!hasOwner(entry.owner)) {
      fail(
        category === 'exception'
          ? 'registry-exception-owner-required'
          : 'registry-variant-owner-required',
        `${category} owner is required`,
      )
    }
    validateScope(entry.scope)
    validateReviewPolicy(entry.reviewPolicy)
    assertReferenceShape(entry.source, 'registry-rule-source-required')
    const entrySource = registry.sourceDigests[entry.source.sourceId]
    if (
      !entrySource ||
      entrySource.kind !== 'authority' ||
      entrySource.path !== entry.source.path ||
      !resolveCanonicalPointer(
        contents.get(entry.source.sourceId),
        entry.source.path,
        entry.source.pointer,
      )
    ) {
      fail(
        `registry-${category}-constraint-source-invalid`,
        `${category} source is not canonical authority`,
      )
    }
    for (const references of Object.values(entry.constraintOverrides ?? {})) {
      if (!Array.isArray(references)) {
        fail(
          `registry-${category}-constraint-invalid`,
          'override must be arrays',
        )
      }
      for (const reference of references) {
        assertReferenceShape(
          reference,
          `registry-${category}-constraint-invalid`,
        )
        const source = registry.sourceDigests[reference.sourceId]
        if (
          !source ||
          source.kind !== 'authority' ||
          source.path !== reference.path ||
          !resolveCanonicalPointer(
            contents.get(reference.sourceId),
            reference.path,
            reference.pointer,
          )
        ) {
          fail(
            `registry-${category}-constraint-source-invalid`,
            'override source is not canonical authority',
          )
        }
      }
    }
  }
}

const todayUtc = () => {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}
const permanentMarker = (value) =>
  /^(?:permanent|never|none|indefinite|forever|na|n\/a|tbd)$/iu.test(
    String(value).trim(),
  ) || /\bpermanent\b/iu.test(String(value))
const emptyTestPolicy = (value) =>
  /^(?:none|no test|no-tests?|n\/a)$/iu.test(String(value).trim())

const validateAllowlist = (registry) => {
  const entries = registry.allowlist ?? []
  if (
    !Array.isArray(entries) ||
    entries.some(
      (entry) =>
        entry === '*' || (typeof entry === 'string' && entry.includes('*')),
    )
  ) {
    fail('registry-unbounded-allowlist', 'wildcard allowlists are forbidden')
  }
  const byId = new Map(registry.rules.map((rule) => [rule.id, rule]))
  const seen = new Set()
  const today = todayUtc()
  for (const [index, entry] of entries.entries()) {
    const label = `allowlist[${index}]`
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      [
        'ruleId',
        'component',
        'part',
        'selector',
        'file',
        'reason',
        'testPolicy',
        'removalCondition',
      ].some(
        (field) =>
          typeof entry[field] !== 'string' || entry[field].length === 0,
      ) ||
      !hasOwner(entry.owner) ||
      typeof entry.reviewAfter !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(entry.reviewAfter)
    ) {
      fail(
        'registry-allowlist-entry-invalid',
        `${label} is missing a required governance field`,
      )
    }
    if (
      [entry.component, entry.part, entry.selector, entry.file].some((value) =>
        value.includes('*'),
      )
    ) {
      fail('registry-allowlist-broad-entry', `${label} uses a wildcard target`)
    }
    if (entry.reviewAfter < today) {
      fail('registry-allowlist-expired', `${label} review date has passed`)
    }
    if (permanentMarker(entry.removalCondition)) {
      fail(
        'registry-allowlist-permanent-exception',
        `${label} removal condition is permanent`,
      )
    }
    if (emptyTestPolicy(entry.testPolicy)) {
      fail(
        'registry-allowlist-test-policy-required',
        `${label} test policy is missing`,
      )
    }
    const rule = byId.get(entry.ruleId)
    if (!rule) {
      fail(
        'registry-allowlist-entry-invalid',
        `${label} ruleId does not resolve to a registry rule`,
      )
    }
    if (entry.component !== rule.componentId || entry.part !== rule.partId) {
      fail(
        'registry-allowlist-mismatch',
        `${label} component/part does not match ${rule.id}`,
      )
    }
    const owned = rule.selectorOwnership.selectors.find(
      (selector) =>
        selector.platform === 'web' && selector.selector === entry.selector,
    )
    if (!owned || owned.source.path !== entry.file) {
      fail(
        'registry-allowlist-mismatch',
        `${label} selector/file is not an owned implementation of ${rule.id}`,
      )
    }
    const key = [
      entry.ruleId,
      entry.component,
      entry.part,
      entry.selector,
      entry.file,
    ].join('|')
    if (seen.has(key)) {
      fail('registry-allowlist-duplicate', `${label} duplicates another entry`)
    }
    seen.add(key)
  }
}

export const validateComponentSurfaceSemanticRegistry = async ({
  registry,
  schema,
  root = defaultRoot,
  sourceOverrides = {},
}) => {
  validateSchemaContract(schema)
  if (!hasOwner(registry?.owner)) {
    fail('registry-root-field-required', 'registry owner is required')
  }
  validateReviewPolicy(registry.reviewPolicy)
  if (
    !registry.generated ||
    typeof registry.generated.producer !== 'string' ||
    !registry.generated.producer ||
    !/^[a-f0-9]{40}$/u.test(registry.generated.sourceRevision) ||
    registry.generated.digestAlgorithm !== 'sha256'
  ) {
    fail('registry-generated-invalid', 'generated metadata is invalid')
  }
  validateAllowlist(registry)
  const readPaths = []
  const parsedPaths = []
  const contents = new Map()
  for (const [sourceId, source] of Object.entries(
    registry.sourceDigests ?? {},
  )) {
    if (
      !source ||
      !['authority', 'implementation'].includes(source.kind) ||
      source.algorithm !== 'sha256' ||
      !/^[a-f0-9]{64}$/u.test(source.digest)
    ) {
      fail('registry-source-invalid', `${sourceId} has an invalid digest`)
    }
    const normalizedPath = path.normalize(source.path)
    const content =
      sourceOverrides[source.path] ??
      (await fs.readFile(path.join(root, normalizedPath), 'utf8'))
    readPaths.push(normalizedPath)
    contents.set(sourceId, content)
    if (createHash('sha256').update(content).digest('hex') !== source.digest) {
      fail('registry-source-digest-drift', `${sourceId} source digest drifted`)
    }
    if (!/\.(?:s?css)$/u.test(normalizedPath)) parsedPaths.push(normalizedPath)
  }
  const componentSourceEntry = Object.entries(registry.sourceDigests).find(
    ([, source]) =>
      source.kind === 'authority' &&
      source.path === 'spec/components/contracts/v1/vue-public-contracts.json',
  )
  const componentContracts = new Map(
    (
      JSON.parse(contents.get(componentSourceEntry?.[0]) ?? '{}').contracts ??
      []
    ).map((contract) => [contract.id, contract]),
  )
  const seen = new Set()
  for (const rule of registry.rules ?? []) {
    if (!hasOwner(rule.owner)) {
      fail('registry-rule-owner-required', `${rule.id}: owner is required`)
    }
    if (
      !Array.isArray(rule.canonicalSources) ||
      !rule.canonicalSources.length
    ) {
      fail('registry-rule-source-required', `${rule.id}: sources are required`)
    }
    if (typeof rule.surfaceRole !== 'string' || !rule.surfaceRole) {
      fail('registry-rule-role-required', `${rule.id}: role is required`)
    }
    if (
      !rule.surfaceRole.includes('.') ||
      rule.surfaceRole.includes('*') ||
      rule.surfaceRole.endsWith('.everything')
    ) {
      fail('registry-broad-role', `${rule.id}: role must be specific`)
    }
    if (!rule.verificationPolicy) {
      fail(
        'registry-verification-policy-required',
        `${rule.id}: verification policy is required`,
      )
    }
    if (!rule.id || !rule.componentId || !rule.partId || seen.has(rule.id)) {
      fail('registry-rule-identity-invalid', 'rule identity is invalid')
    }
    seen.add(rule.id)
    validateScope(rule.scope)
    const componentReferences = rule.canonicalSources.filter(
      ({ sourceId }) => sourceId === 'component-contracts',
    )
    if (!componentReferences.length) {
      fail(
        'registry-component-authority-required',
        `${rule.id}: component authority required`,
      )
    }
    for (const reference of componentReferences) {
      const contractId = reference.pointer.replace(/^\/components\//u, '')
      if (
        reference.path !==
          'spec/components/contracts/v1/vue-public-contracts.json' ||
        !componentAuthorityMatches(
          rule,
          componentContracts.get(contractId),
          componentContracts,
        )
      ) {
        fail(
          'registry-component-authority-mismatch',
          `${rule.id}: component authority mismatch`,
        )
      }
    }
    for (const reference of rule.canonicalSources) {
      assertReferenceShape(reference, 'registry-rule-source-required')
      const source = registry.sourceDigests[reference.sourceId]
      if (
        !source ||
        source.kind !== 'authority' ||
        source.path !== reference.path ||
        !resolveCanonicalPointer(
          contents.get(reference.sourceId),
          reference.path,
          reference.pointer,
        )
      ) {
        fail(
          'registry-canonical-pointer-unresolved',
          `${rule.id}: canonical pointer unresolved`,
        )
      }
    }
    for (const field of constraintFields) {
      const references = rule.constraints?.[field]
      if (!Array.isArray(references)) {
        fail('registry-constraint-required', `${rule.id}: ${field} required`)
      }
      for (const reference of references) {
        assertReferenceShape(reference, 'registry-duplicate-numeric-truth')
        const source = registry.sourceDigests[reference.sourceId]
        if (
          !source ||
          source.kind !== 'authority' ||
          source.path !== reference.path ||
          !resolveCanonicalPointer(
            contents.get(reference.sourceId),
            reference.path,
            reference.pointer,
          )
        ) {
          fail(
            'registry-canonical-pointer-unresolved',
            `${rule.id}: constraint pointer unresolved`,
          )
        }
      }
    }
    if (
      !sameOwner(rule.selectorOwnership?.owner, rule.owner) ||
      !Array.isArray(rule.selectorOwnership?.selectors) ||
      !rule.selectorOwnership.selectors.length
    ) {
      fail(
        'registry-selector-ownership-mismatch',
        `${rule.id}: selector owner mismatch`,
      )
    }
    const selectorKeys = new Set()
    for (const owned of rule.selectorOwnership.selectors) {
      const reference = owned.source
      const source = registry.sourceDigests[reference?.sourceId]
      if (
        owned.platform !== 'web' ||
        !source ||
        source.kind !== 'implementation' ||
        source.path !== reference.path
      ) {
        fail(
          'registry-selector-ownership-mismatch',
          `${rule.id}: selector source mismatch`,
        )
      }
      if (reference.pointer !== `selector:${owned.selector}`) {
        const pointedSelector = reference.pointer?.slice('selector:'.length)
        if (
          reference.pointer?.startsWith('selector:') &&
          selectorIsDeclared(contents.get(reference.sourceId), pointedSelector)
        ) {
          fail(
            'registry-selector-ownership-mismatch',
            `${rule.id}: selector belongs to a different implementation source`,
          )
        }
        fail(
          'registry-selector-pointer-unresolved',
          `${rule.id}: selector pointer does not identify the owned selector`,
        )
      }
      if (
        !selectorIsDeclared(contents.get(reference.sourceId), owned.selector)
      ) {
        fail(
          'registry-selector-pointer-unresolved',
          `${rule.id}: selector unresolved`,
        )
      }
      selectorKeys.add(`${reference.path}|${reference.pointer}`)
    }
    if (
      !sameOwner(rule.sourceOwnership?.owner, rule.owner) ||
      !Array.isArray(rule.sourceOwnership?.sources) ||
      !rule.sourceOwnership.sources.length ||
      !rule.sourceOwnership.sources.some((reference) =>
        selectorKeys.has(`${reference.path}|${reference.pointer}`),
      ) ||
      rule.sourceOwnership.sources.some((reference) => {
        const source = registry.sourceDigests[reference.sourceId]
        const selector = reference.pointer?.startsWith('selector:')
          ? reference.pointer.slice('selector:'.length)
          : ''
        return (
          !source ||
          source.kind !== 'implementation' ||
          source.path !== reference.path ||
          !selector ||
          !selectorIsDeclared(contents.get(reference.sourceId), selector)
        )
      })
    ) {
      fail(
        'registry-source-ownership-mismatch',
        `${rule.id}: source ownership mismatch`,
      )
    }
    validateOverrides({
      entries: rule.variants,
      category: 'variant',
      registry,
      contents,
    })
    validateOverrides({
      entries: rule.exceptions,
      category: 'exception',
      registry,
      contents,
    })
    const policy = rule.verificationPolicy
    if (
      !Array.isArray(policy.staticFields) ||
      !policy.staticFields.includes('stateColor') ||
      !Array.isArray(policy.visualProbeFields) ||
      policy.visualProbeFields.join(',') !== 'surfaceCardMotif' ||
      !Array.isArray(policy.visualRequirements) ||
      !policy.visualRequirements.length
    ) {
      fail(
        'registry-verification-policy-invalid',
        `${rule.id}: verification policy invalid`,
      )
    }
    for (const requirement of policy.visualRequirements) {
      if (
        !Array.isArray(requirement.expectedSemanticEvidence) ||
        !requirement.expectedSemanticEvidence.length
      ) {
        fail(
          'registry-visual-requirement-invalid',
          `${rule.id}: evidence missing`,
        )
      }
      for (const reference of requirement.expectedSemanticEvidence) {
        assertReferenceShape(reference, 'registry-visual-requirement-invalid')
        const source = registry.sourceDigests[reference.sourceId]
        if (
          !source ||
          source.kind !== 'authority' ||
          source.path !== reference.path ||
          !resolveCanonicalPointer(
            contents.get(reference.sourceId),
            reference.path,
            reference.pointer,
          )
        ) {
          fail(
            'registry-canonical-pointer-unresolved',
            `${rule.id}: visual evidence unresolved`,
          )
        }
      }
    }
  }
  validateIssueMappings(registry)
  executeSchema(schema, registry)
  return {
    violations: [],
    readPaths,
    parsedPaths,
    writePaths: [],
    executedCommands: [],
  }
}

const assertInventory = (registry, expectedInventory) => {
  if (!expectedInventory) return
  const fields = ['id', 'componentId', 'partId', 'surfaceRole']
  const actual = registry.rules.map((rule) =>
    Object.fromEntries(fields.map((field) => [field, rule[field]])),
  )
  const expected = expectedInventory.rules.map((rule) =>
    Object.fromEntries(fields.map((field) => [field, rule[field]])),
  )
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      'registry-production-inventory-mismatch',
      'production inventory drifted',
    )
  }
  const expectedByIssue = new Map(
    Array.from({ length: 18 }, (_, index) => 293 + index).map((issue) => [
      issue,
      expectedInventory.rules.filter((rule) => rule.issues.includes(issue)),
    ]),
  )
  if (
    registry.issueMappings.length !== expectedByIssue.size ||
    new Set(registry.issueMappings.map(({ issue }) => issue)).size !==
      expectedByIssue.size ||
    registry.issueMappings.some((mapping) => {
      const expectedRules = expectedByIssue.get(mapping.issue)
      return (
        !expectedRules ||
        JSON.stringify([...mapping.ruleIds].sort()) !==
          JSON.stringify(expectedRules.map(({ id }) => id).sort()) ||
        JSON.stringify([...mapping.semanticRoles].sort()) !==
          JSON.stringify(
            expectedRules.map(({ surfaceRole }) => surfaceRole).sort(),
          )
      )
    })
  ) {
    fail(
      'registry-issue-mapping-mismatch',
      'production issue mappings do not match the inventory',
    )
  }
}
const assertSemanticOwnership = (registry, contract) => {
  if (!contract) return 0
  const byId = new Map(registry.rules.map((rule) => [rule.id, rule]))
  let mismatches = 0
  for (const [id, authority, sourcePath, selector, profile] of contract.rules) {
    const rule = byId.get(id)
    const expectedConstraints = Object.fromEntries(
      constraintFields.map((field) => [
        field,
        (contract.constraintProfiles[profile][field] ?? []).map((encoded) => {
          const separator = encoded.indexOf(':')
          const sourceName = encoded.slice(0, separator)
          const pointer = encoded.slice(separator + 1)
          return {
            path: contract.authoritySources[sourceName],
            pointer,
          }
        }),
      ]),
    )
    if (
      !rule ||
      !rule.canonicalSources.some(
        ({ pointer }) => pointer === `/components/${authority}`,
      ) ||
      !rule.selectorOwnership.selectors.some(
        (owned) =>
          owned.selector === selector &&
          owned.source.path === sourcePath &&
          owned.source.pointer === `selector:${selector}`,
      ) ||
      constraintFields.some(
        (field) =>
          JSON.stringify(
            rule.constraints[field].map(({ path: valuePath, pointer }) => ({
              path: valuePath,
              pointer,
            })),
          ) !== JSON.stringify(expectedConstraints[field]),
      )
    ) {
      mismatches += 1
    }
  }
  if (mismatches) {
    fail(
      'registry-semantic-ownership-mismatch',
      `${mismatches} semantic ownership rules drifted`,
    )
  }
  return mismatches
}

export const checkComponentSurfaceSemanticRegistry = async (options = {}) => {
  const root = options.root ?? defaultRoot
  const assets = await loadComponentSurfaceSemanticRegistry({
    ...options,
    root,
  })
  const validation = await validateComponentSurfaceSemanticRegistry({
    ...assets,
    root,
    sourceOverrides: options.sourceOverrides,
  })
  assertInventory(assets.registry, options.expectedInventory)
  const semanticOwnershipMismatchCount = assertSemanticOwnership(
    assets.registry,
    options.expectedSemanticOwnership,
  )
  return {
    ...validation,
    ruleCount: assets.registry.rules.length,
    semanticRuleCount: assets.registry.rules.length,
    issueMappingCount: assets.registry.issueMappings.length,
    semanticOwnershipMismatchCount,
  }
}

export const refreshComponentSurfaceSemanticRegistrySourceDigests = async (
  options = {},
) => {
  const root = options.root ?? defaultRoot
  const registryPath = options.registryPath ?? defaultRegistryPath
  const assets = await loadComponentSurfaceSemanticRegistry({
    ...options,
    root,
  })
  validateSchemaContract(assets.schema)
  executeSchema(assets.schema, assets.registry)
  const registry = structuredClone(assets.registry)
  for (const source of Object.values(registry.sourceDigests)) {
    source.digest = createHash('sha256')
      .update(await fs.readFile(resolveInputPath(root, source.path)))
      .digest('hex')
  }
  registry.generated.producer =
    'scripts/check-component-surface-semantic-registry.mjs'
  registry.generated.sourceRevision = execFileSync(
    'git',
    ['rev-parse', 'HEAD'],
    { cwd: root, encoding: 'utf8' },
  ).trim()
  const validation = await validateComponentSurfaceSemanticRegistry({
    ...assets,
    registry,
    root,
  })
  assertInventory(registry, options.expectedInventory)
  assertSemanticOwnership(registry, options.expectedSemanticOwnership)
  const outputPath = resolveInputPath(root, registryPath)
  await fs.writeFile(outputPath, `${JSON.stringify(registry, null, 2)}\n`)
  return {
    ...validation,
    writePaths: [outputPath],
    executedCommands: ['git rev-parse HEAD'],
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (args.length) {
      if (
        args[0] !== '--refresh-source-digests' ||
        (args.length !== 1 && args.length !== 3) ||
        (args.length === 3 && args[1] !== '--registry')
      ) {
        throw new Error(
          'Usage: check-component-surface-semantic-registry.mjs [--refresh-source-digests [--registry path]]',
        )
      }
      const result = await refreshComponentSurfaceSemanticRegistrySourceDigests(
        {
          registryPath: args[2],
        },
      )
      process.stdout.write(
        `registry source digests refreshed: ${result.writePaths[0]}\n`,
      )
    } else {
      const result = await checkComponentSurfaceSemanticRegistry()
      process.stdout.write(
        `component surface semantic registry valid: ${result.ruleCount} rules, ${result.issueMappingCount} issue mappings\n`,
      )
    }
  } catch (error) {
    process.stderr.write(
      `${error.code ?? 'registry-check-failed'}: ${error.message}\n`,
    )
    process.exitCode = 1
  }
}
