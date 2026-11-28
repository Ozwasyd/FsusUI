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
const semanticMemberBindings = readJson(
  'spec/components/contracts/v2/semantic-member-bindings.json',
)

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
      ((component.semantic?.emits?.length ?? 0) ||
        (component.emits?.length ?? 0)) +
      ((component.semantic?.exposed?.length ?? 0) ||
        (component.exposed?.length ?? 0)) +
      (component.slots?.length ?? 0),
    0,
  )
  const componentLevelWebOnlyMembers = baseline.components
    .filter((component) => component.classification === 'web-only')
    .reduce(
      (total, component) =>
        total +
        (component.semantic?.props?.length ?? 0) +
        ((component.semantic?.emits?.length ?? 0) ||
          (component.emits?.length ?? 0)) +
        ((component.semantic?.exposed?.length ?? 0) ||
          (component.exposed?.length ?? 0)) +
        (component.slots?.length ?? 0),
      0,
    )
  const expectedWebOnlyMembers =
    componentLevelWebOnlyMembers + semanticMemberBindings.dispositions.length
  assert.deepEqual(result.errors, [])
  assert.equal(result.auditedComponents, baseline.components.length)
  assert.equal(result.auditedMembers, expectedMembers)
  assert.equal(result.webOnlyMembers, expectedWebOnlyMembers)
})

test('a real baseline member addition fails Vue public coverage', () => {
  const addedBaselineMember = clone(baseline)
  addedBaselineMember.components
    .find((component) => component.name === 'FsusButton')
    .semantic.props.push({
      name: 'mutationOnlyProp',
      type: 'string',
      required: false,
      readonly: false,
      nullable: false,
    })
  assert.match(
    errorsFor({ mutatedBaseline: addedBaselineMember }),
    /FsusButton input mutationOnlyProp is missing from Contract V2/,
  )
})

test('a real registry member deletion fails Vue public coverage', () => {
  const deletedRegistryMember = clone(registry)
  const deletedInputs = deletedRegistryMember.contracts.find(
    (contract) => contract.component.name === 'FsusButton',
  ).inputs
  deletedInputs.splice(
    deletedInputs.findIndex((member) => member.name === 'disabled'),
    1,
  )
  assert.match(
    errorsFor({ mutatedRegistry: deletedRegistryMember }),
    /FsusButton input disabled is missing from Contract V2/,
  )
})

test('a real registry member rename fails Vue public coverage', () => {
  const renamedRegistryMember = clone(registry)
  renamedRegistryMember.contracts
    .find((contract) => contract.component.name === 'FsusButton')
    .inputs.find((member) => member.name === 'disabled').name =
    'mutationRenamed'
  assert.match(
    errorsFor({ mutatedRegistry: renamedRegistryMember }),
    /FsusButton Contract V2 has extra input mutationRenamed/,
  )
})

test('a real registry member kind drift fails Vue public coverage', () => {
  const wrongKind = clone(registry)
  wrongKind.contracts
    .find((contract) => contract.component.name === 'FsusButton')
    .inputs.find((member) => member.name === 'disabled').kind = 'output'
  assert.match(
    errorsFor({ mutatedRegistry: wrongKind }),
    /FsusButton input disabled has kind output, expected input/,
  )
})

test('content-region compiler metadata drift fails Vue public coverage', () => {
  const mutatedBaseline = clone(baseline)
  const defaultRegion = mutatedBaseline.components
    .find((component) => component.name === 'FsusAutocomplete')
    .slots.find((slot) => slot.name === 'default')
  defaultRegion.payloadComplete = false
  assert.match(
    errorsFor({ mutatedBaseline }),
    /FsusAutocomplete contentRegion default stale compiler payloadComplete/,
  )

  const implicitAvalonia = clone(registry)
  const defaultContractRegion = implicitAvalonia.contracts
    .find((contract) => contract.component.name === 'FsusAutocomplete')
    .contentRegions.find((region) => region.name === 'default')
  defaultContractRegion.avalonia = { member: 'Content', content: true }
  assert.match(
    errorsFor({ mutatedRegistry: implicitAvalonia }),
    /claims an Avalonia content region without an explicit semantic binding/,
  )
})

