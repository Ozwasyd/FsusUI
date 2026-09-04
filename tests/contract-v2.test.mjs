import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { fileURLToPath } from 'node:url'
import {
  buildRegistry,
  compareMembers,
  avaloniaPublicSurfaces,
  avaloniaAutomationContractFingerprint,
  avaloniaStateContractFingerprint,
  validateAvaloniaSurfaceRegistration,
  validateRegistry,
  validateSemanticMemberBindings,
  AVALONIA_SEMANTIC_PATHS,
  MARKDOWN_EDITOR_GATE_PATH,
  CONTRACT_V2_REGISTRY_PATH,
  SEMANTIC_MEMBER_BINDINGS_PATH,
  VUE_BASELINE_PATH,
} from '../scripts/contract-v2.mjs'
import { validateVuePublicCoverage } from '../scripts/conformance-v2-vue-public-gate.mjs'
import { extractStructuredEmitPayloads } from '../scripts/vue-structured-emit-payload.mjs'
import { extractStructuredExposedSignatures } from '../scripts/vue-structured-exposed-signature.mjs'
import {
  deprecatedMetadataForNode,
  extractDeprecatedDeclarations,
  extractTemplateSlots,
} from '../scripts/vue-semantic-baseline.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtureDirectory = path.join(root, 'tests/fixtures/contract-v2')
const validRegistry = JSON.parse(
  fs.readFileSync(path.join(fixtureDirectory, 'valid-registry.json'), 'utf8'),
)
const mutations = JSON.parse(
  fs.readFileSync(path.join(fixtureDirectory, 'mutations.json'), 'utf8'),
)
const gate = JSON.parse(
  fs.readFileSync(path.join(root, MARKDOWN_EDITOR_GATE_PATH), 'utf8'),
)
const committedRegistry = JSON.parse(
  fs.readFileSync(path.join(root, CONTRACT_V2_REGISTRY_PATH), 'utf8'),
)
const vueBaseline = JSON.parse(
  fs.readFileSync(path.join(root, VUE_BASELINE_PATH), 'utf8'),
)
const avaloniaBaselineSources = Object.fromEntries(
  Object.entries(AVALONIA_SEMANTIC_PATHS).map(([key, relativePath]) => [
    key,
    fs.readFileSync(path.join(root, relativePath), 'utf8'),
  ]),
)
const avaloniaBaselines = Object.fromEntries(
  Object.entries(avaloniaBaselineSources).map(([key, source]) => [
    key,
    JSON.parse(source),
  ]),
)
const semanticMemberBindings = JSON.parse(
  fs.readFileSync(path.join(root, SEMANTIC_MEMBER_BINDINGS_PATH), 'utf8'),
)

const clone = (value) => JSON.parse(JSON.stringify(value))
const sha256Pattern = /^[0-9a-f]{64}$/u
const outputHashPattern = /("outputHash": ")[a-f0-9]{64}(")/gu
const avaloniaOutputHash = (source) =>
  crypto
    .createHash('sha256')
    .update(source.replace(outputHashPattern, '$1$2'))
    .digest('hex')

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

const addPropertyAtPath = (value, pointer, addition) => {
  const segments = pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
  const copy = clone(value)
  let parent = copy
  for (const segment of segments.slice(0, -1)) parent = parent[segment]
  Object.assign(parent[segments.at(-1)], addition)
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
  if (mutation.operation === 'add-property') {
    return addPropertyAtPath(registry, mutation.path, mutation.value)
  }
  throw new Error(`unknown mutation operation ${mutation.operation}`)
}

test('valid Contract V2 fixture registry passes validation', () => {
  const errors = validateRegistry(validRegistry, gate)
  assert.deepEqual(errors, [])
})

test('committed Contract V2 registry passes validation with the committed gate', () => {
  const errors = validateRegistry(committedRegistry, gate, {
    avaloniaBaselines,
  })
  assert.deepEqual(errors, [])
})

test('Avalonia semantic baselines retain compiler and input freshness identity', () => {
  for (const [key, baseline] of Object.entries(avaloniaBaselines)) {
    assert.equal(baseline.baselineVersion, '2.3.0')
    assert.equal(baseline.source.toolVersion, 'FsusUI.Avalonia.ApiTool@1.7.0')
    assert.match(baseline.source.inputTreeHash, sha256Pattern)
    assert.match(baseline.source.compilerOptionsHash, sha256Pattern)
    assert.match(baseline.source.dependencyVersionHash, sha256Pattern)
    assert.equal(baseline.source.contractSchemaVersion, '2.0.0')
    assert.match(baseline.source.outputHash, sha256Pattern)
    assert.equal(
      baseline.source.outputHash,
      avaloniaOutputHash(avaloniaBaselineSources[key]),
    )
  }
  const properties = avaloniaBaselines.avalonia.semanticTypes.flatMap(
    (type) => type.properties,
  )
  const avaloniaProperties = avaloniaBaselines.avalonia.semanticTypes.flatMap(
    (type) => type.avaloniaProperties,
  )
  assert.equal(
    properties.filter((property) => typeof property.required === 'boolean')
      .length,
    2021,
  )
  assert.equal(properties.filter((property) => property.required).length, 15)
  assert.equal(
    avaloniaProperties.filter((property) => property.defaultKnown).length,
    294,
  )
  const contentRegions = avaloniaBaselines.avalonia.semanticTypes.flatMap(
    (type) =>
      (type.contentRegions ?? []).map((region) => ({
        ownerType: type.name,
        ...region,
      })),
  )
  assert.deepEqual(
    contentRegions.map((region) => [
      region.ownerType,
      region.name,
      region.propertyKind,
    ]),
    [
      ['FsusUI.Avalonia.Controls.FsusActivityRailSection', 'Content', 'clr'],
      [
        'FsusUI.Avalonia.Controls.FsusActivityRailShell',
        'MainContent',
        'styled',
      ],
      ['FsusUI.Avalonia.Controls.FsusSettingsCategory', 'Content', 'clr'],
    ],
  )
  for (const region of contentRegions) {
    assert.equal(region.type, 'System.Object')
    assert.equal(region.nullable, true)
    assert.equal(region.canRead, true)
    assert.equal(region.canWrite, true)
    assert.equal(region.required, false)
  }
  const semanticTypes = Object.values(avaloniaBaselines).flatMap(
    (baseline) => baseline.semanticTypes,
  )
  const enumTypes = semanticTypes.filter((type) => type.kind === 'enum')
  const enumMembers = enumTypes.flatMap((type) => type.enumMembers)
  assert.equal(enumTypes.length, 98)
  assert.equal(enumMembers.length, 430)
  assert.ok(semanticTypes.every((type) => typeof type.deprecated === 'boolean'))
  assert.ok(
    semanticTypes
      .flatMap((type) => type.properties)
      .every((property) => typeof property.deprecated === 'boolean'),
  )
  assert.ok(
    enumMembers.every((member) => typeof member.deprecated === 'boolean'),
  )
})

test('Avalonia semantic output hash rejects payload drift', () => {
  const source = avaloniaBaselineSources.avalonia
  const currentHash = avaloniaBaselines.avalonia.source.outputHash
  const mutation = source.replace('"deprecated": false', '"deprecated": true')
  assert.notEqual(avaloniaOutputHash(mutation), currentHash)
})

