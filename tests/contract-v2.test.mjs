import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  compareMembers,
  validateRegistry,
  MARKDOWN_EDITOR_GATE_PATH,
  CONTRACT_V2_REGISTRY_PATH,
} from '../scripts/contract-v2.mjs'

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

const clone = (value) => JSON.parse(JSON.stringify(value))

test('optional Vue absence matches nullable Avalonia inputs', () => {
  const optional = compareMembers({
    kind: 'input',
    web: {
      categories: ['function'],
      nullable: false,
      required: false,
    },
    avalonia: { categories: ['function'], nullable: true },
  })
  assert.equal(optional.compatible, true)

  const required = compareMembers({
    kind: 'input',
    web: {
      categories: ['function'],
      nullable: false,
      required: true,
    },
    avalonia: { categories: ['function'], nullable: true },
  })
  assert.equal(required.compatible, false)
  assert.match(required.drift.nullability, /web nullable=false/u)
})

test('Vue literal defaults fail closed when native default evidence is missing', () => {
  const comparison = compareMembers({
    kind: 'input',
    web: {
      categories: ['number'],
      nullable: false,
      required: false,
      default: { kind: 'literal', value: 50 },
    },
    avalonia: { categories: ['number'], nullable: false },
  })
  assert.equal(comparison.compatible, false)
  assert.match(comparison.drift.default, /avalonia default missing/u)
})

test('Avalonia semantic nullability preserves non-null Table V2 collections', () => {
  const table = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-table-v2',
  )
  for (const name of ['columns', 'data']) {
    const input = table.inputs.find((member) => member.name === name)
    assert.equal(input.avalonia?.nullable, false)
    assert.equal(input.status, 'aligned-candidate')
  }
})

test('Vue semantic extraction resolves nested imported prop spreads', () => {
  const table = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-table-v2',
  )
  const data = table.inputs.find((member) => member.name === 'data')
  assert.equal(data.web.runtimeType, 'Array')
  assert.equal(data.web.semanticType, 'any[]')
  assert.equal(data.status, 'aligned-candidate')
})

test('Vue semantic extraction resolves imported prop member descriptors', () => {
  const table = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-table-v2',
  )
  for (const name of ['estimatedRowHeight', 'onRowsRendered', 'onScroll']) {
    const input = table.inputs.find((member) => member.name === name)
    assert.notEqual(input.web.runtimeType, null)
    assert.equal(input.status, 'aligned-candidate')
  }
})

test('Vue semantic extraction resolves imported runtime constants', () => {
  const table = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-table-v2',
  )
  const input = table.inputs.find((member) => member.name === 'expandColumnKey')
  assert.equal(input.web.runtimeType, 'String')
  assert.equal(input.status, 'aligned-candidate')
})

test('Table V2 explicit input bindings reference real native members', () => {
  const table = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-table-v2',
  )
  const expected = new Map([
    ['cache', 'Overscan'],
    ['height', 'ViewportHeight'],
    ['maxHeight', 'ViewportMaxHeight'],
    ['width', 'ViewportWidth'],
  ])
  for (const [name, counterpart] of expected) {
    const input = table.inputs.find((member) => member.name === name)
    assert.equal(input.avalonia?.member, counterpart)
    assert.equal(input.status, 'aligned-candidate')
  }
})

test('Table V2 header height binds scalar and array paths with the exact default', () => {
  const table = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-table-v2',
  )
  const headerHeight = table.inputs.find(
    (member) => member.name === 'headerHeight',
  )
  assert.deepEqual(headerHeight.web.categories, ['number', 'array'])
  assert.equal(headerHeight.web.default.value, 50)
  assert.equal(headerHeight.avalonia.member, 'HeaderHeight')
  assert.equal(headerHeight.avalonia.defaultValue, 50)
  assert.deepEqual(headerHeight.avalonia.alternateMembers, [
    {
      member: 'HeaderHeights',
      categories: ['array'],
      type: 'System.Collections.ObjectModel.Collection<System.Double>',
      nullable: false,
    },
  ])
  assert.equal(headerHeight.status, 'aligned-candidate')
})

