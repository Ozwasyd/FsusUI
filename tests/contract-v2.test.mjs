import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
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

  const unresolvedConstants = committedRegistry.contracts.flatMap(
    (contract) =>
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
