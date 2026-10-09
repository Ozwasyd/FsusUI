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
  test(
    `${format}: concurrent recursive imports retain forward declarations`,
    { timeout: 10_000 },
    async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'fsus-macro-cycle-'))
      try {
        const a = path.join(root, 'a.d.ts'),
          b = path.join(root, 'b.d.ts')
        await writeFile(
          a,
          "import type { B } from './b';\nexport interface A { b: B }\nexport type AAgain = A;\n",
        )
        await writeFile(
          b,
          "import type { A } from './a';\nexport interface B { a: A }\nexport type BAgain = B;\n",
        )
        const scopes = await Promise.all([api.getTSFile(a), api.getTSFile(b)])
        await Promise.all(scopes.map((scope) => api.resolveTSNamespace(scope)))
        assert.equal(scopes[0].exports.A.type.id.name, 'A')
        assert.equal(scopes[1].exports.B.type.id.name, 'B')
        assert.equal(scopes[0].declarations.B.type.id.name, 'B')
        assert.equal(scopes[1].declarations.A.type.id.name, 'A')
        const exports = scopes.map((scope) => scope.exports)
        await Promise.all(scopes.map((scope) => api.resolveTSNamespace(scope)))
        assert.deepEqual(
          scopes.map((scope) => scope.exports),
          exports,
        )
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    },
  )

  test(
    `${format}: concurrent and subsequent callers retain loader failures`,
    { timeout: 10_000 },
    async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'fsus-macro-failure-'))
      try {
        const entry = path.join(root, 'entry.d.ts')
        await writeFile(
          entry,
          "import type { Broken } from './broken';\nexport interface Entry {}\n",
        )
        await writeFile(
          path.join(root, 'broken.d.ts'),
          'export interface Broken { impossible: ; }\n',
        )
        const scope = await api.getTSFile(entry)
        const results = await Promise.allSettled([
          api.resolveTSNamespace(scope),
          api.resolveTSNamespace(scope),
        ])
        assert.ok(results.every((result) => result.status === 'rejected'))
        assert.equal(results[0].reason, results[1].reason)
        await assert.rejects(
          api.resolveTSNamespace(scope),
          (error) => error === results[0].reason,
        )
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    },
  )
}