test('Avalonia semantic baseline distinguishes declared pseudo-class contracts from observed class implementation', () => {
  const stateTypes = avaloniaBaselines.avalonia.semanticTypes.filter(
    (type) => type.stateContract,
  )
  const declaredPseudoClasses = stateTypes.flatMap(
    (type) => type.stateContract.declaredPseudoClasses,
  )
  const pseudoClassBindings = stateTypes.flatMap(
    (type) => type.stateContract.pseudoClassBindings,
  )
  const classBindings = stateTypes.flatMap(
    (type) => type.stateContract.classBindings,
  )
  assert.equal(stateTypes.length, 127)
  assert.equal(declaredPseudoClasses.length, 7)
  assert.equal(pseudoClassBindings.length, 7)
  assert.equal(classBindings.length, 742)
  assert.equal(
    stateTypes.filter(
      (type) => type.stateContract.pseudoClassContractKnown === true,
    ).length,
    2,
  )
  assert.equal(
    stateTypes.filter(
      (type) => type.stateContract.pseudoClassContractComplete === true,
    ).length,
    2,
  )
  assert.ok(
    stateTypes.every(
      (type) =>
        type.stateContract.classBindingAuthority ===
          'roslyn-control-instance-operation' &&
        type.stateContract.classContractDeclared === false,
    ),
  )

  const slider = avaloniaBaselines.avalonia.semanticTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusSlider',
  )
  assert.equal(
    slider.stateContract.pseudoClassDeclarationAuthority,
    'avalonia-pseudo-classes-attribute',
  )
  assert.equal(slider.stateContract.pseudoClassContractKnown, true)
  assert.equal(slider.stateContract.pseudoClassContractComplete, true)
  assert.deepEqual(slider.stateContract.declaredPseudoClasses, [
    ':disabled',
    ':dragging',
  ])
  assert.ok(
    slider.stateContract.pseudoClassBindings.some(
      (binding) =>
        binding.name === ':dragging' &&
        binding.conditionExpression === 'isDragging',
    ),
  )
  assert.equal(
    slider.stateContract.classBindingAuthority,
    'roslyn-control-instance-operation',
  )
  assert.equal(slider.stateContract.classContractDeclared, false)
  assert.ok(
    slider.stateContract.classBindings.some(
      (binding) =>
        binding.name === 'fsus-size-md' &&
        binding.conditionExpression === 'Size' &&
        binding.publicDependencies.includes(
          'FsusUI.Avalonia.Controls.FsusSlider.Size',
        ),
    ),
  )

  const button = avaloniaBaselines.avalonia.semanticTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusButton',
  )
  assert.equal(button.stateContract.pseudoClassDeclarationAuthority, undefined)
  assert.equal(button.stateContract.pseudoClassContractKnown, false)
  assert.equal(button.stateContract.pseudoClassContractComplete, false)
  assert.equal(button.stateContract.classContractDeclared, false)

  const unresolved = avaloniaBaselines.avalonia.semanticTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusVirtualList',
  )
  assert.equal(unresolved.stateContract.classNamesResolved, false)
  assert.ok(
    unresolved.stateContract.classBindings.some(
      (binding) => binding.nameKnown === false && binding.nameExpression,
    ),
  )
})

test('pseudo-class and class-state mutations invalidate Contract V2 state identities', () => {
  const changedPseudoBaselines = clone(avaloniaBaselines)
  const changedSlider = changedPseudoBaselines.avalonia.semanticTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusSlider',
  )
  const currentSliderFingerprint =
    avaloniaStateContractFingerprint(changedSlider)
  changedSlider.stateContract.declaredPseudoClasses[1] = ':pressed'
  assert.notEqual(
    avaloniaStateContractFingerprint(changedSlider),
    currentSliderFingerprint,
  )
  const changedPseudoErrors = validateAvaloniaSurfaceRegistration({
    registry: committedRegistry,
    avaloniaBaselines: changedPseudoBaselines,
  }).errors.join('\n')
  assert.match(
    changedPseudoErrors,
    /ElSlider.*has stale state contract fingerprint/,
  )
  assert.match(
    changedPseudoErrors,
    /component-v2\.el-slider has stale Avalonia state contract binding/,
  )

  const changedClassBaselines = clone(avaloniaBaselines)
  const changedDropZone = changedClassBaselines.avalonia.semanticTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusDropZone',
  )
  changedDropZone.stateContract.classBindings.find(
    (binding) => binding.name === 'fsus-loading',
  ).conditionExpression = 'IsError'
  const changedClassErrors = validateAvaloniaSurfaceRegistration({
    registry: committedRegistry,
    avaloniaBaselines: changedClassBaselines,
  }).errors.join('\n')
  assert.match(
    changedClassErrors,
    /avalonia-only type FsusUI\.Avalonia\.Controls\.FsusDropZone has stale stateContractFingerprint/,
  )

  const deletedIdentity = clone(committedRegistry)
  delete deletedIdentity.componentMap.find(
    (entry) => entry.vue.name === 'ElSlider',
  ).avalonia.stateContractFingerprint
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: deletedIdentity,
      avaloniaBaselines,
    }).errors.join('\n'),
    /ElSlider.*has stale state contract fingerprint/,
  )
})

test('Avalonia automation baseline separates source observations from declared and runtime contracts', () => {
  const automationTypes = avaloniaBaselines.avalonia.semanticTypes.filter(
    (type) => type.automationContract,
  )
  const mappings = automationTypes.flatMap(
    (type) => type.automationContract.mappings,
  )
  const semanticCounts = Object.fromEntries(
    [
      'role',
      'name',
      'value',
      'state',
      'help-text',
      'accessibility-view',
      'live-setting',
    ].map((semantic) => [
      semantic,
      mappings.filter((mapping) => mapping.semantic === semantic).length,
    ]),
  )
  assert.equal(automationTypes.length, 112)
  assert.equal(mappings.length, 399)
  assert.deepEqual(semanticCounts, {
    role: 106,
    name: 123,
    value: 3,
    state: 109,
    'help-text': 25,
    'accessibility-view': 22,
    'live-setting': 11,
  })
  assert.equal(
    mappings.filter((mapping) => mapping.targetKind === 'public-control-this')
      .length,
    321,
  )
  assert.equal(
    mappings.filter((mapping) => mapping.targetKind === 'automation-peer-owner')
      .length,
    19,
  )
  assert.ok(
    automationTypes.every(
      (type) =>
        type.automationContract.contractDeclared === false &&
        type.automationContract.runtimeTreeVerified === false &&
        type.automationContract.mappingComplete === false,
    ),
  )

  const slider = automationTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusSlider',
  )
  assert.ok(
    slider.automationContract.mappings.some(
      (mapping) =>
        mapping.semantic === 'role' &&
        mapping.provider === 'AutomationProperties.SetControlTypeOverride' &&
        mapping.targetKind === 'public-control-this' &&
        mapping.valueKnown === true &&
        mapping.value === 'Slider',
    ),
  )
  assert.ok(
    slider.automationContract.mappings.some(
      (mapping) =>
        mapping.semantic === 'name' &&
        mapping.provider === 'AutomationProperties.SetName' &&
        mapping.valueKnown === false &&
        mapping.valueExpression.includes('AccessibleName'),
    ),
  )
  assert.ok(
    slider.automationContract.mappings.some(
      (mapping) =>
        mapping.semantic === 'value' &&
        mapping.provider ===
          'Avalonia.Automation.Provider.IRangeValueProvider.Value' &&
        mapping.targetKind === 'automation-peer-owner' &&
        mapping.valueKnown === false &&
        mapping.valueExpression === 'owner.Value',
    ),
  )
  assert.ok(
    slider.automationContract.mappings.some(
      (mapping) =>
        mapping.semantic === 'state' &&
        mapping.provider ===
          'Avalonia.Automation.Provider.IRangeValueProvider.IsReadOnly' &&
        mapping.valueExpression === '!owner.CanInteract',
    ),
  )
})