test('enum values and deprecated compiler metadata drift fail Vue public coverage', () => {
  const enumValuesDrift = clone(baseline)
  enumValuesDrift.components
    .find((component) => component.name === 'FsusAffix')
    .semantic.props.find((prop) => prop.name === 'position')
    .values.push('left')
  assert.match(
    errorsFor({ mutatedBaseline: enumValuesDrift }),
    /FsusAffix input position stale compiler values/,
  )

  const deprecatedDrift = clone(baseline)
  const disabledProp = deprecatedDrift.components
    .find((component) => component.name === 'FsusButton')
    .semantic.props.find((prop) => prop.name === 'disabled')
  disabledProp.deprecated = true
  disabledProp.deprecationMessage = 'Mutated deprecation'
  const deprecatedErrors = errorsFor({ mutatedBaseline: deprecatedDrift })
  assert.match(
    deprecatedErrors,
    /FsusButton input disabled stale compiler deprecated/,
  )
  assert.match(
    deprecatedErrors,
    /FsusButton input disabled stale compiler deprecationMessage/,
  )
})

test('a real registry cross-kind duplicate fails Vue public coverage', () => {
  const duplicateAcrossKind = clone(registry)
  const button = duplicateAcrossKind.contracts.find(
    (contract) => contract.component.name === 'FsusButton',
  )
  const crossKindMember = clone(
    button.inputs.find((member) => member.name === 'loading'),
  )
  crossKindMember.kind = 'operation'
  button.operations.push(crossKindMember)
  assert.match(
    errorsFor({ mutatedRegistry: duplicateAcrossKind }),
    /FsusButton Contract V2 has extra operation loading/,
  )
})

test('a real registry same-kind duplicate fails Vue public coverage', () => {
  const duplicateMember = clone(registry)
  const button = duplicateMember.contracts.find(
    (contract) => contract.component.name === 'FsusButton',
  )
  button.inputs.push(
    clone(button.inputs.find((member) => member.name === 'loading')),
  )
  assert.match(
    errorsFor({ mutatedRegistry: duplicateMember }),
    /FsusButton Contract V2 has duplicate input loading/,
  )
})

test('a real registry duplicate component fails Vue public coverage', () => {
  const duplicateComponent = clone(registry)
  duplicateComponent.contracts.push(
    clone(
      duplicateComponent.contracts.find(
        (contract) => contract.component.name === 'FsusButton',
      ),
    ),
  )
  assert.match(
    errorsFor({ mutatedRegistry: duplicateComponent }),
    /Contract V2 has duplicate component FsusButton/,
  )
})

test('a real web-only status drift fails Vue public coverage', () => {
  const webOnlyBaseline = clone(baseline)
  const webOnlyRegistry = clone(registry)
  const targetComp = webOnlyBaseline.components.find(
    (component) => component.name === 'FsusButton',
  )
  targetComp.classification = 'web-only'
  const webOnlyContract = webOnlyRegistry.contracts.find(
    (contract) => contract.component.name === 'FsusButton',
  )
  webOnlyContract.component.classification = 'web-only'
  webOnlyContract.inputs[0].status = 'missing'
  assert.match(
    errorsFor({
      mutatedBaseline: webOnlyBaseline,
      mutatedRegistry: webOnlyRegistry,
    }),
    /must be uniquely registered as web-only, got missing/,
  )
})

test('a member-level web-only disposition cannot be synthesized in Contract V2', () => {
  const dispositionDrift = clone(registry)
  const member = dispositionDrift.contracts
    .find((contract) => contract.component.name === 'FsusMarkdownEditor')
    .inputs.find((input) => input.name === 'textareaId')
  delete member.dispositionBasis
  assert.match(
    errorsFor({ mutatedRegistry: dispositionDrift }),
    /claims web-only without an exact governed member disposition/u,
  )
})
