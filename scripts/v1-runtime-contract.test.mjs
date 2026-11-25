import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  compareRuntimeContract,
  contractDigest,
  describeComponent,
  describeExports,
  describePackage,
  describeRuntimeEmits,
  describeRuntimeProps,
  v1RuntimeSchema,
} from './v1-runtime-contract.mjs'

const fixture = () => ({
  schema: v1RuntimeSchema,
  components: {
    ElTable: describeComponent(
      { props: { data: { type: Array, default: () => [] } } },
      'ElTable',
    ),
    ElSelectV2: describeComponent(
      {
        props: { modelValue: [String, Number] },
        emits: ['update:modelValue', 'change'],
      },
      'ElSelectV2',
    ),
  },
  exports: { ElTable: 'object', ElSelectV2: 'object' },
  installer: {
    components: ['ElSelectV2', 'ElTable'],
    directives: [],
    globals: {},
  },
  package: {
    exports: { '.': { import: './es/index.mjs' } },
    style: 'dist/fsus.css',
  },
})

test('identical contracts pass without changing the frozen authority', () => {
  const baseline = fixture()
  const before = JSON.stringify(baseline)
  assert.deepEqual(
    compareRuntimeContract(baseline, structuredClone(baseline)),
    [],
  )
  assert.equal(JSON.stringify(baseline), before)
})

for (const [label, mutate, diagnostic] of [
  [
    'Table prop removal',
    (next) => {
      next.components.ElTable.propCount = 0
    },
    'ElTable: propCount changed',
  ],
  [
    'SelectV2 model event removal',
    (next) => {
      next.components.ElSelectV2.emits = ['change']
    },
    'ElSelectV2: emits changed',
  ],
  [
    'default change',
    (next) => {
      next.components.ElTable.propDigest = contractDigest({ data: null })
    },
    'ElTable: propDigest changed',
  ],
  [
    'named export removal',
    (next) => {
      delete next.exports.ElTable
    },
    'exports: V1 contract changed',
  ],
  [
    'installer registration removal',
    (next) => {
      next.installer.components.pop()
    },
    'installer: V1 contract changed',
  ],
  [
    'stylesheet entry change',
    (next) => {
      next.package.style = 'dist/index.css'
    },
    'package: V1 contract changed',
  ],
  [
    'component removal',
    (next) => {
      delete next.components.ElTable
    },
    'ElTable: component export missing',
  ],
]) {
  test(`negative mutation: ${label} is rejected`, () => {
    const baseline = fixture()
    const next = structuredClone(baseline)
    mutate(next)
    assert.ok(compareRuntimeContract(baseline, next).includes(diagnostic))
  })
}

test('prop types preserve Boolean/String casting order', () => {
  assert.notEqual(
    contractDigest(describeRuntimeProps({ active: [Boolean, String] })),
    contractDigest(describeRuntimeProps({ active: [String, Boolean] })),
  )
})

test('requiredness, default absence and explicit undefined stay distinct', () => {
  const descriptions = [
    { value: { type: String } },
    { value: { type: String, default: undefined } },
    { value: { type: String, required: true } },
  ].map((props) => contractDigest(describeRuntimeProps(props)))
  assert.equal(new Set(descriptions).size, 3)
})

test('factories and validators are never invoked by inspection', () => {
  const fail = () => {
    throw new Error('must not run')
  }
  const result = describeRuntimeProps({
    value: { default: fail, validator: fail },
  })
  assert.deepEqual(result.value.default, { kind: 'factory', arity: 0 })
  assert.equal(result.value.validator, true)
})

test('unsupported or cyclic metadata fails closed', () => {
  const cyclic = {}
  cyclic.self = cyclic
  assert.throws(
    () => describeRuntimeProps({ value: { default: cyclic } }),
    /Cyclic/,
  )
  assert.throws(
    () => describeRuntimeProps({ value: { type: {} } }),
    /Unresolved/,
  )
  assert.throws(
    () => describeComponent({ mixins: [{}] }, 'Example'),
    /Inherited/,
  )
  assert.throws(() => describeComponent(undefined, 'Example'), /Missing/)
  assert.throws(() => describeRuntimeEmits(['change', undefined]), /Unresolved/)
  assert.throws(
    () => compareRuntimeContract({ schema: 'unknown' }, {}),
    /Unsupported/,
  )
})

test('declaration order does not change hashes, but special defaults do', () => {
  assert.equal(contractDigest({ b: 2, a: 1 }), contractDigest({ a: 1, b: 2 }))
  assert.deepEqual(describeRuntimeEmits(['change', 'change', 'blur']), [
    'blur',
    'change',
  ])
  const values = [undefined, null, 0, -0, NaN, Infinity, '0', false]
  assert.equal(
    new Set(
      values.map((value) =>
        contractDigest(describeRuntimeProps({ value: { default: value } })),
      ),
    ).size,
    values.length,
  )
})

test('version metadata is excluded without weakening package boundaries', () => {
  const first = {
    version: '1.0.0',
    exports: { '.': './index.js' },
    style: 'dist/fsus.css',
  }
  assert.deepEqual(
    describePackage(first),
    describePackage({ ...first, version: '2.0.0' }),
  )
  assert.notDeepEqual(
    describePackage(first),
    describePackage({ ...first, style: 'dist/index.css' }),
  )
  assert.deepEqual(describeExports({ Example: {}, install: () => {} }), {
    count: 2,
    digest: contractDigest({ Example: 'object', install: 'function' }),
  })
})

test('actual declaration mutations cannot hide behind a matching legacy inventory', () => {
  const original = fixture()
  const candidate = structuredClone(original)
  candidate.components.ElTable = describeComponent({ props: {} }, 'ElTable')
  candidate.components.ElSelectV2 = describeComponent(
    { props: { modelValue: [String, Number] }, emits: ['change'] },
    'ElSelectV2',
  )
  const failures = compareRuntimeContract(original, candidate)
  assert.ok(failures.includes('ElTable: propCount changed'))
  assert.ok(failures.includes('ElSelectV2: emits changed'))
})

test('export fingerprints catch removals and kind changes', () => {
  const original = describeExports({ ElTable: {}, install: () => {} })
  assert.notDeepEqual(original, describeExports({ install: () => {} }))
  assert.notDeepEqual(original, describeExports({ ElTable: {}, install: {} }))
})
