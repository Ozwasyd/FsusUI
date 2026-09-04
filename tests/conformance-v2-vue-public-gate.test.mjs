import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { validateVuePublicCoverage } from '../scripts/conformance-v2-vue-public-gate.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))

const baseline = readJson('spec/baselines/vue-current.json')
const registry = readJson('spec/components/contracts/v2/contract-v2.json')

const errorsFor = ({
  mutatedBaseline = baseline,
  mutatedRegistry = registry,
}) =>
  validateVuePublicCoverage({
    baseline: mutatedBaseline,
    registry: mutatedRegistry,
  }).errors.join('\n')

test('real Vue baseline and Contract V2 have complete public-member coverage', () => {
  const result = validateVuePublicCoverage({ baseline, registry })
  const expectedMembers = baseline.components.reduce(
    (total, component) =>
      total +
      (component.semantic?.props?.length ?? 0) +
      (component.emits?.length ?? 0) +
      (component.exposed?.length ?? 0) +
      (component.slots?.length ?? 0),
    0,
  )
  const expectedWebOnlyMembers = baseline.components
    .filter((component) => component.classification === 'web-only')
    .reduce(
      (total, component) =>
        total +
        (component.semantic?.props?.length ?? 0) +
        (component.emits?.length ?? 0) +
        (component.exposed?.length ?? 0) +
        (component.slots?.length ?? 0),
      0,
    )
  assert.deepEqual(result.errors, [])
  assert.equal(result.auditedComponents, baseline.components.length)
  assert.equal(result.auditedMembers, expectedMembers)
  assert.equal(result.webOnlyMembers, expectedWebOnlyMembers)
})

test('a real baseline member addition fails Vue public coverage', () => {
  const addedBaselineMember = clone(baseline)
  addedBaselineMember.components
    .find((component) => component.name === 'ElButton')
    .semantic.props.push({
      name: 'mutationOnlyProp',
      type: 'string',
      required: false,
      readonly: false,
      nullable: false,
    })
  assert.match(
    errorsFor({ mutatedBaseline: addedBaselineMember }),
    /ElButton input mutationOnlyProp is missing from Contract V2/,
  )
})

test('a real registry member deletion fails Vue public coverage', () => {
  const deletedRegistryMember = clone(registry)
  const deletedInputs = deletedRegistryMember.contracts.find(
    (contract) => contract.component.name === 'ElButton',
  ).inputs
  deletedInputs.splice(
    deletedInputs.findIndex((member) => member.name === 'disabled'),
    1,
  )
  assert.match(
    errorsFor({ mutatedRegistry: deletedRegistryMember }),
    /ElButton input disabled is missing from Contract V2/,
  )
})

test('a real registry member rename fails Vue public coverage', () => {
  const renamedRegistryMember = clone(registry)
  renamedRegistryMember.contracts
    .find((contract) => contract.component.name === 'ElButton')
    .inputs.find((member) => member.name === 'disabled').name =
    'mutationRenamed'
  assert.match(
    errorsFor({ mutatedRegistry: renamedRegistryMember }),
    /ElButton Contract V2 has extra input mutationRenamed/,
  )
})

test('a real registry member kind drift fails Vue public coverage', () => {
  const wrongKind = clone(registry)
  wrongKind.contracts
    .find((contract) => contract.component.name === 'ElButton')
    .inputs.find((member) => member.name === 'disabled').kind = 'output'
  assert.match(
    errorsFor({ mutatedRegistry: wrongKind }),
    /ElButton input disabled has kind output, expected input/,
  )
})

test('a real registry cross-kind duplicate fails Vue public coverage', () => {
  const duplicateAcrossKind = clone(registry)
  const button = duplicateAcrossKind.contracts.find(
    (contract) => contract.component.name === 'ElButton',
  )
  const crossKindMember = clone(
    button.inputs.find((member) => member.name === 'loading'),
  )
  crossKindMember.kind = 'operation'
  button.operations.push(crossKindMember)
  assert.match(
    errorsFor({ mutatedRegistry: duplicateAcrossKind }),
    /ElButton Contract V2 has extra operation loading/,
  )
})

test('a real registry same-kind duplicate fails Vue public coverage', () => {
  const duplicateMember = clone(registry)
  const button = duplicateMember.contracts.find(
    (contract) => contract.component.name === 'ElButton',
  )
  button.inputs.push(
    clone(button.inputs.find((member) => member.name === 'loading')),
  )
  assert.match(
    errorsFor({ mutatedRegistry: duplicateMember }),
    /ElButton Contract V2 has duplicate input loading/,
  )
})

test('a real registry duplicate component fails Vue public coverage', () => {
  const duplicateComponent = clone(registry)
  duplicateComponent.contracts.push(
    clone(
      duplicateComponent.contracts.find(
        (contract) => contract.component.name === 'ElButton',
      ),
    ),
  )
  assert.match(
    errorsFor({ mutatedRegistry: duplicateComponent }),
    /Contract V2 has duplicate component ElButton/,
  )
})

test('a real web-only status drift fails Vue public coverage', () => {
  const webOnlyDrift = clone(registry)
  const webOnlyContract = webOnlyDrift.contracts.find(
    (contract) => contract.component.classification === 'web-only',
  )
  const webOnlyMember = [
    ...webOnlyContract.inputs,
    ...webOnlyContract.outputs,
    ...webOnlyContract.operations,
    ...webOnlyContract.contentRegions,
  ][0]
  webOnlyMember.status = 'missing'
  assert.match(
    errorsFor({ mutatedRegistry: webOnlyDrift }),
    /must be uniquely registered as web-only, got missing/,
  )
})
