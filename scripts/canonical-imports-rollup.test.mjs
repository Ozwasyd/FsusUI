import assert from 'node:assert/strict'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { SourceMap } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { rollup } from 'rollup'
import { minify } from 'rollup-plugin-esbuild'
import { readonly, shallowRef } from 'vue'
import canonicalModule from '../vue/internal/build/src/plugins/canonical-imports.ts'

const { CanonicalExternalImports } = canonicalModule
const compile = async (bindings, canonical, format = 'es', comment = '') => {
  const source = `/*! retained import license */\nimport {${bindings}${comment}} from 'vue';\nexport const values = {readonly, shallowRef}`
  const bundle = await rollup({
    input: 'entry',
    external: ['vue'],
    plugins: [
      {
        name: 'actual-import-order-fixture',
        resolveId: (id) => (id === 'entry' ? id : undefined),
        load: (id) => (id === 'entry' ? source : undefined),
      },
      minify({ target: 'es2022', sourceMap: true }),
      canonical && CanonicalExternalImports(),
    ],
  })
  try {
    return (await bundle.generate({ format, sourcemap: true })).output.find(
      (item) => item.type === 'chunk',
    )
  } finally {
    await bundle.close()
  }
}

test('canonicalizes actual minified external binding order without changing bindings, license or source maps', async (t) => {
  const first = 'readonly,shallowRef'
  const second = 'shallowRef,readonly'
  const red = await Promise.all([compile(first, false), compile(second, false)])
  assert.match(red[0].code, /import\{shallowRef.+readonly/u)
  const green = await Promise.all([compile(first, true), compile(second, true)])
  assert.equal(green[0].code, green[1].code)
  assert.match(green[0].code, /import\{readonly.+shallowRef/u)
  assert.match(green[0].code, /retained import license/u)
  const directory = await mkdtemp(path.join(os.tmpdir(), 'fsus-import-order-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await symlink(
    path.resolve('node_modules'),
    path.join(directory, 'node_modules'),
  )
  await writeFile(path.join(directory, 'entry.mjs'), green[0].code)
  const actual = await import(pathToFileURL(path.join(directory, 'entry.mjs')))
  assert.equal(actual.values.readonly, readonly)
  assert.equal(actual.values.shallowRef, shallowRef)
  // Rollup-generated import tokens have no upstream mapping; retain the
  // real mapped body location across the final import normalization.
  const offset = green[1].code.lastIndexOf('readonly')
  const prefix = green[1].code.slice(0, offset).split('\n')
  const original = new SourceMap(green[1].map).findEntry(
    prefix.length - 1,
    prefix.at(-1).length,
  )
  assert.equal(original.originalLine, 2)
})

test('keeps CJS output unchanged', async () => {
  const before = await compile('shallowRef,readonly', false, 'cjs')
  const after = await compile('shallowRef,readonly', true, 'cjs')
  assert.equal(after.code, before.code)
})