test('Table V2 scoped regions bind exact extracted and native payloads', () => {
  const table = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-table-v2',
  )
  const expected = new Map([
    ['header', ['cells', 'columns', 'headerIndex']],
    [
      'header-cell',
      ['column', 'columnIndex', 'columns', 'headerIndex', 'style'],
    ],
    [
      'row',
      [
        'cells',
        'columns',
        'depth',
        'isScrolling',
        'rowData',
        'rowIndex',
        'style',
      ],
    ],
  ])
  for (const [name, payload] of expected) {
    const region = table.contentRegions.find((member) => member.name === name)
    assert.equal(region.scoped, true)
    assert.deepEqual([...region.web.extractedPayload].sort(), payload)
    assert.deepEqual([...region.avalonia.payload].sort(), payload)
    assert.equal(region.status, 'aligned-candidate')
  }
})

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
  const errors = validateRegistry(committedRegistry, gate)
  assert.deepEqual(errors, [])
})

test('consumer routing binds every exact production contract once', () => {
  const contractIds = committedRegistry.contracts
    .map((contract) => contract.id)
    .sort()
  const bindingIds = Object.keys(
    committedRegistry.consumerBindings.byContract,
  ).sort()
  assert.deepEqual(bindingIds, contractIds)
  assert.deepEqual(
    committedRegistry.consumerBindings.byContract['component-v2.el-check-tag'],
    { releaseFamily: 'selection', galleryRoute: 'selection' },
  )
})

test('consumer routing mutations fail closed', () => {
  const deleted = clone(committedRegistry)
  delete deleted.consumerBindings.byContract['component-v2.el-check-tag']
  assert.match(
    validateRegistry(deleted, gate).join('\n'),
    /bind every exact contract id once/u,
  )

  const wrongRoute = clone(committedRegistry)
  wrongRoute.consumerBindings.byContract[
    'component-v2.el-check-tag'
  ].galleryRoute = 'button'
  assert.match(
    validateRegistry(wrongRoute, gate).join('\n'),
    /component-v2\.el-check-tag consumer binding drifted/u,
  )

  const unknownRoute = clone(committedRegistry)
  unknownRoute.consumerBindings.byContract[
    'component-v2.el-check-tag'
  ].galleryRoute = 'unknown-route'
  assert.match(
    validateRegistry(unknownRoute, gate).join('\n'),
    /component-v2\.el-check-tag consumer binding drifted|unknown Gallery route/u,
  )

  const unknownContract = clone(committedRegistry)
  unknownContract.consumerBindings.byContract['component-v2.el-unknown'] = {
    releaseFamily: 'selection',
    galleryRoute: 'selection',
  }
  assert.match(
    validateRegistry(unknownContract, gate).join('\n'),
    /bind every exact contract id once/u,
  )
})

test('public compatibility aliases collapse into one source-owned contract', () => {
  const aliases = committedRegistry.publicExportMap.filter(
    (entry) => entry.role === 'alias',
  )
  assert.equal(aliases.length, 50)
  assert.equal(committedRegistry.publicExportMap.length, 224)
  assert.equal(committedRegistry.publicValueBindings.length, 4)
  assert.equal(committedRegistry.contracts.length, 174)

  const collectionSummary = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-collection-summary',
  )
  assert.deepEqual(collectionSummary.component.exports, [
    'ElCollectionSummary',
    'FsusCollectionSummary',
  ])
  assert.equal(
    committedRegistry.contracts.some(
      (contract) => contract.id === 'component-v2.fsus-collection-summary',
    ),
    false,
  )
})

