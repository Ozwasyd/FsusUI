import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtureDirectory = path.join(
  root,
  'tests/fixtures/component-surface-semantic-registry',
)
const validRegistryPath = path.join(fixtureDirectory, 'valid-registry.json')
const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(fixtureDirectory, name), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))
const loadSubject = () =>
  import('../scripts/check-component-surface-semantic-registry.mjs')

const replaceAtPath = (value, pointer, replacement) => {
  const segments = pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
  const copy = clone(value)
  let parent = copy
  for (const segment of segments.slice(0, -1)) parent = parent[segment]
  parent[segments.at(-1)] = replacement
  return copy
}

const deleteAtPath = (value, pointer) => {
  const segments = pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
  const copy = clone(value)
  let parent = copy
  for (const segment of segments.slice(0, -1)) parent = parent[segment]
  delete parent[segments.at(-1)]
  return copy
}

const appendAtPath = (value, pointer, addition) => {
  const segments = pointer.split('/').slice(1)
  const copy = clone(value)
  let target = copy
  for (const segment of segments) target = target[segment]
  target.push(addition)
  return copy
}

const applyMutation = (registry, mutation) => {
  if (mutation.operation === 'replace') {
    return replaceAtPath(registry, mutation.path, mutation.value)
  }
  if (mutation.operation === 'delete') {
    return deleteAtPath(registry, mutation.path)
  }
  if (mutation.operation === 'append') {
    return appendAtPath(registry, mutation.path, mutation.value)
  }
  throw new Error(`Unknown fixture mutation ${mutation.operation}`)
}

const loadAssets = async () => {
  const subject = await loadSubject()
  const assets = await subject.loadComponentSurfaceSemanticRegistry({
    root,
    registryPath: validRegistryPath,
  })
  return { ...assets, subject }
}

const expectValidationRejected = async (
  subject,
  assets,
  registry,
  expectedCode,
  options = {},
) => {
  await assert.rejects(
    subject.validateComponentSurfaceSemanticRegistry({
      ...assets,
      registry,
      root,
      ...options,
    }),
    (error) =>
      error instanceof subject.SemanticRegistryContractError &&
      error.code === expectedCode,
  )
}

const expectRegistryRejected = async (registry, expectedCode, options = {}) => {
  const { subject, ...assets } = await loadAssets()
  await expectValidationRejected(
    subject,
    assets,
    registry,
    expectedCode,
    options,
  )
}

const contractReference = (contractId) => ({
  sourceId: 'component-contracts',
  path: 'spec/components/contracts/v1/vue-public-contracts.json',
  pointer: `/components/${contractId}`,
})

const assertClosedObjectSchema = (schema, label) => {
  assert.equal(schema.type, 'object', `${label}: type`)
  assert.equal(schema.additionalProperties, false, `${label}: closed`)
  assert(Array.isArray(schema.required) && schema.required.length > 0, label)
  assert.equal(typeof schema.properties, 'object', `${label}: properties`)
  assert.deepEqual(
    [...schema.required].sort(),
    Object.keys(schema.properties).sort(),
    `${label}: every property must be required`,
  )
}

const assertTypedSchema = (schema, label) => {
  assert(
    schema.type !== undefined ||
      schema.$ref !== undefined ||
      schema.const !== undefined ||
      schema.enum !== undefined ||
      schema.anyOf !== undefined ||
      schema.oneOf !== undefined,
    `${label}: missing type contract`,
  )
  if (schema.type === 'array') {
    assert.equal(typeof schema.items, 'object', `${label}: array items`)
  }
  for (const [property, propertySchema] of Object.entries(
    schema.properties ?? {},
  )) {
    assertTypedSchema(propertySchema, `${label}.${property}`)
  }
}

