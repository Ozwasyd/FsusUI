import assert from 'node:assert/strict'
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { SourceMap } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { rollup } from 'rollup'
import vue from '@vitejs/plugin-vue'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import pluginModule from '../vue/internal/build/src/plugins/frozen-string-records.ts'

const { FrozenStringRecords } = pluginModule
const root = process.cwd()

const fixture = async (
  t,
  record,
  entry,
  { sfc = false, extra = {}, throws = false } = {},
) => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'fsus-frozen-records-'),
  )
  t.after(() => rm(directory, { recursive: true, force: true }))
  await symlink(
    path.join(root, 'node_modules'),
    path.join(directory, 'node_modules'),
  )
  const source = path.join(directory, 'source')
  await mkdir(source)
  const name = sfc ? 'entry.vue' : 'entry.js'
  const files = { 'record.js': record, [name]: entry, ...extra }
  await Promise.all(
    Object.entries(files).map(([name, code]) =>
      writeFile(path.join(source, name), code),
    ),
  )
  const outputs = []
  for (const optimized of [false, true]) {
    const bundle = await rollup({
      input: Object.keys(files).map((name) => path.join(source, name)),
      external: ['vue'],
      treeshake: false,
      plugins: [
        sfc && vue({ isProduction: false }),
        optimized && FrozenStringRecords(),
      ],
    })
    try {
      const outputDirectory = path.join(
        directory,
        optimized ? 'optimized' : 'original',
      )
      const result = await bundle.write({
        format: 'es',
        dir: outputDirectory,
        preserveModules: true,
        preserveModulesRoot: source,
        entryFileNames: '[name].mjs',
        sourcemap: true,
      })
      const entryName = sfc ? 'entry.vue' : 'entry'
      const code = await readFile(
        path.join(outputDirectory, `${entryName}.mjs`),
        'utf8',
      )
      const imported = async (url) => {
        try {
          return await import(url)
        } catch (error) {
          if (!throws) throw error
          return error
        }
      }
      const namespace = await imported(
        pathToFileURL(path.join(outputDirectory, `${entryName}.mjs`)),
      )
      const recordNamespace = await imported(
        pathToFileURL(path.join(outputDirectory, 'record.mjs')),
      )
      outputs.push({ code, namespace, recordNamespace, chunks: result.output })
    } finally {
      await bundle.close()
    }
  }
  return outputs
}

const frozen = `export const classes = Object.freeze({root: 'record-root', body: 'record-body'})`

test('folds actual immutable exports and Vue unref reads, retaining public records and maps', async (t) => {
  const entry = `/*! retained consumer license */
import { classes as surface } from './record.js'
import { unref as unwrap } from 'vue'
export const direct = surface.root
export const wrapped = unwrap(surface)['body']
export const sameRecord = surface
`
  const [original, optimized] = await fixture(t, frozen, entry)
  assert.equal(original.namespace.direct, optimized.namespace.direct)
  assert.equal(original.namespace.wrapped, optimized.namespace.wrapped)
  assert.equal(
    optimized.namespace.sameRecord,
    optimized.recordNamespace.classes,
  )
  assert.equal(Object.isFrozen(optimized.namespace.sameRecord), true)
  assert.deepEqual(
    Object.getOwnPropertyDescriptors(original.namespace.sameRecord),
    Object.getOwnPropertyDescriptors(optimized.namespace.sameRecord),
  )
  assert.equal(
    Object.getPrototypeOf(optimized.namespace.sameRecord),
    Object.prototype,
  )
  assert.match(optimized.code, /retained consumer license/u)
  assert.doesNotMatch(optimized.code, /surface\.root|unwrap\(surface\)/u)
  assert.match(optimized.code, /classes,\s*"record-root"/u)
  const chunk = optimized.chunks.find(
    (chunk) => chunk.type === 'chunk' && chunk.fileName === 'entry.mjs',
  )
  const offset = chunk.code.indexOf('"record-root"')
  const preceding = chunk.code.slice(0, offset).split('\n')
  const mapped = new SourceMap(chunk.map).findEntry(
    preceding.length - 1,
    preceding.at(-1).length,
  )
  assert.equal(mapped.originalLine, 3)
  assert.match(mapped.originalSource, /source\/entry\.js$/u)
})

test('uses the real SFC compiler and preserves rendered markup, component metadata and props', async (t) => {
  const sfc = `<script setup>
import { classes } from './record.js'
defineOptions({ name: 'FrozenRecordProbe' })
defineProps({ text: { type: String, required: true } })
</script>
<template><article :class="classes.root"><span :class="classes.body">{{ text }}</span></article></template>`
  const [original, optimized] = await fixture(t, frozen, sfc, { sfc: true })
  const first = original.namespace.default
  const second = optimized.namespace.default
  assert.equal(
    await renderToString(createSSRApp(second, { text: 'same <text>' })),
    await renderToString(createSSRApp(first, { text: 'same <text>' })),
  )
  assert.equal(second.name, first.name)
  assert.equal(second.__name, first.__name)
  assert.deepEqual(second.props, first.props)
  assert.equal(second.setup.length, first.setup.length)
  const compiled = optimized.chunks
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n')
  assert.match(compiled, /"record-root"/u)
  assert.doesNotMatch(compiled, /unref\(classes\)\.root/u)
})

