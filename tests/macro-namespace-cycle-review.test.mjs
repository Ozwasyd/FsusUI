import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const require = createRequire(import.meta.url)
const macroRequire = createRequire(
  require.resolve('unplugin-vue-macros/rollup'),
)
const ts = require('typescript')
const cjs = macroRequire('@vue-macros/api')
const esm = await import(
  pathToFileURL(
    path.join(
      path.dirname(macroRequire.resolve('@vue-macros/api/package.json')),
      'dist/index.js',
    ),
  ).href
)

for (const [format, api] of [
  ['cjs', cjs],
  ['esm', esm],
]) {
  const fixture = async (files, action) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'fsus-macro-review-'))
    try {
      await Promise.all(
        Object.entries(files).map(([name, source]) =>
          writeFile(path.join(root, name), source),
        ),
      )
      return await action(root)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
  for (const [order, a] of [
    ['direct then recursive', "export * from './c'; export * from './b';"],
    ['recursive then direct', "export * from './b'; export * from './c';"],
  ]) {
    test(
      `${format}: ${order} star exports retain the direct owner through a cycle`,
      { timeout: 10_000 },
      () =>
        fixture(
          {
            'a.d.ts': a,
            'b.d.ts': "export * from './a';",
            'c.d.ts': 'export interface C { value:string }',
          },
          async (root) => {
            const files = ['a.d.ts', 'b.d.ts', 'c.d.ts'].map((file) =>
              path.join(root, file),
            )
            const program = ts.createProgram(files, {
              strict: true,
              skipLibCheck: false,
              noEmit: true,
              types: [],
              target: ts.ScriptTarget.ES2022,
              module: ts.ModuleKind.Node16,
              moduleResolution: ts.ModuleResolutionKind.Node16,
            })
            assert.deepEqual(
              ts.getPreEmitDiagnostics(program),
              [],
              'the original declaration graph is legal',
            )
            const [a, b, c] = await Promise.all(
              files.map((file) => api.getTSFile(file)),
            )
            await api.resolveTSNamespace(a)
            assert.equal(a.exports.C.type.id.name, 'C')
            assert.equal(a.exports.C, c.exports.C)
            assert.equal(b.exports.C, c.exports.C)
            await api.resolveTSNamespace(b)
            assert.equal(a.exports.C, b.exports.C)
          },
        ),
    )
  }
  for (const [name, a, b, exported] of [
    [
      'imported local alias',
      "import type {B} from './b'; export {B as Alias};",
      "import type {Alias} from './a'; export interface B {a:Alias}",
      'Alias',
    ],
    [
      'external named reexport',
      "import type {B} from './b'; export {B as Alias} from './b';",
      "import type {Alias} from './a'; export interface B {a:Alias}",
      'Alias',
    ],
  ]) {
    test(
      `${format}: recursive ${name} retains its final owner`,
      { timeout: 10_000 },
      () =>
        fixture({ 'a.d.ts': a, 'b.d.ts': b }, async (root) => {
          const [a, b] = await Promise.all(
            ['a.d.ts', 'b.d.ts'].map((file) =>
              api.getTSFile(path.join(root, file)),
            ),
          )
          await api.resolveTSNamespace(a)
          assert.equal(a.exports[exported], b.exports.B)
          assert.equal(b.declarations.Alias, b.exports.B)
        }),
    )
  }
  test(
    `${format}: recursive export-all retains names introduced by a later third-file reexport`,
    { timeout: 10_000 },
    () =>
      fixture(
        {
          'a.d.ts':
            "import type {B} from './b'; export {C} from './c'; export interface A {b:B}",
          'b.d.ts': "export * from './a'; export interface B {}",
          'c.d.ts': 'export interface C {}',
        },
        async (root) => {
          const [a, b, c] = await Promise.all(
            ['a.d.ts', 'b.d.ts', 'c.d.ts'].map((file) =>
              api.getTSFile(path.join(root, file)),
            ),
          )
          await api.resolveTSNamespace(a)
          assert.equal(a.exports.C, c.exports.C)
          assert.equal(b.exports.C, c.exports.C)
          assert.equal(b.exports.A, a.exports.A)
          assert.equal(b.exports.B.type.id.name, 'B')
        },
      ),
  )
  test(
    `${format}: a recursive default declaration is available to the other namespace`,
    { timeout: 10_000 },
    () =>
      fixture(
        {
          'a.d.ts':
            "import type {B} from './b'; export default interface A {b:B}",
          'b.d.ts': "import type A from './a'; export interface B {a:A}",
        },
        async (root) => {
          const [a, b] = await Promise.all(
            ['a.d.ts', 'b.d.ts'].map((file) =>
              api.getTSFile(path.join(root, file)),
            ),
          )
          await api.resolveTSNamespace(a)
          assert.equal(a.exports.default.type.id.name, 'A')
          assert.equal(b.declarations.A, a.exports.default)
        },
      ),
  )
  test(
    `${format}: a recursive local export alias is available to the other namespace`,
    { timeout: 10_000 },
    () =>
      fixture(
        {
          'x.d.ts':
            "import type {Y} from './y'; interface Local {y:Y}; export {Local as X};",
          'y.d.ts': "import type {X} from './x'; export interface Y {x:X};",
        },
        async (root) => {
          const [x, y] = await Promise.all(
            ['x.d.ts', 'y.d.ts'].map((file) =>
              api.getTSFile(path.join(root, file)),
            ),
          )
          await api.resolveTSNamespace(x)
          assert.equal(x.exports.X.type.id.name, 'Local')
          assert.equal(y.declarations.X, x.exports.X)
        },
      ),
  )
  test(
    `${format}: a dependency cycle retains a later third-file failure for every public caller`,
    { timeout: 10_000 },
    () =>
      fixture(
        {
          'a.d.ts':
            "import type {B} from './b'; import type {Broken} from './broken'; export interface A {b:B}",
          'b.d.ts': "import type {A} from './a'; export interface B {a:A}",
          'broken.d.ts': 'export interface Broken {x:;}',
        },
        async (root) => {
          const scopes = await Promise.all(
            ['a.d.ts', 'b.d.ts'].map((file) =>
              api.getTSFile(path.join(root, file)),
            ),
          )
          const [initial] = await Promise.allSettled([
            api.resolveTSNamespace(scopes[0]),
          ])
          assert.equal(initial.status, 'rejected')
          const subsequent = await Promise.allSettled(
            scopes.map((scope) => api.resolveTSNamespace(scope)),
          )
          assert.deepEqual(
            subsequent.map((result) => result.status),
            ['rejected', 'rejected'],
          )
          assert.ok(
            subsequent.every((result) => result.reason === initial.reason),
          )
        },
      ),
  )
}
