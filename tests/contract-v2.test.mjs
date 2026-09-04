import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
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