test('Table V2 enums and renderer sentinel retain explicit public value status', () => {
  assert.deepEqual(
    committedRegistry.publicValueBindings.map(
      ({ name, kind, status, avalonia }) => ({
        name,
        kind,
        status,
        avaloniaType: avalonia?.type ?? null,
      }),
    ),
    [
      {
        name: 'TableV2Alignment',
        kind: 'enum',
        status: 'partial',
        avaloniaType: 'FsusUI.Avalonia.Controls.FsusLayoutAlignment',
      },
      {
        name: 'TableV2FixedDir',
        kind: 'enum',
        status: 'partial',
        avaloniaType: 'FsusUI.Avalonia.Controls.FsusDataTableFixedColumn',
      },
      {
        name: 'TableV2Placeholder',
        kind: 'sentinel',
        status: 'web-only',
        avaloniaType: null,
      },
      {
        name: 'TableV2SortOrder',
        kind: 'enum',
        status: 'partial',
        avaloniaType: 'FsusUI.Avalonia.Controls.FsusSortDirection',
      },
    ],
  )
})

test('public value binding fails closed when an enum member is unmapped', () => {
  const mutated = clone(committedRegistry)
  delete mutated.publicValueBindings.find(
    (binding) => binding.name === 'TableV2FixedDir',
  ).valueMap.RIGHT
  assert.match(
    validateRegistry(mutated, gate).join('\n'),
    /public value TableV2FixedDir value map does not cover every Web enum member/u,
  )
})

test('public value web-only exception requires review metadata', () => {
  const mutated = clone(committedRegistry)
  delete mutated.publicValueBindings.find(
    (binding) => binding.name === 'TableV2Placeholder',
  ).governance.reviewedAt
  assert.match(
    validateRegistry(mutated, gate).join('\n'),
    /public value TableV2Placeholder web-only exception is not reviewed/u,
  )
})

test('Web-only components project complete reviewed platform exceptions', () => {
  const expected = new Set([
    'component-v2.el-collapse-transition',
    'component-v2.el-popper',
    'component-v2.el-popper-arrow',
    'component-v2.el-popper-content',
    'component-v2.el-popper-trigger',
  ])
  const actual = committedRegistry.contracts.filter(
    (contract) => contract.component.exportStatus === 'web-only',
  )
  assert.deepEqual(
    new Set(actual.map((contract) => contract.id)),
    expected,
  )
  for (const contract of actual) {
    assert.equal(contract.bindings.avalonia.status, 'unbound', contract.id)
    for (const field of [
      'reason',
      'alternative',
      'owner',
      'testPolicy',
      'reviewPolicy',
      'reviewedAt',
      'authority',
      'reviewAfter',
    ]) {
      assert.ok(contract.platformException[field], `${contract.id} ${field}`)
    }
  }
})

test('Web-only component exception mutation fails closed', () => {
  const mutated = clone(committedRegistry)
  const popper = mutated.contracts.find(
    (contract) => contract.id === 'component-v2.el-popper',
  )
  delete popper.platformException.testPolicy
  assert.match(
    validateRegistry(mutated, gate).join('\n'),
    /component-v2\.el-popper platformException missing testPolicy/u,
  )

  const fakeNative = clone(committedRegistry)
  const arrow = fakeNative.contracts.find(
    (contract) => contract.id === 'component-v2.el-popper-arrow',
  )
  arrow.component.exportStatus = 'missing'
  assert.match(
    validateRegistry(fakeNative, gate).join('\n'),
    /component-v2\.el-popper-arrow non-web-only contract must not declare platformException/u,
  )
})

test('public export map fails closed when an alias is removed', () => {
  const mutated = clone(committedRegistry)
  mutated.publicExportMap = mutated.publicExportMap.filter(
    (entry) => entry.name !== 'FsusCollectionSummary',
  )
  assert.match(
    validateRegistry(mutated, gate).join('\n'),
    /component-v2\.el-collection-summary public export map does not match component exports/u,
  )
})