test('automation mutations invalidate independent Contract V2 identities without changing derived status', () => {
  const changedBaselines = clone(avaloniaBaselines)
  const changedSlider = changedBaselines.avalonia.semanticTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusSlider',
  )
  const currentFingerprint =
    avaloniaAutomationContractFingerprint(changedSlider)
  changedSlider.automationContract.mappings.find(
    (mapping) => mapping.semantic === 'role',
  ).value = 'ProgressBar'
  assert.notEqual(
    avaloniaAutomationContractFingerprint(changedSlider),
    currentFingerprint,
  )
  const errors = validateAvaloniaSurfaceRegistration({
    registry: committedRegistry,
    avaloniaBaselines: changedBaselines,
  }).errors.join('\n')
  assert.match(errors, /ElSlider.*has stale automation contract fingerprint/)
  assert.match(
    errors,
    /component-v2\.el-slider has stale Avalonia automation contract binding/,
  )

  const deletedIdentity = clone(committedRegistry)
  delete deletedIdentity.componentMap.find(
    (entry) => entry.vue.name === 'ElSlider',
  ).avalonia.automationContractFingerprint
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: deletedIdentity,
      avaloniaBaselines,
    }).errors.join('\n'),
    /ElSlider.*has stale automation contract fingerprint/,
  )

  const build = (baselines) =>
    buildRegistry({
      vueBaseline,
      avaloniaBaseline: baselines.avalonia,
      avaloniaThemesBaseline: baselines.avaloniaThemes,
      avaloniaIconsBaseline: baselines.avaloniaIcons,
      gate,
      semanticMemberBindings,
    })
  const statuses = (registry) =>
    registry.contracts.map((contract) => [
      contract.id,
      contract.component.exportStatus,
    ])
  assert.deepEqual(
    statuses(build(changedBaselines)),
    statuses(build(avaloniaBaselines)),
  )
})