for (const [name, record] of Object.entries({
  mutable: `export const classes = { root: 'record-root' }`,
  reassigned: `export let classes = Object.freeze({ root: 'record-root' })`,
  getter: `export const classes = Object.freeze({ get root() { return 'record-root' } })`,
  spread: `const data = {root: 'record-root'}; export const classes = Object.freeze({...data})`,
  prototype: `export const classes = Object.freeze({ __proto__: { __v_isRef: true, value: {root: 'ref-root'} }, root: 'record-root' })`,
  ref: `export const classes = Object.freeze({ __v_isRef: 'true', root: 'record-root' })`,
  unknownValue: `export const classes = Object.freeze({ root: String('record-root') })`,
  shadowedObject: `const Object = {freeze: (value) => value}; export const classes = Object.freeze({root: 'record-root'})`,
  evaluatedOwner: `eval(''); export const classes = Object.freeze({root: 'record-root'})`,
})) {
  test(`keeps ${name} owners unchanged`, async (t) => {
    const entry = `import { classes } from './record.js'; import { unref } from 'vue'; export const read = () => [classes.root, unref(classes).root]`
    const [original, optimized] = await fixture(t, record, entry)
    assert.equal(optimized.code, original.code)
    assert.deepEqual(optimized.namespace.read(), original.namespace.read())
  })
}

test('respects shadowing, eval, optional calls, computed keys, writes, deletes and assignment targets', async (t) => {
  for (const entry of [
    `import { classes } from './record.js'; export const read = (classes) => classes.root`,
    `import { classes } from './record.js'; import {unref} from 'vue'; export const read = (unref) => unref(classes).root`,
    `import { classes } from './record.js'; eval(''); export const read = () => classes.root`,
    `import { classes } from './record.js'; export const read = () => classes?.root`,
    `import { classes } from './record.js'; import {unref} from 'vue'; export const read = () => unref?.(classes).root`,
    `import { classes } from './record.js'; export const read = (key) => classes[key]`,
    `import { classes } from './record.js'; export const write = () => classes.root = 'other'`,
    `import { classes } from './record.js'; export const write = () => classes.root++`,
    `import { classes } from './record.js'; export const write = () => delete classes.root`,
    `import { classes } from './record.js'; export const write = () => ({a: classes.root} = {a: 'other'})`,
    `import { classes } from './record.js'; export const write = () => { for(classes.root of [1]){} }`,
  ]) {
    const [original, optimized] = await fixture(t, frozen, entry)
    assert.equal(optimized.code, original.code, entry)
    if (original.namespace.write) {
      assert.throws(() => original.namespace.write(), TypeError)
      assert.throws(() => optimized.namespace.write(), TypeError)
    }
  }
})

test('does not claim non-entry owner export names or optimize other output formats', async (t) => {
  const entry = `import { classes } from './record.js'; export const read = () => classes.root`
  const directory = await mkdtemp(path.join(os.tmpdir(), 'fsus-frozen-format-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await writeFile(path.join(directory, 'record.js'), frozen)
  await writeFile(path.join(directory, 'entry.js'), entry)
  for (const preserveModules of [false, true]) {
    const bundle = await rollup({
      input: path.join(directory, 'entry.js'),
      treeshake: false,
      plugins: [FrozenStringRecords()],
    })
    try {
      for (const format of ['es', 'cjs']) {
        const result = await bundle.generate({ format, preserveModules })
        assert.match(
          result.output
            .filter((chunk) => chunk.type === 'chunk')
            .map((chunk) => chunk.code)
            .join('\n'),
          /classes\.root/u,
        )
      }
    } finally {
      await bundle.close()
    }
  }
})

test('retains initialization errors in a real cyclic module graph', async (t) => {
  const record = `import { read } from './entry.js'; read(); export const classes = Object.freeze({root: 'record-root'})`
  const entry = `import { classes } from './record.js'; export function read() { return classes.root }`
  const [original, optimized] = await fixture(t, record, entry, {
    throws: true,
  })
  assert.equal(original.namespace instanceof ReferenceError, true)
  assert.equal(optimized.namespace instanceof ReferenceError, true)
  assert.equal(optimized.namespace.message, original.namespace.message)
  assert.match(optimized.code, /classes,\s*"record-root"/u)
})

test('resolves actual named export aliases without confusing shadowed imports', async (t) => {
  const record = `const data = Object.freeze({root:'aliased-root'}); export { data as classes }`
  const entry = `import {classes as local} from './record.js'; export const value=local.root; export function nested(local){return local.root}`
  const [original, optimized] = await fixture(t, record, entry)
  assert.equal(optimized.namespace.value, original.namespace.value)
  assert.equal(
    optimized.namespace.nested({ root: 'nested-root' }),
    'nested-root',
  )
  assert.doesNotMatch(optimized.code, /value = data\.root/u)
  assert.match(optimized.code, /local\.root/u)
})