test('content regions bind only to real Avalonia content properties', () => {
  const buttonGroup = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-button-group',
  )
  assert.deepEqual(
    buttonGroup.contentRegions.map(({ name, status, avalonia }) => ({
      name,
      status,
      member: avalonia?.member ?? null,
    })),
    [{ name: 'default', status: 'aligned-candidate', member: 'Children' }],
  )

  const button = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-button',
  )
  assert.deepEqual(
    button.contentRegions.map(({ name, status, avalonia }) => ({
      name,
      status,
      member: avalonia?.member ?? null,
    })),
    [
      { name: 'default', status: 'aligned-candidate', member: 'Content' },
      { name: 'icon', status: 'missing', member: null },
      { name: 'loading', status: 'missing', member: null },
    ],
  )
})

test('container, button group, and visual hidden keep explicit truthful bindings', () => {
  const expected = new Map([
    [
      'component-v2.el-container',
      { content: 'Children', missingInput: 'direction' },
    ],
    ['component-v2.el-aside', { content: 'Content', missingInput: 'width' }],
    ['component-v2.el-header', { content: 'Content', missingInput: 'height' }],
    ['component-v2.el-footer', { content: 'Content', missingInput: 'height' }],
    ['component-v2.el-main', { content: 'Content', missingInput: null }],
    [
      'component-v2.el-button-group',
      { content: 'Children', missingInput: null },
    ],
    [
      'component-v2.el-visually-hidden',
      { content: 'Content', missingInput: 'style' },
    ],
  ])
  for (const [id, expectation] of expected) {
    const contract = committedRegistry.contracts.find(
      (candidate) => candidate.id === id,
    )
    assert.ok(contract, `${id} missing`)
    assert.equal(
      contract.contentRegions[0]?.avalonia?.member,
      expectation.content,
    )
    assert.equal(contract.contentRegions[0]?.status, 'aligned-candidate')
    if (expectation.missingInput) {
      assert.equal(
        contract.inputs.find((input) => input.name === expectation.missingInput)
          ?.status,
        'missing',
      )
    }
  }

  assert.deepEqual(
    committedRegistry.componentMap.find(
      (entry) => entry.vue.name === 'ElVisuallyHidden',
    ),
    {
      vue: { name: 'ElVisuallyHidden', module: 'visual-hidden', aliases: [] },
      avalonia: {
        type: 'FsusUI.Avalonia.Controls.FsusVisualHidden',
        packageId: 'avalonia',
      },
      basis: 'explicit-component-binding',
    },
  )
})

test('explicit divergent names and canonical records bind real native surfaces', () => {
  const expected = new Map([
    ['component-v2.dynamic-size-grid', 'FsusUI.Avalonia.Controls.FsusTableV2'],
    [
      'component-v2.dynamic-size-list',
      'FsusUI.Avalonia.Controls.FsusVirtualList',
    ],
    [
      'component-v2.el-conversation-list-item',
      'FsusUI.Avalonia.Controls.FsusConversationListItem',
    ],
    [
      'component-v2.el-diagnostics-item',
      'FsusUI.Avalonia.Controls.FsusDiagnosticsItem',
    ],
    ['component-v2.el-empty-state', 'FsusUI.Avalonia.Controls.FsusEmpty'],
    [
      'component-v2.el-markdown-renderer',
      'FsusUI.Avalonia.Controls.FsusTextViewer',
    ],
    [
      'component-v2.el-metadata-item',
      'FsusUI.Avalonia.Controls.FsusSettingsMetadataItem',
    ],
    [
      'component-v2.el-table-column',
      'FsusUI.Avalonia.Controls.FsusDataTableColumn',
    ],
    [
      'component-v2.fixed-size-grid',
      'FsusUI.Avalonia.Controls.FsusTableV2',
    ],
  ])
  for (const [id, nativeType] of expected) {
    const contract = committedRegistry.contracts.find(
      (candidate) => candidate.id === id,
    )
    assert.equal(contract.bindings.avalonia.status, 'bound', id)
    assert.equal(contract.bindings.avalonia.type, nativeType, id)
    assert.notEqual(contract.component.exportStatus, 'aligned-candidate', id)
  }
})