const selectorIsDeclared = (source, selector) =>
  selector
    .match(/\.el-[\w-]+(?:__(?:[\w-]+))?(?:--(?:[\w-]+))?/gu)
    .every((className) => {
      const bem = /^\.el-([\w-]+?)(?:__([\w-]+))?(?:--([\w-]+))?$/u.exec(
        className,
      )
      const [, block, element, modifier] = bem
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

const authorityPointerExists = (contract, sourceName, pointer) => {
  const sourcePath = contract.authoritySources[sourceName]
  const source = fs.readFileSync(path.join(root, sourcePath), 'utf8')
  if (sourceName === 'tokens') {
    const tokenName = pointer.replace('/tokens/', '')
    return JSON.parse(source).tokens.some(({ name }) => name === tokenName)
  }
  if (sourceName === 'components') {
    const componentId = pointer.replace('/components/', '')
    return JSON.parse(source).contracts.some(({ id }) => id === componentId)
  }
  const anchors = source
    .split('\n')
    .filter((line) => /^#{1,6}\s/u.test(line))
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/u, '')
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-|-$/gu, ''),
    )
  return anchors.includes(pointer.replace(/^#/u, ''))
}

test('T400-00 acceptance mapping freezes all issue requirements and test boundaries', () => {
  const mapping = readJson('acceptance-mapping.json')
  assert.deepEqual(
    mapping.acceptanceCriteria.map(({ id }) => id),
    [
      'T400-01',
      'T400-02',
      'T400-03',
      'T400-04',
      'T400-05',
      'T400-06',
      'T400-07',
      'T400-08',
      'T400-09',
      'T400-10',
      'T400-11',
      'T400-12',
      'T400-13',
      'T400-14',
      'T400-15',
    ],
  )
  assert.deepEqual(
    mapping.issueCoverage.map(({ issue }) => issue),
    Array.from({ length: 18 }, (_, index) => 293 + index),
  )
  assert.equal(mapping.expectedRuleCount, 45)
  const inventory = readJson('production-rule-inventory.json')
  assert.equal(inventory.expectedRuleCount, 45)
  assert.equal(inventory.rules.length, 45)
  const validRegistry = readJson('valid-registry.json')
  assert.equal(validRegistry.issueMappings.length, 18)
  assert.deepEqual(
    validRegistry.issueMappings.map(({ issue }) => issue),
    Array.from({ length: 18 }, (_, index) => 293 + index),
  )
  assert.deepEqual(
    [...new Set(validRegistry.rules.flatMap(({ issues }) => issues))].sort(
      (left, right) => left - right,
    ),
    Array.from({ length: 18 }, (_, index) => 293 + index),
  )
  assert.deepEqual(mapping.productionTargets, [
    'spec/components/component-surface-semantic-registry.json',
    'spec/components/component-surface-semantic-registry.schema.json',
    'scripts/check-component-surface-semantic-registry.mjs',
  ])
  assert.deepEqual(mapping.outOfScope.pathGlobs, [
    '**/*.css',
    '**/*.scss',
    '.github/**',
  ])
  assert.deepEqual(mapping.outOfScope.commands, [
    'pnpm run verify:visual:affected',
    'pnpm run test:visual',
  ])
})

test('T400-01 validates stable component/part identities and separates row roles from panel roots', async () => {
  const { registry, subject, ...assets } = await loadAssets()
  await assert.doesNotReject(
    subject.validateComponentSurfaceSemanticRegistry({
      registry,
      ...assets,
      root,
    }),
  )

  const byId = new Map(registry.rules.map((rule) => [rule.id, rule]))
  assert.equal(
    byId.get('web.select.option-row').surfaceRole,
    'overlay.option-row',
  )
  assert.equal(
    byId.get('web.dialog.overlay-root').surfaceRole,
    'overlay.dialog-root',
  )
  assert.equal(
    byId.get('web.tree.tree-row').surfaceRole,
    'data-region.tree-node-row',
  )
  assert.equal(
    byId.get('web.date-picker.date-cell').surfaceRole,
    'data-region.date-time-cell',
  )
  assert.notEqual(
    byId.get('web.select.option-row').surfaceRole,
    byId.get('web.dialog.overlay-root').surfaceRole,
  )
})

test('T400-02 traces every constraint to spec, design, token, and component contracts without literals', async () => {
  const { registry, subject, ...assets } = await loadAssets()
  const result = await subject.validateComponentSurfaceSemanticRegistry({
    registry,
    ...assets,
    root,
  })
  assert.deepEqual(result.violations, [])
  assert.equal(
    registry.schemaVersion,
    'fsusui.component-surface-semantic-registry.v1',
  )
  assert.match(registry.registryVersion, /^\d+\.\d+\.\d+$/u)
  assert.equal(registry.owner.kind, 'specification')
  assert.equal(registry.reviewPolicy.ownerReviewRequired, true)
  assert.equal(registry.generated.digestAlgorithm, 'sha256')
  assert.match(registry.generated.sourceRevision, /^[a-f0-9]{40}$/u)

  for (const rule of registry.rules) {
    const canonicalIds = new Set(
      rule.canonicalSources.map(({ sourceId }) => sourceId),
    )
    for (const requiredId of [
      'design-contract',
      'token-contract',
      'component-contracts',
    ]) {
      assert(canonicalIds.has(requiredId), `${rule.id}: ${requiredId}`)
    }
    assert(
      rule.sourceOwnership.sources.every(
        ({ sourceId }) =>
          registry.sourceDigests[sourceId].kind === 'implementation',
      ),
      rule.id,
    )
    for (const references of Object.values(rule.constraints)) {
      for (const reference of references) {
        assert.deepEqual(Object.keys(reference).sort(), [
          'path',
          'pointer',
          'sourceId',
        ])
        assert.equal(
          registry.sourceDigests[reference.sourceId].kind,
          'authority',
          rule.id,
        )
      }
    }
    assert(rule.verificationPolicy.staticFields.includes('stateColor'))
    assert.deepEqual(rule.verificationPolicy.visualProbeFields, [
      'surfaceCardMotif',
    ])
    assert(rule.verificationPolicy.visualRequirements.length > 0)
  }

  await expectRegistryRejected(
    replaceAtPath(
      registry,
      '/rules/0/constraints/geometry/0/pointer',
      '/tokens/not-a-canonical-token',
    ),
    'registry-canonical-pointer-unresolved',
  )
})

test('T400-03 fails closed when a canonical source digest drifts', async () => {
  const registry = readJson('valid-registry.json')
  const designPath = path.join(root, 'docs/design.md')
  await expectRegistryRejected(registry, 'registry-source-digest-drift', {
    sourceOverrides: {
      'docs/design.md': `${fs.readFileSync(designPath, 'utf8')}\ncanonical drift`,
    },
  })
})

test('T400-04 rejects entries missing owner, source, role, or verification policy', async () => {
  const registry = readJson('valid-registry.json')
  for (const [pointer, expectedCode] of [
    ['/rules/0/owner', 'registry-rule-owner-required'],
    ['/rules/0/canonicalSources', 'registry-rule-source-required'],
    ['/rules/0/surfaceRole', 'registry-rule-role-required'],
    ['/rules/0/verificationPolicy', 'registry-verification-policy-required'],
  ]) {
    await expectRegistryRejected(deleteAtPath(registry, pointer), expectedCode)
  }
})

test('T400-05 kills duplicate numeric truth, broad roles, and unowned exceptions', async () => {
  const registry = readJson('valid-registry.json')
  for (const mutation of readJson('mutations.json')) {
    await expectRegistryRejected(
      applyMutation(registry, mutation),
      mutation.expectedCode,
    )
  }
})

test('T400-06 rejects wildcard allowlists and keeps exact variant/exception scopes owned', async () => {
  const registry = readJson('valid-registry.json')
  await expectRegistryRejected(
    { ...registry, allowlist: ['*'] },
    'registry-unbounded-allowlist',
  )
  await expectRegistryRejected(
    appendAtPath(registry, '/rules/0/variants', {
      id: 'touch',
      owner: { id: 'fsusui.web.vue', kind: 'implementation' },
      source: {
        sourceId: 'design-contract',
        path: 'docs/design.md',
        pointer: '#density',
      },
      scope: {
        themes: ['*'],
        densities: ['touch'],
        devices: ['touch'],
      },
      constraintOverrides: {},
      reviewPolicy: registry.reviewPolicy,
    }),
    'registry-scope-not-exact',
  )
})

test('T400-07 maps every confirmed #293-#310 error to semantic roles rather than filenames', async () => {
  const inventory = readJson('production-rule-inventory.json')
  assert.equal(inventory.rules.length, inventory.expectedRuleCount)
  assert.equal(new Set(inventory.rules.map(({ id }) => id)).size, 45)
  assert.deepEqual(
    [...new Set(inventory.rules.flatMap(({ issues }) => issues))].sort(
      (left, right) => left - right,
    ),
    Array.from({ length: 18 }, (_, index) => 293 + index),
  )
  for (const rule of inventory.rules) {
    assert(
      rule.surfaceRole.includes('.') &&
        !rule.surfaceRole.includes('*') &&
        !/\.(?:css|scss|vue|ts)$/u.test(rule.surfaceRole),
      rule.id,
    )
  }
  const { subject } = await loadAssets()
  const result = await subject.checkComponentSurfaceSemanticRegistry({
    root,
    expectedInventory: inventory,
  })
  assert.equal(result.ruleCount, 45)
  assert.equal(result.issueMappingCount, 18)
})

test('T400-08 keeps the validator data-only: no Sass/CSS parsing, visual execution, CI binding, or CSS rewrites', async () => {
  const { registry, subject, ...assets } = await loadAssets()
  const result = await subject.validateComponentSurfaceSemanticRegistry({
    registry,
    ...assets,
    root,
  })
  assert.deepEqual(
    result.readPaths.sort(),
    [
      ...new Set(
        Object.values(registry.sourceDigests).map(({ path: sourcePath }) =>
          path.normalize(sourcePath),
        ),
      ),
    ].sort(),
  )
  assert(
    result.parsedPaths.every((sourcePath) => !/\.(?:s?css)$/u.test(sourcePath)),
  )
  assert.deepEqual(result.writePaths, [])
  assert.deepEqual(result.executedCommands, [])
  const checkerSource = fs.readFileSync(
    path.join(root, 'scripts/check-component-surface-semantic-registry.mjs'),
    'utf8',
  )
  assert.doesNotMatch(
    checkerSource,
    /['"`](?:#[\da-f]{3,8}|\d+(?:\.\d+)?(?:px|ms))['"`]/iu,
  )
})

test('T400-09 closes every nested schema structure instead of accepting bare objects or arrays', async () => {
  const { schema } = await loadAssets()
  assertClosedObjectSchema(schema, 'root')
  const expectedDefinitions = [
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
  assert.deepEqual(Object.keys(schema.$defs).sort(), expectedDefinitions.sort())
  for (const definition of expectedDefinitions) {
    assertClosedObjectSchema(schema.$defs[definition], `$defs.${definition}`)
    assertTypedSchema(schema.$defs[definition], `$defs.${definition}`)
  }
  for (const [property, definition] of [
    ['owner', 'owner'],
    ['reviewPolicy', 'reviewPolicy'],
    ['generated', 'generated'],
  ]) {
    assert.equal(schema.properties[property].$ref, `#/$defs/${definition}`)
  }
  assert.deepEqual(Object.keys(schema.$defs.constraints.properties).sort(), [
    'disabled',
    'geometry',
    'motion',
    'stateColor',
    'surfaceCardMotif',
    'typography',
  ])
  assert.equal(
    schema.$defs.variant.properties.constraintOverrides.additionalProperties,
    false,
  )
  assert.equal(
    schema.$defs.exception.properties.constraintOverrides.additionalProperties,
    false,
  )
  assert.equal(
    schema.$defs.rule.properties.variants.items.$ref,
    '#/$defs/variant',
  )
  assert.equal(
    schema.$defs.rule.properties.exceptions.items.$ref,
    '#/$defs/exception',
  )
  assert.equal(
    schema.$defs.verificationPolicy.properties.visualRequirements.items.$ref,
    '#/$defs/visualRequirement',
  )
  assert.equal(
    schema.$defs.visualRequirement.properties.expectedSemanticEvidence.items
      .$ref,
    '#/$defs/canonicalReference',
  )
})

test('T400-10 executes the supplied JSON Schema and rejects weak schema substitution', async () => {
  const registry = readJson('valid-registry.json')
  const { subject, schema, ...assets } = await loadAssets()
  const impossibleSchema = clone(schema)
  impossibleSchema.required.push('schemaExecutionProbe')
  impossibleSchema.properties.schemaExecutionProbe = { const: true }
  await assert.rejects(
    subject.validateComponentSurfaceSemanticRegistry({
      ...assets,
      registry,
      schema: impossibleSchema,
      root,
    }),
    (error) =>
      error instanceof subject.SemanticRegistryContractError &&
      error.code === 'registry-schema-invalid',
  )
  await assert.rejects(
    subject.validateComponentSurfaceSemanticRegistry({
      ...assets,
      registry,
      schema: { $id: schema.$id },
      root,
    }),
    (error) =>
      error instanceof subject.SemanticRegistryContractError &&
      error.code === 'registry-schema-contract-weak',
  )

  const weakSchemas = []
  const openOwnerSchema = clone(schema)
  openOwnerSchema.$defs.owner.additionalProperties = true
  weakSchemas.push(openOwnerSchema)

  const ownerWithoutIdSchema = clone(schema)
  ownerWithoutIdSchema.$defs.owner.required =
    ownerWithoutIdSchema.$defs.owner.required.filter(
      (property) => property !== 'id',
    )
  weakSchemas.push(ownerWithoutIdSchema)

  const openRuleSchema = clone(schema)
  openRuleSchema.$defs.rule.additionalProperties = true
  weakSchemas.push(openRuleSchema)

  const untypedReferenceArraysSchema = clone(schema)
  untypedReferenceArraysSchema.$defs.constraints.properties.geometry.items = {}
  untypedReferenceArraysSchema.$defs.rule.properties.canonicalSources.items = {}
  weakSchemas.push(untypedReferenceArraysSchema)

  const unboundedIssueSchema = clone(schema)
  delete unboundedIssueSchema.$defs.issueMapping.properties.issue.maximum
  weakSchemas.push(unboundedIssueSchema)

  const visualEvidenceOptionalSchema = clone(schema)
  visualEvidenceOptionalSchema.$defs.visualRequirement.required =
    visualEvidenceOptionalSchema.$defs.visualRequirement.required.filter(
      (property) => property !== 'expectedSemanticEvidence',
    )
  weakSchemas.push(visualEvidenceOptionalSchema)

  for (const weakSchema of weakSchemas) {
    await assert.rejects(
      subject.validateComponentSurfaceSemanticRegistry({
        ...assets,
        registry,
        schema: weakSchema,
        root,
      }),
      (error) =>
        error instanceof subject.SemanticRegistryContractError &&
        error.code === 'registry-schema-contract-weak',
    )
  }
})

test('T400-11 rejects malformed root policy, generated metadata, and garbage issue mappings', async () => {
  const registry = readJson('valid-registry.json')
  await expectRegistryRejected(
    replaceAtPath(registry, '/reviewPolicy', {
      mode: 'trust-me',
      ownerReviewRequired: 'yes',
    }),
    'registry-review-policy-invalid',
  )
  await expectRegistryRejected(
    replaceAtPath(registry, '/generated', {
      producer: '',
      sourceRevision: 'main',
      digestAlgorithm: 'md5',
    }),
    'registry-generated-invalid',
  )
  await expectRegistryRejected(
    replaceAtPath(registry, '/issueMappings', [{ garbage: true }]),
    'registry-issue-mapping-invalid',
  )
  await expectRegistryRejected(
    replaceAtPath(registry, '/issueMappings/0/issue', 999),
    'registry-issue-mapping-invalid',
  )
  await expectRegistryRejected(
    replaceAtPath(registry, '/issueMappings/0', {
      issue: 293,
      errorId: 'option-row-cardification',
      ruleIds: ['web.dialog.overlay-root'],
      semanticRoles: ['vue/packages/theme-chalk/src/dialog.scss'],
    }),
    'registry-issue-mapping-mismatch',
  )

  const { subject } = await loadAssets()
  const productionAssets = await subject.loadComponentSurfaceSemanticRegistry({
    root,
  })
  assert.equal(productionAssets.registry.issueMappings.length, 18)
  assert.deepEqual(
    productionAssets.registry.issueMappings
      .map(({ issue }) => issue)
      .sort((left, right) => left - right),
    Array.from({ length: 18 }, (_, index) => 293 + index),
  )
  await expectValidationRejected(
    subject,
    productionAssets,
    {
      ...productionAssets.registry,
      issueMappings: productionAssets.registry.issueMappings.filter(
        ({ issue }) => issue !== 310,
      ),
    },
    'registry-issue-mapping-mismatch',
  )
  const extensionRule = clone(productionAssets.registry.rules[0])
  extensionRule.id = `${extensionRule.componentId}.extension-probe-row`
  extensionRule.partId = 'extension-probe-row'
  extensionRule.surfaceRole = 'overlay.extension-probe-row'
  extensionRule.issues = [293]
  extensionRule.verificationPolicy.visualRequirements =
    extensionRule.verificationPolicy.visualRequirements.map((requirement) => ({
      ...requirement,
      id: `${requirement.id}.extension-probe`,
    }))
  const extendedMappings = productionAssets.registry.issueMappings.map(
    (mapping) =>
      mapping.issue === 293
        ? {
            ...mapping,
            ruleIds: [...mapping.ruleIds, extensionRule.id],
            semanticRoles: [
              ...mapping.semanticRoles,
              extensionRule.surfaceRole,
            ],
          }
        : mapping,
  )
  const extendedRegistry = {
    ...productionAssets.registry,
    rules: [...productionAssets.registry.rules, extensionRule],
    issueMappings: extendedMappings,
  }
  assert.equal(extendedRegistry.rules.length, 46)
  await assert.doesNotReject(
    subject.validateComponentSurfaceSemanticRegistry({
      ...productionAssets,
      registry: extendedRegistry,
      root,
    }),
  )
  await expectValidationRejected(
    subject,
    productionAssets,
    {
      ...extendedRegistry,
      issueMappings: extendedMappings.filter(({ issue }) => issue !== 310),
    },
    'registry-issue-mapping-mismatch',
  )
  const issue293 = productionAssets.registry.issueMappings.find(
    ({ issue }) => issue === 293,
  )
  await expectValidationRejected(
    subject,
    productionAssets,
    {
      ...productionAssets.registry,
      issueMappings: [
        ...productionAssets.registry.issueMappings,
        clone(issue293),
      ],
    },
    'registry-issue-mapping-invalid',
  )
})

test('T400-12 rejects missing or wrong component authority and fake selector ownership', async () => {
  const registry = readJson('valid-registry.json')
  await expectRegistryRejected(
    replaceAtPath(
      registry,
      '/rules/0/canonicalSources',
      registry.rules[0].canonicalSources.filter(
        ({ sourceId }) => sourceId !== 'component-contracts',
      ),
    ),
    'registry-component-authority-required',
  )
  await expectRegistryRejected(
    replaceAtPath(
      registry,
      '/rules/0/canonicalSources/2',
      contractReference('component.el-button'),
    ),
    'registry-component-authority-mismatch',
  )
  await expectRegistryRejected(
    replaceAtPath(
      registry,
      '/rules/0/selectorOwnership/owner/id',
      'fsusui.web.unrelated',
    ),
    'registry-selector-ownership-mismatch',
  )
  await expectRegistryRejected(
    replaceAtPath(
      registry,
      '/rules/0/selectorOwnership/selectors/0/source/pointer',
      'selector:.el-select-dropdown__item-decoy',
    ),
    'registry-selector-pointer-unresolved',
  )
  await expectRegistryRejected(
    replaceAtPath(registry, '/rules/0/selectorOwnership/selectors/0/source', {
      sourceId: 'implementation-tree',
      path: 'vue/packages/theme-chalk/src/tree.scss',
      pointer: 'selector:.el-tree-node__content',
    }),
    'registry-selector-ownership-mismatch',
  )
  await expectRegistryRejected(
    replaceAtPath(
      registry,
      '/rules/0/sourceOwnership/sources/0/pointer',
      'selector:.el-select-dropdown__item-decoy',
    ),
    'registry-source-ownership-mismatch',
  )

  const { subject } = await loadAssets()
  const productionAssets = await subject.loadComponentSurfaceSemanticRegistry({
    root,
  })
  const directComponentRules = productionAssets.registry.rules.filter((rule) =>
    rule.canonicalSources.some(
      ({ path: canonicalPath, pointer }) =>
        canonicalPath ===
          'spec/components/contracts/v1/vue-public-contracts.json' &&
        pointer.startsWith('/components/component.'),
    ),
  )
  assert(directComponentRules.length >= 30)
  for (const requiredFamily of [
    'web.loading.',
    'web.rate.',
    'web.menu.',
    'web.segmented-control.',
    'web.metric-primitives.',
    'web.public-shell.',
  ]) {
    assert(
      directComponentRules.some(({ id }) => id.startsWith(requiredFamily)),
      requiredFamily,
    )
  }
  for (const directRule of directComponentRules) {
    const mutatedRegistry = clone(productionAssets.registry)
    const mutatedRule = mutatedRegistry.rules.find(
      ({ id }) => id === directRule.id,
    )
    const componentReferenceIndex = mutatedRule.canonicalSources.findIndex(
      ({ path: canonicalPath, pointer }) =>
        canonicalPath ===
          'spec/components/contracts/v1/vue-public-contracts.json' &&
        pointer.startsWith('/components/component.'),
    )
    mutatedRule.canonicalSources[componentReferenceIndex] = {
      ...mutatedRule.canonicalSources[componentReferenceIndex],
      pointer: '/components/component.el-button',
    }
    await expectValidationRejected(
      subject,
      productionAssets,
      mutatedRegistry,
      'registry-component-authority-mismatch',
    )
  }

  const expectProductionComponentAuthorityRejected = async (
    ruleId,
    incorrectComponentId,
  ) => {
    const mutatedRegistry = clone(productionAssets.registry)
    const mutatedRule = mutatedRegistry.rules.find(({ id }) => id === ruleId)
    assert(mutatedRule, ruleId)
    const componentReferenceIndex = mutatedRule.canonicalSources.findIndex(
      ({ path: canonicalPath, pointer }) =>
        canonicalPath ===
          'spec/components/contracts/v1/vue-public-contracts.json' &&
        pointer.startsWith('/components/component.'),
    )
    assert.notEqual(componentReferenceIndex, -1, ruleId)
    mutatedRule.canonicalSources[componentReferenceIndex] = {
      ...mutatedRule.canonicalSources[componentReferenceIndex],
      pointer: `/components/${incorrectComponentId}`,
    }
    await expectValidationRejected(
      subject,
      productionAssets,
      mutatedRegistry,
      'registry-component-authority-mismatch',
    )
  }

  await expectProductionComponentAuthorityRejected(
    'web.menu.vertical-item',
    'component.el-menu-item',
  )

  const metricLabel = productionAssets.registry.rules.find(
    ({ id }) => id === 'web.metric-primitives.label',
  )
  assert(
    metricLabel.selectorOwnership.selectors.some(({ selector }) =>
      selector.startsWith('.el-metric-item'),
    ),
    'metric label must expose its exact BEM ownership block',
  )
  await expectProductionComponentAuthorityRejected(
    metricLabel.id,
    'component.el-metric-list',
  )

  await expectProductionComponentAuthorityRejected(
    'web.motion.control-transition',
    'component.el-rate',
  )
  await expectProductionComponentAuthorityRejected(
    'web.motion.list-enter-from',
    'component.el-input-number',
  )
})

test('T400-13 rejects dotted broad roles, invalid owned exceptions, and unresolved visual evidence', async () => {
  const registry = readJson('valid-registry.json')
  await expectRegistryRejected(
    replaceAtPath(registry, '/rules/0/surfaceRole', 'overlay.everything'),
    'registry-broad-role',
  )
  await expectRegistryRejected(
    appendAtPath(registry, '/rules/0/exceptions', {
      id: 'owned-but-unbounded',
      owner: { id: 'fsusui.web.vue', kind: 'implementation' },
      source: {
        sourceId: 'design-contract',
        path: 'docs/design.md',
        pointer: '#surface-taxonomy',
      },
      scope: {
        themes: ['light'],
        densities: ['default'],
        devices: ['desktop'],
      },
      constraintOverrides: { geometry: [{ literal: '999px' }] },
      reviewPolicy: registry.reviewPolicy,
    }),
    'registry-exception-constraint-invalid',
  )
  await expectRegistryRejected(
    appendAtPath(registry, '/rules/0/exceptions', {
      id: 'owned-but-fake-source',
      owner: { id: 'fsusui.web.vue', kind: 'implementation' },
      source: {
        sourceId: 'design-contract',
        path: 'docs/design.md',
        pointer: '#surface-taxonomy',
      },
      scope: {
        themes: ['dark'],
        densities: ['compact'],
        devices: ['mobile'],
      },
      constraintOverrides: {
        geometry: [
          {
            sourceId: 'fake-authority',
            path: 'docs/design.md',
            pointer: '#density',
          },
        ],
      },
      reviewPolicy: registry.reviewPolicy,
    }),
    'registry-exception-constraint-source-invalid',
  )
  await expectRegistryRejected(
    appendAtPath(registry, '/rules/0/variants', {
      id: 'owned-but-literal',
      owner: { id: 'fsusui.web.vue', kind: 'implementation' },
      source: {
        sourceId: 'design-contract',
        path: 'docs/design.md',
        pointer: '#density',
      },
      scope: {
        themes: ['dark'],
        densities: ['compact'],
        devices: ['mobile'],
      },
      constraintOverrides: { geometry: [{ literal: '999px' }] },
      reviewPolicy: registry.reviewPolicy,
    }),
    'registry-variant-constraint-invalid',
  )
  await expectRegistryRejected(
    appendAtPath(registry, '/rules/0/variants', {
      id: 'owned-but-fake-source',
      owner: { id: 'fsusui.web.vue', kind: 'implementation' },
      source: {
        sourceId: 'design-contract',
        path: 'docs/design.md',
        pointer: '#density',
      },
      scope: {
        themes: ['dark'],
        densities: ['compact'],
        devices: ['mobile'],
      },
      constraintOverrides: {
        geometry: [
          {
            sourceId: 'fake-authority',
            path: 'docs/design.md',
            pointer: '#density',
          },
        ],
      },
      reviewPolicy: registry.reviewPolicy,
    }),
    'registry-variant-constraint-source-invalid',
  )
  await expectRegistryRejected(
    replaceAtPath(
      registry,
      '/rules/0/verificationPolicy/visualRequirements/0/expectedSemanticEvidence/0/pointer',
      '#not-a-real-authority-anchor',
    ),
    'registry-canonical-pointer-unresolved',
  )
})

test('T400-14 self-validates the 45-rule semantic ownership contract against real authorities and selectors', () => {
  const contract = readJson('semantic-ownership-contract.json')
  const inventory = readJson('production-rule-inventory.json')
  const componentContracts = readJson(
    '../../../spec/components/contracts/v1/vue-public-contracts.json',
  )
  const componentIds = new Set(componentContracts.contracts.map(({ id }) => id))
  const inventoryIds = inventory.rules.map(({ id }) => id)
  assert.equal(contract.expectedRuleCount, 45)
  assert.equal(contract.rules.length, 45)
  assert.deepEqual(
    contract.rules.map(([id]) => id).sort(),
    [...inventoryIds].sort(),
  )
  assert.equal(new Set(contract.rules.map(([id]) => id)).size, 45)
  for (const [
    id,
    componentContractId,
    sourcePath,
    selector,
    constraintProfile,
  ] of contract.rules) {
    assert(componentIds.has(componentContractId), `${id}: component authority`)
    assert(
      selectorIsDeclared(
        fs.readFileSync(path.join(root, sourcePath), 'utf8'),
        selector,
      ),
      `${id}: ${selector} in ${sourcePath}`,
    )
    const constraints = contract.constraintProfiles[constraintProfile]
    assert(constraints, `${id}: ${constraintProfile}`)
    for (const references of Object.values(constraints)) {
      for (const encodedReference of references) {
        const separator = encodedReference.indexOf(':')
        const source = encodedReference.slice(0, separator)
        const pointer = encodedReference.slice(separator + 1)
        assert(contract.authoritySources[source], `${id}: ${source}`)
        assert(pointer.startsWith('/') || pointer.startsWith('#'), id)
        assert(
          authorityPointerExists(contract, source, pointer),
          `${id}: ${encodedReference}`,
        )
      }
    }
  }
  assert(
    new Set(contract.rules.map((entry) => entry[4])).size >= 40,
    'semantic profiles must not collapse all rules to one constraint object',
  )
})

test('T400-15 enforces semantic ownership, issue mappings, and constraint diversity against production registry', async () => {
  const expectedInventory = readJson('production-rule-inventory.json')
  const expectedSemanticOwnership = readJson('semantic-ownership-contract.json')
  const acceptance = readJson('acceptance-mapping.json')
  const { subject } = await loadAssets()
  const { registry } = await subject.loadComponentSurfaceSemanticRegistry({
    root,
  })
  const result = await subject.checkComponentSurfaceSemanticRegistry({
    root,
    expectedInventory,
    expectedSemanticOwnership,
  })
  assert.equal(result.semanticRuleCount, 45)
  assert.equal(result.issueMappingCount, 18)
  assert.equal(result.semanticOwnershipMismatchCount, 0)
  const byRuleId = new Map(registry.rules.map((rule) => [rule.id, rule]))
  for (const [
    id,
    componentContractId,
    sourcePath,
    selector,
    constraintProfile,
  ] of expectedSemanticOwnership.rules) {
    const rule = byRuleId.get(id)
    assert(rule, id)
    assert(
      rule.canonicalSources.some(
        ({ path: canonicalPath, pointer }) =>
          canonicalPath ===
            'spec/components/contracts/v1/vue-public-contracts.json' &&
          pointer === `/components/${componentContractId}`,
      ),
      `${id}: component authority`,
    )
    assert(
      rule.selectorOwnership.selectors.some(
        (ownedSelector) =>
          ownedSelector.selector === selector &&
          ownedSelector.source.path === sourcePath &&
          ownedSelector.source.pointer === `selector:${selector}`,
      ),
      `${id}: selector ownership`,
    )
    assert(
      rule.sourceOwnership.sources.some(
        (source) =>
          source.path === sourcePath &&
          source.pointer === `selector:${selector}`,
      ),
      `${id}: source ownership`,
    )
    const expectedConstraints =
      expectedSemanticOwnership.constraintProfiles[constraintProfile]
    for (const [domain, encodedReferences] of Object.entries(
      expectedConstraints,
    )) {
      for (const encodedReference of encodedReferences) {
        const separator = encodedReference.indexOf(':')
        const sourceName = encodedReference.slice(0, separator)
        const pointer = encodedReference.slice(separator + 1)
        const expectedPath =
          expectedSemanticOwnership.authoritySources[sourceName]
        assert(
          rule.constraints[domain].some(
            (reference) =>
              reference.path === expectedPath && reference.pointer === pointer,
          ),
          `${id}: ${domain} ${encodedReference}`,
        )
      }
    }
  }
  const signatures = registry.rules.map((rule) =>
    JSON.stringify(rule.constraints),
  )
  assert(
    new Set(signatures).size >= 20,
    '45 production rules cannot share one cloned constraint object',
  )
  const expectedMappings = new Map(
    Array.from({ length: 18 }, (_, index) => 293 + index).map((issue) => [
      issue,
      expectedInventory.rules.filter((rule) => rule.issues.includes(issue)),
    ]),
  )
  assert.equal(registry.issueMappings.length, 18)
  assert.equal(
    new Set(registry.issueMappings.map(({ issue }) => issue)).size,
    18,
  )
  const expectedErrorIds = new Map(
    acceptance.issueCoverage.map(({ issue, errorId }) => [issue, errorId]),
  )
  for (const mapping of registry.issueMappings) {
    const expected = expectedMappings.get(mapping.issue)
    assert(expected, `unexpected issue #${mapping.issue}`)
    assert.equal(mapping.errorId, expectedErrorIds.get(mapping.issue))
    assert.deepEqual(
      [...mapping.ruleIds].sort(),
      expected.map(({ id }) => id).sort(),
    )
    assert.deepEqual(
      [...mapping.semanticRoles].sort(),
      expected.map(({ surfaceRole }) => surfaceRole).sort(),
    )
    assert(
      mapping.semanticRoles.every(
        (role) => !/[\\/]|(?:\.css|\.scss|\.vue|\.ts|\.md|\.json)$/u.test(role),
      ),
    )
  }
})
