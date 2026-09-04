import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'
import {
  buildRegistry,
  validateRegistry,
  validateSemanticMemberBindings,
  AVALONIA_SEMANTIC_PATHS,
  MARKDOWN_EDITOR_GATE_PATH,
  CONTRACT_V2_REGISTRY_PATH,
  SEMANTIC_MEMBER_BINDINGS_PATH,
  VUE_BASELINE_PATH,
} from '../scripts/contract-v2.mjs'
import { extractStructuredEmitPayloads } from '../scripts/vue-structured-emit-payload.mjs'

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
const avaloniaBaselines = Object.fromEntries(
  Object.entries(AVALONIA_SEMANTIC_PATHS).map(([key, relativePath]) => [
    key,
    JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')),
  ]),
)
const semanticMemberBindings = JSON.parse(
  fs.readFileSync(path.join(root, SEMANTIC_MEMBER_BINDINGS_PATH), 'utf8'),
)

const clone = (value) => JSON.parse(JSON.stringify(value))

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

  assert.deepEqual(navigate.web.signature.parameters, [
    {
      name: 'direction',
      type: "'next' | 'previous'",
      optional: false,
      rest: false,
    },
  ])
  assert.equal(navigate.avalonia.signature.parameters.length, 1)
  assert.equal(navigate.status, 'partial')
  assert.match(navigate.drift.operationSignature, /web return type unavailable/)
  assert.match(
    navigate.drift.operationSignature,
    /parameter 1 type not comparable/,
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