test('Avalonia semantic baseline retains real generic constraints and command surfaces', () => {
  const genericType = avaloniaBaselines.avalonia.semanticTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusServiceHandle`1',
  )
  assert.deepEqual(genericType.genericParameters, [
    {
      name: 'TControl',
      position: 0,
      variance: 'none',
      referenceTypeConstraint: false,
      valueTypeConstraint: false,
      unmanagedTypeConstraint: false,
      notNullConstraint: false,
      constructorConstraint: false,
      typeConstraints: ['Avalonia.Controls.Control'],
    },
  ])

  const commands = avaloniaBaselines.avalonia.semanticTypes.flatMap((type) =>
    (type.commands ?? []).map((command) => ({
      ownerType: type.name,
      ...command,
    })),
  )
  assert.equal(commands.length, 16)
  assert.equal(commands.filter((command) => command.nullable).length, 4)
  assert.deepEqual(
    commands
      .filter((command) => command.propertyKind !== 'clr')
      .map((command) => [
        command.ownerType,
        command.name,
        command.propertyKind,
      ]),
    [
      ['FsusUI.Avalonia.Controls.FsusDropZone', 'BrowseCommand', 'styled'],
      ['FsusUI.Avalonia.Controls.FsusNotification', 'ActionCommand', 'styled'],
      [
        'FsusUI.Avalonia.Controls.FsusShortcutRecorder',
        'CancelRecordingCommand',
        'direct',
      ],
      [
        'FsusUI.Avalonia.Controls.FsusShortcutRecorder',
        'ClearCommand',
        'direct',
      ],
      [
        'FsusUI.Avalonia.Controls.FsusShortcutRecorder',
        'StartRecordingCommand',
        'direct',
      ],
    ],
  )

  const notification = avaloniaBaselines.avalonia.semanticTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusNotification',
  )
  const actionSurfaces = avaloniaPublicSurfaces(notification).filter(
    (surface) => surface.member === 'ActionCommand',
  )
  assert.equal(actionSurfaces.length, 1)
  assert.equal(actionSurfaces[0].kind, 'command')
  assert.equal(actionSurfaces[0].propertyKind, 'styled')

  const recorder = avaloniaBaselines.avalonia.semanticTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusShortcutRecorder',
  )
  const clearSurfaces = avaloniaPublicSurfaces(recorder).filter(
    (surface) => surface.member === 'ClearCommand',
  )
  assert.equal(clearSurfaces.length, 1)
  assert.equal(clearSurfaces[0].kind, 'command')
  assert.equal(clearSurfaces[0].propertyKind, 'direct')
})

test('generic-constraint and command-nullability mutations invalidate Contract V2 identities', () => {
  const changedConstraintBaselines = clone(avaloniaBaselines)
  changedConstraintBaselines.avalonia.semanticTypes.find(
    (type) => type.name === 'FsusUI.Avalonia.Controls.FsusServiceHandle`1',
  ).genericParameters[0].typeConstraints[0] = 'Avalonia.Controls.ContentControl'
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: committedRegistry,
      avaloniaBaselines: changedConstraintBaselines,
    }).errors.join('\n'),
    /FsusServiceHandle`1 has stale surfaceHash/,
  )

  const changedCommandBaselines = clone(avaloniaBaselines)
  changedCommandBaselines.avalonia.semanticTypes
    .find((type) => type.name === 'FsusUI.Avalonia.Controls.FsusInput')
    .commands.find((command) => command.name === 'ClearCommand').nullable = true
  const changedCommandErrors = validateAvaloniaSurfaceRegistration({
    registry: committedRegistry,
    avaloniaBaselines: changedCommandBaselines,
  }).errors.join('\n')
  assert.match(changedCommandErrors, /ElInput.*has stale public surface hash/)
  assert.match(
    changedCommandErrors,
    /ClearCommand is neither mapped nor registered as avalonia-extra/,
  )
})

test('explicit command operation bindings remain partial without invocation semantics', () => {
  const bindings = clone(semanticMemberBindings)
  bindings.mappings.push({
    component: 'ElInput',
    semantic: 'clear-command',
    kind: 'operation',
    web: 'clear',
    avalonia: 'ClearCommand',
  })
  assert.deepEqual(
    validateSemanticMemberBindings({
      registry: bindings,
      vueBaseline,
      avaloniaBaselines,
    }),
    [],
  )

  const registry = buildRegistry({
    vueBaseline,
    avaloniaBaseline: avaloniaBaselines.avalonia,
    avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
    avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
    semanticMemberBindings: bindings,
    gate,
  })
  const clear = registry.contracts
    .find((contract) => contract.component.name === 'ElInput')
    .operations.find((operation) => operation.name === 'clear')
  assert.equal(clear.bindingBasis, 'explicit-semantic')
  assert.equal(clear.avalonia.member, 'ClearCommand')
  assert.equal(clear.avalonia.operationKind, 'command')
  assert.equal(clear.avalonia.signature, null)
  assert.equal(clear.status, 'partial')
  assert.match(clear.drift.operationSignature, /avalonia signature unavailable/)
})

test('Vue compiler AST retains dynamic names and scoped slot payload structure', () => {
  const component = (name) =>
    vueBaseline.components.find((candidate) => candidate.name === name)

  assert.deepEqual(component('ElCountdown').slots, [
    {
      name: '$dynamic:name',
      nameKnown: false,
      scoped: false,
      payload: [],
      payloadComplete: true,
      nameExpression: 'name',
    },
  ])
  assert.deepEqual(
    component('ElSelectV2').slots.map((slot) => [
      slot.name,
      slot.scoped,
      slot.payloadComplete,
    ]),
    [
      ['default', true, false],
      ['empty', false, true],
      ['prefix', false, true],
    ],
  )
  assert.equal(
    component('ElSkeleton').slots.find((slot) => slot.name === 'default')
      .payloadComplete,
    false,
  )
  assert.deepEqual(
    component('ElCalendar').slots.find((slot) => slot.name === 'header')
      .payload,
    [{ name: 'date', expression: 'i18nDate', type: null }],
  )
})

test('Vue compiler AST binds deprecated metadata to the real declaration', () => {
  const relativePath = 'vue/packages/components/select/src/select.vue'
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const declarations = extractDeprecatedDeclarations({
    source,
    filename: relativePath,
  })
  assert.deepEqual(declarations, [
    {
      kind: 'property',
      target: 'suffixTransition',
      message:
        'will be removed in version 2.4.0, please use override style scheme',
    },
  ])
  const component = vueBaseline.components.find(
    (candidate) => candidate.name === 'ElSelect',
  )
  const suffixTransition = component.semantic.props.find(
    (prop) => prop.name === 'suffixTransition',
  )
  assert.equal(suffixTransition.deprecated, true)
  assert.match(suffixTransition.deprecationMessage, /override style scheme/)
  assert.equal(
    component.semantic.props.find((prop) => prop.name === 'placement')
      .deprecated,
    false,
  )
  assert.deepEqual(deprecatedMetadataForNode(null), {
    deprecated: false,
    deprecationMessage: null,
  })
})

test('enum and deprecated comparator mutations fail closed', () => {
  const web = {
    categories: ['string'],
    nullable: false,
    default: { kind: 'literal', value: 'circle' },
    required: false,
    readonly: false,
    values: ['circle', 'square'],
    valuesKnown: true,
    deprecated: false,
  }
  const avalonia = {
    categories: ['string'],
    nullable: false,
    defaultKnown: true,
    defaultValue: 'circle',
    required: false,
    canRead: true,
    canWrite: true,
    enumMembers: [
      { name: 'Circle', value: 0 },
      { name: 'Square', value: 1 },
    ],
    enumValuesKnown: true,
    deprecated: false,
  }
  assert.equal(
    compareMembers({ web, avalonia, kind: 'input' }).compatible,
    true,
  )

  const extraEnumValue = compareMembers({
    web,
    avalonia: {
      ...avalonia,
      enumMembers: [...avalonia.enumMembers, { name: 'Triangle', value: 2 }],
    },
    kind: 'input',
  })
  assert.match(extraEnumValue.drift.enumValues, /triangle/)

  const singleOverlap = compareMembers({
    web,
    avalonia: {
      ...avalonia,
      enumMembers: [
        { name: 'Circle', value: 0 },
        { name: 'Triangle', value: 1 },
      ],
    },
    kind: 'input',
  })
  assert.match(singleOverlap.drift.enumValues, /triangle/)

  const unknownValues = compareMembers({
    web: { ...web, valuesKnown: false },
    avalonia,
    kind: 'input',
  })
  assert.equal(
    unknownValues.drift.enumValues,
    'web enum/union values unavailable',
  )

  const deprecatedDrift = compareMembers({
    web: { ...web, deprecated: true },
    avalonia,
    kind: 'input',
  })
  assert.equal(
    deprecatedDrift.drift.deprecated,
    'web deprecated=true vs avalonia deprecated=false',
  )
})

test('real Vue slot source mutation reaches compiler baseline coverage', () => {
  const relativePath = 'vue/packages/components/select-v2/src/select.vue'
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const mutatedSource = source.replace(
    '<slot name="empty">',
    '<slot name="empty-mutated">',
  )
  assert.notEqual(mutatedSource, source)
  const { descriptor, errors } = parseSfc(mutatedSource, {
    filename: relativePath,
  })
  assert.deepEqual(errors, [])
  const slots = extractTemplateSlots(descriptor.template?.ast)
  assert.ok(slots.some((slot) => slot.name === 'empty-mutated'))
  assert.ok(!slots.some((slot) => slot.name === 'empty'))

  const mutatedBaseline = clone(vueBaseline)
  mutatedBaseline.components.find(
    (component) => component.name === 'ElSelectV2',
  ).slots = slots
  const coverage = validateVuePublicCoverage({
    baseline: mutatedBaseline,
    registry: committedRegistry,
  })
  assert.match(
    coverage.errors.join('\n'),
    /ElSelectV2 contentRegion empty-mutated is missing from Contract V2/,
  )
  assert.match(
    coverage.errors.join('\n'),
    /ElSelectV2 Contract V2 has extra contentRegion empty/,
  )
})

test('content-region comparator fails closed on unknown and drifted structure', () => {
  const compatibleWeb = {
    nameKnown: true,
    scoped: false,
    payload: [],
    payloadComplete: true,
    contentType: 'Object',
  }
  const compatibleAvalonia = {
    content: true,
    type: 'System.Object',
    nullable: true,
    canRead: true,
    canWrite: true,
    required: false,
    propertyKind: 'styled',
  }
  assert.equal(
    compareMembers({
      web: compatibleWeb,
      avalonia: compatibleAvalonia,
      kind: 'contentRegion',
    }).compatible,
    true,
  )

  const mutations = [
    [
      { ...compatibleWeb, nameKnown: false },
      compatibleAvalonia,
      /name is dynamic or unavailable/,
    ],
    [
      { ...compatibleWeb, payloadComplete: false },
      compatibleAvalonia,
      /payload is incomplete or spread-bound/,
    ],
    [
      { ...compatibleWeb, contentType: 'String' },
      compatibleAvalonia,
      /content value type mismatch/,
    ],
    [
      compatibleWeb,
      { ...compatibleAvalonia, nullable: false },
      /avalonia nullable=false/,
    ],
    [
      compatibleWeb,
      { ...compatibleAvalonia, canWrite: false },
      /canWrite=false/,
    ],
    [
      {
        ...compatibleWeb,
        scoped: true,
        payload: [{ name: 'row', type: 'String' }],
      },
      compatibleAvalonia,
      /avalonia scoped content payload shape unavailable/,
    ],
  ]
  for (const [web, avalonia, expected] of mutations) {
    const comparison = compareMembers({
      web,
      avalonia,
      kind: 'contentRegion',
    })
    assert.equal(comparison.compatible, false)
    assert.match(comparison.drift.contentRegion, expected)
  }
})

test('content-region baseline mutation invalidates Avalonia-only surface identity', () => {
  const changedBaselines = clone(avaloniaBaselines)
  changedBaselines.avalonia.semanticTypes
    .find(
      (type) => type.name === 'FsusUI.Avalonia.Controls.FsusActivityRailShell',
    )
    .contentRegions.find((region) => region.name === 'MainContent').nullable =
    false
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: committedRegistry,
      avaloniaBaselines: changedBaselines,
    }).errors.join('\n'),
    /FsusActivityRailShell has stale surfaceHash/,
  )
})

test('real Avalonia public surfaces have one current mapped or avalonia-extra state', () => {
  const audit = validateAvaloniaSurfaceRegistration({
    registry: committedRegistry,
    avaloniaBaselines,
  })
  assert.deepEqual(audit.errors, [])
  assert.equal(
    audit.stats.mappedClaims + audit.stats.avaloniaExtras,
    audit.stats.mappedSurfaceStates,
  )
  assert.equal(
    audit.stats.mappedTypes + audit.stats.avaloniaOnlyTypes,
    audit.stats.baselineTypes,
  )
  assert.equal(
    audit.stats.mappedTypeSurfaces + audit.stats.avaloniaOnlySurfaces,
    audit.stats.baselineSurfaces,
  )
  assert.equal(audit.stats.internalSurfaces, 0)
})

test('real Avalonia surface mutations invalidate current registration', () => {
  const addedSurfaceBaselines = clone(avaloniaBaselines)
  addedSurfaceBaselines.avalonia.semanticTypes
    .find((type) => type.name === 'FsusUI.Avalonia.Controls.FsusImage')
    .properties.push({
      name: 'UnregisteredPublicState',
      type: 'System.String',
      nullable: true,
      canRead: true,
      canWrite: true,
      isStatic: false,
    })
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: committedRegistry,
      avaloniaBaselines: addedSurfaceBaselines,
    }).errors.join('\n'),
    /UnregisteredPublicState is neither mapped nor registered as avalonia-extra/,
  )

  const changedOverloadBaselines = clone(avaloniaBaselines)
  changedOverloadBaselines.avalonia.semanticTypes
    .find((type) => type.name === 'FsusUI.Avalonia.Controls.FsusImage')
    .methods.find(
      (method) =>
        method.name === 'OpenPreview' && method.parameters.length === 2,
    ).parameters[1].type = 'System.String'
  const changedOverloadErrors = validateAvaloniaSurfaceRegistration({
    registry: committedRegistry,
    avaloniaBaselines: changedOverloadBaselines,
  }).errors.join('\n')
  assert.match(
    changedOverloadErrors,
    /OpenPreview is neither mapped nor registered as avalonia-extra/,
  )
  assert.match(
    changedOverloadErrors,
    /OpenPreview does not match an unmatched real public surface/,
  )

  const changedEventBaselines = clone(avaloniaBaselines)
  changedEventBaselines.avalonia.semanticTypes
    .find((type) => type.name === 'FsusUI.Avalonia.Controls.FsusAlert')
    .events.find((event) => event.name === 'Dismissed').argsType =
    'System.EventHandler<System.String>'
  const changedEventErrors = validateAvaloniaSurfaceRegistration({
    registry: committedRegistry,
    avaloniaBaselines: changedEventBaselines,
  }).errors.join('\n')
  assert.match(
    changedEventErrors,
    /Dismissed is neither mapped nor registered as avalonia-extra/,
  )
  assert.match(
    changedEventErrors,
    /Dismissed does not match an unmatched real public surface/,
  )

  const changedStyledPropertyBaselines = clone(avaloniaBaselines)
  changedStyledPropertyBaselines.avalonia.semanticTypes
    .find((type) => type.name === 'FsusUI.Avalonia.Controls.FsusAlert')
    .avaloniaProperties.find(
      (property) => property.name === 'ActionContent',
    ).kind = 'direct'
  const changedStyledPropertyErrors = validateAvaloniaSurfaceRegistration({
    registry: committedRegistry,
    avaloniaBaselines: changedStyledPropertyBaselines,
  }).errors.join('\n')
  assert.match(
    changedStyledPropertyErrors,
    /ActionContent is neither mapped nor registered as avalonia-extra/,
  )
  assert.match(
    changedStyledPropertyErrors,
    /ActionContent does not match an unmatched real public surface/,
  )

  const changedOnlyTypeBaselines = clone(avaloniaBaselines)
  changedOnlyTypeBaselines.avalonia.semanticTypes.find(
    (type) =>
      type.name === 'FsusUI.Avalonia.Controls.FsusActiveSourceChangedEventArgs',
  ).properties[0].type = 'System.Int64'
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: committedRegistry,
      avaloniaBaselines: changedOnlyTypeBaselines,
    }).errors.join('\n'),
    /FsusActiveSourceChangedEventArgs has stale surfaceHash/,
  )

  const changedEnumBaselines = clone(avaloniaBaselines)
  changedEnumBaselines.avalonia.semanticTypes
    .find((type) => type.name === 'FsusUI.Avalonia.Controls.FsusAvatarShape')
    .enumMembers.find((member) => member.name === 'Circle').deprecated = true
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: committedRegistry,
      avaloniaBaselines: changedEnumBaselines,
    }).errors.join('\n'),
    /FsusAvatarShape has stale surfaceHash/,
  )
})

test('Avalonia registration mutations cannot hide missing or duplicate ownership', () => {
  const missingExtra = clone(committedRegistry)
  const imageContract = missingExtra.contracts.find(
    (contract) => contract.component.name === 'ElImage',
  )
  imageContract.avaloniaExtras = imageContract.avaloniaExtras.filter(
    (extra) => extra.member !== 'LoadAsync',
  )
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: missingExtra,
      avaloniaBaselines,
    }).errors.join('\n'),
    /LoadAsync is neither mapped nor registered as avalonia-extra/,
  )

  const duplicateExtra = clone(committedRegistry)
  const duplicateImageContract = duplicateExtra.contracts.find(
    (contract) => contract.component.name === 'ElImage',
  )
  duplicateImageContract.avaloniaExtras.push(
    clone(duplicateImageContract.avaloniaExtras[0]),
  )
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: duplicateExtra,
      avaloniaBaselines,
    }).errors.join('\n'),
    /duplicates a public surface registration/,
  )

  const duplicateOverloadScenario = clone(committedRegistry)
  const openPreviewExtras = duplicateOverloadScenario.contracts
    .find((contract) => contract.component.name === 'ElImage')
    .avaloniaExtras.filter((extra) => extra.member === 'OpenPreview')
  openPreviewExtras[1].scenarioIds = clone(openPreviewExtras[0].scenarioIds)
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: duplicateOverloadScenario,
      avaloniaBaselines,
    }).errors.join('\n'),
    /stale or non-unique scenario coverage identity/,
  )

  const missingType = clone(committedRegistry)
  const removed = missingType.avaloniaOnlyTypes.shift()
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: missingType,
      avaloniaBaselines,
    }).errors.join('\n'),
    new RegExp(`${removed.type} has no Vue counterpart`),
  )

  const duplicateType = clone(committedRegistry)
  duplicateType.avaloniaOnlyTypes.push(
    clone(duplicateType.avaloniaOnlyTypes[0]),
  )
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: duplicateType,
      avaloniaBaselines,
    }).errors.join('\n'),
    /is registered more than once/,
  )

  const staleMappedType = clone(committedRegistry)
  staleMappedType.componentMap.find(
    (mapping) => mapping.vue.name === 'ElImage',
  ).avalonia.surfaceHash = '0'.repeat(64)
  assert.match(
    validateAvaloniaSurfaceRegistration({
      registry: staleMappedType,
      avaloniaBaselines,
    }).errors.join('\n'),
    /ElImage.*has stale public surface hash/,
  )
})

test('explicit semantic member bindings resolve real members from both baselines', () => {
  assert.deepEqual(
    validateSemanticMemberBindings({
      registry: semanticMemberBindings,
      vueBaseline,
      avaloniaBaselines,
    }),
    [],
  )
  const registry = buildRegistry({
    vueBaseline,
    avaloniaBaseline: avaloniaBaselines.avalonia,
    avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
    avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
    semanticMemberBindings,
    gate,
  })
  const markdownEditor = registry.contracts.find(
    (contract) => contract.component.name === 'ElMarkdownEditor',
  )
  const document = markdownEditor.inputs.find(
    (input) => input.semantic === 'document',
  )
  assert.equal(document.web.member, 'modelValue')
  assert.equal(document.avalonia.member, 'Document')
  assert.equal(document.bindingBasis, 'explicit-semantic')
  assert.equal(
    markdownEditor.avaloniaExtras.some((extra) => extra.member === 'Document'),
    false,
  )
})

test('inactive MarkdownEditor issue gate preserves evidence-derived partial status', () => {
  const registry = buildRegistry({
    vueBaseline,
    avaloniaBaseline: avaloniaBaselines.avalonia,
    avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
    avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
    semanticMemberBindings,
    gate,
  })
  const markdownEditor = registry.contracts.find(
    (contract) => contract.component.name === 'ElMarkdownEditor',
  )
  assert.deepEqual(markdownEditor.markdownEditorGate, {
    blocked: false,
    blockedBy: [],
  })
  assert.equal(markdownEditor.coverage.missing, 41)
  assert.equal(markdownEditor.coverage.partial, 17)
  assert.equal(markdownEditor.component.exportStatus, 'partial')

  const forgedAligned = clone(registry)
  forgedAligned.contracts.find(
    (contract) => contract.component.name === 'ElMarkdownEditor',
  ).component.exportStatus = 'aligned-candidate'
  assert.match(
    validateRegistry(forgedAligned, gate, { avaloniaBaselines }).join('\n'),
    /component-v2\.el-markdown-editor exportStatus aligned-candidate disagrees with derived status partial/u,
  )

  const staleInactiveGate = { ...gate, blockedBy: [343] }
  assert.match(
    validateRegistry(registry, staleInactiveGate, {
      avaloniaBaselines,
    }).join('\n'),
    /blocked=false cannot retain stale blockedBy entries/u,
  )
})

test('explicit semantic member bindings reject stale and duplicate endpoints', () => {
  const stale = clone(semanticMemberBindings)
  stale.mappings[0].avalonia = 'MissingDocument'
  assert.match(
    validateSemanticMemberBindings({
      registry: stale,
      vueBaseline,
      avaloniaBaselines,
    }).join('\n'),
    /missing real Avalonia member MissingDocument/,
  )

  const duplicate = clone(semanticMemberBindings)
  duplicate.mappings.push(clone(duplicate.mappings[0]))
  const errors = validateSemanticMemberBindings({
    registry: duplicate,
    vueBaseline,
    avaloniaBaselines,
  }).join('\n')
  assert.match(errors, /is duplicated/)
  assert.match(errors, /duplicates semantic id document/)
})

test('explicit member dispositions register only exact reviewed Web surfaces', () => {
  const registry = buildRegistry({
    vueBaseline,
    avaloniaBaseline: avaloniaBaselines.avalonia,
    avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
    avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
    semanticMemberBindings,
    gate,
  })
  const markdownEditor = registry.contracts.find(
    (contract) => contract.component.name === 'ElMarkdownEditor',
  )
  const textareaId = markdownEditor.inputs.find(
    (input) => input.name === 'textareaId',
  )
  assert.equal(textareaId.status, 'web-only')
  assert.equal(textareaId.avalonia, null)
  assert.equal(textareaId.dispositionBasis, 'explicit-member-disposition')
  assert.match(textareaId.platformAlternative, /AutomationId/u)
  assert.ok(
    markdownEditor.platformDifferences.some(
      (difference) =>
        difference.kind === 'input' &&
        difference.member === 'textareaId' &&
        difference.status === 'web-only',
    ),
  )

  const removed = clone(semanticMemberBindings)
  removed.dispositions = removed.dispositions.filter(
    (entry) =>
      !(
        entry.component === 'ElMarkdownEditor' &&
        entry.kind === 'input' &&
        entry.web === 'textareaId'
      ),
  )
  const regressed = buildRegistry({
    vueBaseline,
    avaloniaBaseline: avaloniaBaselines.avalonia,
    avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
    avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
    semanticMemberBindings: removed,
    gate,
  })
    .contracts.find(
      (contract) => contract.component.name === 'ElMarkdownEditor',
    )
    .inputs.find((input) => input.name === 'textareaId')
  assert.equal(regressed.status, 'missing')
})

test('member disposition mutations fail closed', () => {
  const mutations = [
    [
      'unknown member',
      (registry) => {
        registry.dispositions[0].web = 'missingWebMember'
      },
      /references a missing real Vue member/u,
    ],
    [
      'mapping conflict',
      (registry) => {
        registry.dispositions[0] = {
          ...registry.dispositions[0],
          kind: registry.mappings[0].kind,
          web: registry.mappings[0].web,
        }
      },
      /conflicts with an explicit semantic mapping/u,
    ],
    [
      'broad wildcard',
      (registry) => {
        registry.dispositions[0].web = '*'
      },
      /uses a broad member disposition/u,
    ],
    [
      'missing alternative',
      (registry) => {
        registry.dispositions[0].alternative = ''
      },
      /missing alternative/u,
    ],
    [
      'invalid status',
      (registry) => {
        registry.dispositions[0].status = 'aligned-candidate'
      },
      /has invalid status aligned-candidate/u,
    ],
  ]
  for (const [name, mutate, expected] of mutations) {
    const registry = clone(semanticMemberBindings)
    mutate(registry)
    const errors = validateSemanticMemberBindings({
      registry,
      vueBaseline,
      avaloniaBaselines,
    }).join('\n')
    assert.match(errors, expected, name)
  }
})

test('real mapped inputs use compiler-known metadata and keep unknown values partial', () => {
  const registry = buildRegistry({
    vueBaseline,
    avaloniaBaseline: avaloniaBaselines.avalonia,
    avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
    avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
    semanticMemberBindings,
    gate,
  })
  const mappedInputs = registry.contracts.flatMap((contract) =>
    contract.inputs.filter((input) => input.avalonia != null),
  )
  assert.equal(mappedInputs.length, 140)
  assert.equal(
    mappedInputs.filter((input) => input.status === 'aligned-candidate').length,
    13,
  )
  assert.equal(
    mappedInputs.filter((input) => input.status === 'partial').length,
    126,
  )
  const max = registry.contracts
    .find((contract) => contract.component.name === 'ElBadge')
    .inputs.find((input) => input.name === 'max')
  assert.equal(max.avalonia.canRead, true)
  assert.equal(max.avalonia.canWrite, true)
  assert.equal(max.drift.nullability, null)
  assert.equal(max.drift.readWrite, null)
  assert.equal(max.drift.default, null)
  assert.equal(max.drift.required, null)
  assert.equal(max.status, 'aligned-candidate')
})

test('real mapped input baseline mutations expose default, required, access, and nullability drift', () => {
  const buildMax = ({
    mutateWeb = () => {},
    mutateProperty = () => {},
    mutateAvaloniaProperty = () => {},
  } = {}) => {
    const nextVueBaseline = clone(vueBaseline)
    const nextAvaloniaBaseline = clone(avaloniaBaselines.avalonia)
    const webProp = nextVueBaseline.components
      .find((component) => component.name === 'ElBadge')
      .semantic.props.find((prop) => prop.name === 'max')
    const type = nextAvaloniaBaseline.semanticTypes.find(
      (candidate) => candidate.name === 'FsusUI.Avalonia.Controls.FsusBadge',
    )
    const property = type.properties.find(
      (candidate) => candidate.name === 'Max',
    )
    const avaloniaProperty = type.avaloniaProperties.find(
      (candidate) => candidate.name === 'Max',
    )
    mutateWeb(webProp)
    mutateProperty(property)
    mutateAvaloniaProperty(avaloniaProperty)
    return buildRegistry({
      vueBaseline: nextVueBaseline,
      avaloniaBaseline: nextAvaloniaBaseline,
      avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
      avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
      semanticMemberBindings,
      gate,
    })
      .contracts.find((contract) => contract.component.name === 'ElBadge')
      .inputs.find((input) => input.name === 'max')
  }

  const matchingKnownMetadata = buildMax({
    mutateProperty: (property) => {
      property.required = false
    },
    mutateAvaloniaProperty: (property) => {
      property.defaultValue = 99
    },
  })
  assert.equal(matchingKnownMetadata.drift.default, null)
  assert.equal(matchingKnownMetadata.drift.required, null)
  assert.equal(matchingKnownMetadata.drift.readWrite, null)
  assert.equal(matchingKnownMetadata.drift.nullability, null)
  assert.equal(matchingKnownMetadata.status, 'aligned-candidate')

  const unknownDefault = buildMax({
    mutateAvaloniaProperty: (property) => {
      property.defaultKnown = false
      delete property.defaultValue
    },
  })
  assert.equal(
    unknownDefault.drift.default,
    'avalonia default metadata unavailable',
  )
  assert.equal(unknownDefault.status, 'partial')

  const defaultDrift = buildMax({
    mutateWeb: (property) => {
      property.default.value = 100
    },
    mutateProperty: (property) => {
      property.required = false
    },
    mutateAvaloniaProperty: (property) => {
      property.defaultValue = 99
    },
  })
  assert.match(
    defaultDrift.drift.default,
    /web default=100 vs avalonia default=99/,
  )

  const requiredDrift = buildMax({
    mutateWeb: (property) => {
      property.required = true
    },
    mutateProperty: (property) => {
      property.required = false
    },
    mutateAvaloniaProperty: (property) => {
      property.defaultValue = 99
    },
  })
  assert.match(
    requiredDrift.drift.required,
    /web required=true vs avalonia required=false/,
  )

  const readonlyDrift = buildMax({
    mutateWeb: (property) => {
      property.readonly = true
    },
  })
  assert.match(
    readonlyDrift.drift.readWrite,
    /web readonly=true vs avalonia canWrite=true/,
  )

  const unknownReadonly = buildMax({
    mutateWeb: (property) => {
      delete property.readonly
    },
  })
  assert.match(
    unknownReadonly.drift.readWrite,
    /web readonly metadata unavailable/,
  )

  const writeDrift = buildMax({
    mutateProperty: (property) => {
      property.canWrite = false
    },
  })
  assert.match(
    writeDrift.drift.readWrite,
    /web readonly=false vs avalonia canWrite=false/,
  )

  const readDrift = buildMax({
    mutateProperty: (property) => {
      property.canRead = false
    },
  })
  assert.match(readDrift.drift.readWrite, /avalonia canRead=false/)

  const nullabilityDrift = buildMax({
    mutateWeb: (property) => {
      property.nullable = true
    },
  })
  assert.match(
    nullabilityDrift.drift.nullability,
    /web nullable=true vs avalonia nullable=false/,
  )

  const unknownNullability = buildMax({
    mutateProperty: (property) => {
      delete property.nullable
    },
    mutateAvaloniaProperty: (property) => {
      delete property.nullable
    },
  })
  assert.equal(
    unknownNullability.drift.nullability,
    'avalonia nullability metadata unavailable',
  )
})

test('mapped input semantic mutations invalidate the committed surface hash', () => {
  const mutations = [
    (type) => {
      type.avaloniaProperties.find(
        (property) => property.name === 'Max',
      ).defaultValue = 100
    },
    (type) => {
      type.properties.find((property) => property.name === 'Max').required =
        true
    },
    (type) => {
      type.properties.find((property) => property.name === 'Max').canWrite =
        false
    },
    (type) => {
      type.avaloniaProperties.find(
        (property) => property.name === 'Max',
      ).nullable = true
    },
  ]
  for (const mutate of mutations) {
    const nextBaselines = clone(avaloniaBaselines)
    mutate(
      nextBaselines.avalonia.semanticTypes.find(
        (type) => type.name === 'FsusUI.Avalonia.Controls.FsusBadge',
      ),
    )
    assert.match(
      validateAvaloniaSurfaceRegistration({
        registry: committedRegistry,
        avaloniaBaselines: nextBaselines,
      }).errors.join('\n'),
      /ElBadge.*has stale public surface hash/,
    )
  }
})

test('real operation signatures are retained and fail closed when not comparable', () => {
  const registry = buildRegistry({
    vueBaseline,
    avaloniaBaseline: avaloniaBaselines.avalonia,
    avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
    avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
    semanticMemberBindings,
    gate,
  })
  const markdownEditor = registry.contracts.find(
    (contract) => contract.component.name === 'ElMarkdownEditor',
  )
  const navigate = markdownEditor.operations.find(
    (operation) => operation.semantic === 'search-navigate',
  )

  assert.equal(navigate.web.signature.status, 'callable')
  assert.deepEqual(navigate.web.signature.parameters, [
    {
      name: 'direction',
      type: '"next" | "previous"',
      optional: false,
      rest: false,
    },
  ])
  assert.equal(
    navigate.web.signature.returnType,
    '"success" | "deleted" | "stale" | "not-found" | "unsupported"',
  )
  assert.equal(navigate.avalonia.signature.parameters.length, 1)
  assert.equal(navigate.status, 'partial')
  assert.match(navigate.drift.operationSignature, /return type not comparable/)
  assert.match(
    navigate.drift.operationSignature,
    /parameter 1 type not comparable/,
  )
})

test('TypeScript checker extracts mapped exposed signatures and source mutations change the contract', () => {
  const sourceRelativePath =
    'vue/packages/components/markdown-editor/src/markdown-editor.vue'
  const source = fs.readFileSync(path.join(root, sourceRelativePath), 'utf8')
  const { descriptor } = parseSfc(source, { filename: sourceRelativePath })
  const scriptContent = descriptor.scriptSetup?.content
  assert.ok(scriptContent)

  const current = extractStructuredExposedSignatures({
    root,
    sourceRelativePath,
    scriptContent,
    memberNames: [
      'dispatchTransaction',
      'revealSourceRange',
      'searchNavigate',
      'searchUi',
    ],
  })
  assert.equal(
    current.get('dispatchTransaction').returnType,
    'MarkdownEditorDispatchResult',
  )
  assert.equal(
    current.get('searchNavigate').returnType,
    '"success" | "deleted" | "stale" | "not-found" | "unsupported"',
  )
  assert.doesNotMatch(
    current.get('revealSourceRange').parameters[1].type,
    /import\(/u,
  )
  assert.deepEqual(current.get('searchUi'), {
    kind: 'unknown',
    reason: 'exposed member must have exactly one callable signature',
    parameters: [],
    returnType: null,
  })

  const mutatedScript = scriptContent.replace(
    "return 'not-found' as const",
    'return false',
  )
  assert.notEqual(mutatedScript, scriptContent)
  const mutated = extractStructuredExposedSignatures({
    root,
    sourceRelativePath,
    scriptContent: mutatedScript,
    memberNames: ['searchNavigate'],
  }).get('searchNavigate')
  assert.match(mutated.returnType, /false/u)

  const mutatedBaseline = clone(vueBaseline)
  const exposed = mutatedBaseline.components
    .find((component) => component.name === 'ElMarkdownEditor')
    .semantic.exposed.find((member) => member.name === 'searchNavigate')
  Object.assign(exposed, mutated)
  const navigate = buildRegistry({
    vueBaseline: mutatedBaseline,
    avaloniaBaseline: avaloniaBaselines.avalonia,
    avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
    avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
    semanticMemberBindings,
    gate,
  })
    .contracts.find(
      (contract) => contract.component.name === 'ElMarkdownEditor',
    )
    .operations.find((operation) => operation.semantic === 'search-navigate')
  assert.match(
    navigate.drift.operationSignature,
    /return type mismatch: web boolean.* vs avalonia FsusMarkdownSearchNavigationResult/u,
  )
})

test('real baseline mutations expose operation parameter drift', () => {
  const buildWithMutation = (methodName, mutate) => {
    const avaloniaBaseline = clone(avaloniaBaselines.avalonia)
    const markdownEditor = avaloniaBaseline.semanticTypes.find(
      (type) => type.name === 'FsusUI.Avalonia.Controls.FsusMarkdownEditor',
    )
    const method = markdownEditor.methods.find(
      (candidate) => candidate.name === methodName,
    )
    mutate(method)
    return buildRegistry({
      vueBaseline,
      avaloniaBaseline,
      avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
      avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
      semanticMemberBindings,
      gate,
    }).contracts.find(
      (contract) => contract.component.name === 'ElMarkdownEditor',
    )
  }

  const countDrift = buildWithMutation('NavigateSearch', (method) => {
    method.parameters.push({
      name: 'wrap',
      type: 'System.Boolean',
      optional: true,
    })
  }).operations.find((operation) => operation.semantic === 'search-navigate')
  assert.match(
    countDrift.drift.operationSignature,
    /parameter count mismatch: web 1 vs avalonia 2/,
  )

  const optionalityDrift = buildWithMutation('NavigateSearch', (method) => {
    method.parameters[0].optional = true
  }).operations.find((operation) => operation.semantic === 'search-navigate')
  assert.match(
    optionalityDrift.drift.operationSignature,
    /parameter 1 optionality mismatch: web false vs avalonia true/,
  )

  const orderDrift = buildWithMutation('RevealHeading', (method) => {
    method.parameters.reverse()
  }).operations.find((operation) => operation.semantic === 'reveal-heading')
  assert.match(
    orderDrift.drift.operationSignature,
    /parameter 1 type mismatch: web string vs avalonia number/,
  )

  const typeDrift = buildWithMutation('RevealHeading', (method) => {
    method.parameters[0].type = 'System.Boolean'
  }).operations.find((operation) => operation.semantic === 'reveal-heading')
  assert.match(
    typeDrift.drift.operationSignature,
    /parameter 1 type mismatch: web string vs avalonia boolean/,
  )
})

test('real mapped event payload shapes fail closed on field drift', () => {
  const buildWithBaselines = (
    nextVueBaseline = vueBaseline,
    nextAvaloniaBaseline = avaloniaBaselines.avalonia,
  ) =>
    buildRegistry({
      vueBaseline: nextVueBaseline,
      avaloniaBaseline: nextAvaloniaBaseline,
      avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
      avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
      semanticMemberBindings,
      gate,
    }).contracts.find(
      (contract) => contract.component.name === 'ElMarkdownEditor',
    )
  const mappedOutputs = buildWithBaselines().outputs.filter(
    (output) => output.bindingBasis === 'explicit-semantic',
  )
  assert.deepEqual(
    mappedOutputs.map((output) => [output.semantic, output.status]),
    [
      ['history-change', 'partial'],
      ['selection-change', 'partial'],
      ['transaction', 'partial'],
    ],
  )

  const missingField = clone(vueBaseline)
  const missingHistoryShape = missingField.components
    .find((component) => component.name === 'ElMarkdownEditor')
    .semantic.emits.find((emit) => emit.name === 'history-change')
    .payload[0].shape
  missingHistoryShape.fields = missingHistoryShape.fields.filter(
    (field) => field.name !== 'canRedo',
  )
  const missingFieldDrift = buildWithBaselines(missingField).outputs.find(
    (output) => output.semantic === 'history-change',
  )
  assert.match(
    missingFieldDrift.drift.eventPayload,
    /extra avalonia field CanRedo/,
  )

  const nullableField = clone(vueBaseline)
  nullableField.components
    .find((component) => component.name === 'ElMarkdownEditor')
    .semantic.emits.find((emit) => emit.name === 'history-change')
    .payload[0].shape.fields.find(
      (field) => field.name === 'redoDepth',
    ).nullable = true
  const nullableDrift = buildWithBaselines(nullableField).outputs.find(
    (output) => output.semantic === 'history-change',
  )
  assert.match(
    nullableDrift.drift.eventPayload,
    /field redoDepth nullability mismatch: web true vs avalonia false/,
  )

  const avaloniaTypeDrift = clone(avaloniaBaselines.avalonia)
  avaloniaTypeDrift.semanticTypes
    .find(
      (type) =>
        type.name === 'FsusUI.Avalonia.Controls.FsusMarkdownEditorHistoryState',
    )
    .properties.find((property) => property.name === 'RedoDepth').type =
    'System.String'
  const typeDrift = buildWithBaselines(
    vueBaseline,
    avaloniaTypeDrift,
  ).outputs.find((output) => output.semantic === 'history-change')
  assert.match(
    typeDrift.drift.eventPayload,
    /field redoDepth type mismatch: web number vs avalonia string/,
  )

  const unknownShape = clone(vueBaseline)
  unknownShape.components
    .find((component) => component.name === 'ElMarkdownEditor')
    .semantic.emits.find(
      (emit) => emit.name === 'history-change',
    ).payload[0].shape = {
    kind: 'unknown',
    type: 'RecursivePayload',
    reason: 'recursive payload type',
  }
  const unknownDrift = buildWithBaselines(unknownShape).outputs.find(
    (output) => output.semantic === 'history-change',
  )
  assert.match(
    unknownDrift.drift.eventPayload,
    /web payload shape unavailable: recursive payload type/,
  )
})

test('real Vue source payload type mutation reaches the comparator', () => {
  const entryRelativePath =
    'vue/packages/components/markdown-editor/src/markdown-editor.ts'
  const transactionRelativePath =
    'vue/packages/components/markdown-editor/src/markdown-editor-transaction.ts'
  const entrySource = fs.readFileSync(
    path.join(root, entryRelativePath),
    'utf8',
  )
  const transactionSource = fs.readFileSync(
    path.join(root, transactionRelativePath),
    'utf8',
  )
  const sourceFile = ts.createSourceFile(
    entryRelativePath,
    entrySource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  let emitsObject = null
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === 'markdownEditorEmits' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      emitsObject = node.initializer
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  assert.ok(emitsObject)

  const mutatedSource = transactionSource.replace(
    'readonly redoDepth: number',
    'readonly redoDepth: string',
  )
  assert.notEqual(mutatedSource, transactionSource)
  const extracted = extractStructuredEmitPayloads({
    root,
    sourceRelativePath: entryRelativePath,
    objectStart: emitsObject.getStart(sourceFile),
    objectEnd: emitsObject.end,
    eventNames: ['history-change'],
    sourceOverrides: new Map([[transactionRelativePath, mutatedSource]]),
  }).get('history-change')
  const redoDepth = extracted.parameters[0].shape.fields.find(
    (field) => field.name === 'redoDepth',
  )
  assert.equal(redoDepth.type, 'string')

  const mutatedBaseline = clone(vueBaseline)
  const history = mutatedBaseline.components
    .find((component) => component.name === 'ElMarkdownEditor')
    .semantic.emits.find((emit) => emit.name === 'history-change')
  history.payload = extracted.parameters
  const output = buildRegistry({
    vueBaseline: mutatedBaseline,
    avaloniaBaseline: avaloniaBaselines.avalonia,
    avaloniaThemesBaseline: avaloniaBaselines.avaloniaThemes,
    avaloniaIconsBaseline: avaloniaBaselines.avaloniaIcons,
    semanticMemberBindings,
    gate,
  })
    .contracts.find(
      (contract) => contract.component.name === 'ElMarkdownEditor',
    )
    .outputs.find((candidate) => candidate.semantic === 'history-change')
  assert.match(
    output.drift.eventPayload,
    /field redoDepth type mismatch: web string vs avalonia number/,
  )
})

for (const mutation of mutations) {
  test(`mutation fixture kills ${mutation.name}`, () => {
    const mutated = applyMutation(validRegistry, mutation)
    const errors = validateRegistry(mutated, gate)
    const message = errors.join('\n')
    assert.ok(
      message.includes(mutation.expectError),
      `expected ${JSON.stringify(mutation.expectError)} in errors:\n${message}`,
    )
  })
}