test('zero-denominator and rejected candidate surfaces stay fail-closed', () => {
  for (const id of [
    'component-v2.dynamic-size-grid',
    'component-v2.dynamic-size-list',
    'component-v2.fixed-size-grid',
    'component-v2.fixed-size-list',
  ]) {
    const contract = committedRegistry.contracts.find(
      (candidate) => candidate.id === id,
    )
    assert.equal(contract.coverage.total, 0, id)
    assert.equal(contract.component.exportStatus, 'partial', id)
  }

  for (const id of [
    'component-v2.common-picker',
    'component-v2.el-empty-selection-state',
    'component-v2.el-task-page-header',
    'component-v2.time-pick-panel',
  ]) {
    const contract = committedRegistry.contracts.find(
      (candidate) => candidate.id === id,
    )
    assert.equal(contract.bindings.avalonia.status, 'unbound', id)
    assert.equal(contract.component.exportStatus, 'missing', id)
  }
  const taskHeader = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-task-page-header',
  )
  assert.notEqual(
    taskHeader.bindings.avalonia.type,
    'FsusUI.Avalonia.Controls.FsusPageHeader',
  )
})

test('passive layout contracts govern keyboard and focus as not applicable', () => {
  for (const id of [
    'component-v2.el-main',
    'component-v2.el-space',
    'component-v2.el-auto-resizer',
  ]) {
    const contract = committedRegistry.contracts.find(
      (candidate) => candidate.id === id,
    )
    assert.deepEqual(contract.requirements.keyboard, [], id)
    assert.deepEqual(contract.requirements.focus, [], id)
    assert.equal(
      contract.requirementApplicability.keyboard.status,
      'not-applicable',
      id,
    )
    assert.equal(
      contract.requirementApplicability.focus.status,
      'not-applicable',
      id,
    )
    assert.equal(
      contract.requirementApplicability.keyboard.governance.owner,
      'FsusUI Core',
      id,
    )
  }
})

test('not-applicable requirement fails closed without governance', () => {
  const mutated = clone(committedRegistry)
  const main = mutated.contracts.find(
    (contract) => contract.id === 'component-v2.el-main',
  )
  delete main.requirementApplicability.keyboard.governance
  assert.match(
    validateRegistry(mutated, gate).join('\n'),
    /component-v2\.el-main requirements\.keyboard not-applicable missing governance/u,
  )
})

test('resolved Vue emits and exposed signatures own Contract V2 members', () => {
  const checkTag = committedRegistry.contracts.find(
    (contract) => contract.id === 'component-v2.el-check-tag',
  )
  assert.deepEqual(
    checkTag.outputs.map(({ name, web, avalonia, status }) => ({
      name,
      payload: web.payload,
      status,
      member: avalonia?.member ?? null,
      payloadMember: avalonia?.payloadMember ?? null,
    })),
    [
      {
        name: 'change',
        payload: [
          {
            name: 'value',
            type: 'boolean',
            optional: false,
            rest: false,
          },
        ],
        status: 'aligned-candidate',
        member: 'CheckedChanged',
        payloadMember: 'NewChecked',
      },
      {
        name: 'update:checked',
        payload: [
          {
            name: 'value',
            type: 'boolean',
            optional: false,
            rest: false,
          },
        ],
        status: 'aligned-candidate',
        member: 'CheckedChanged',
        payloadMember: 'NewChecked',
      },
    ],
  )

  const unresolvedConstants = committedRegistry.contracts.flatMap((contract) =>
    contract.outputs
      .map((output) => output.name)
      .filter((name) => /^\[.+\]$/u.test(name)),
  )
  assert.deepEqual(unresolvedConstants, [])
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
