import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { addComponentDirectoryExports } from './prepare-component-exports.mjs'

const manifest = () => ({
  name: 'component-export-fixture',
  exports: {
    './es/components/*': {
      import: {
        types: ['./es/components/*.d.mts', './es/components/*/index.d.mts'],
        default: './es/components/*.mjs',
      },
    },
    './lib/components/*': {
      types: ['./lib/components/*.d.ts', './lib/components/*/index.d.ts'],
      require: './lib/components/*.js',
    },
    './es/components/hidden': null,
    './lib/components/hidden': null,
    './es/wasm/*': null,
    './lib/wasm/*': null,
  },
})
const fixture = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fsus-component-exports-'))
  for (const [format, ext, declaration] of [
    ['es', 'mjs', 'd.mts'],
    ['lib', 'js', 'd.ts'],
  ]) {
    for (const name of ['select', 'hidden']) {
      const dir = path.join(root, format, 'components', name)
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        path.join(dir, `index.${ext}`),
        format === 'es'
          ? 'export const ElSelect = { install() {} }; export default ElSelect;\n'
          : 'exports.ElSelect = { install() {} }; exports.default = exports.ElSelect;\n',
      )
      writeFileSync(
        path.join(dir, `index.${declaration}`),
        'export declare const ElSelect: { install(): void }; export default ElSelect;\n',
      )
    }
  }
  return root
}

test('actual Node imports resolve existing extensionless component directories', () => {
  const root = fixture()
  try {
    const pkg = manifest()
    writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg))
    writeFileSync(
      path.join(root, 'probe.mjs'),
      "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const esm = await import('component-export-fixture/es/components/select'); const cjs = require('component-export-fixture/lib/components/select'); if (esm.default !== esm.ElSelect || cjs.default !== cjs.ElSelect || typeof cjs.default.install !== 'function') throw Error('Component contract mismatch');\n",
    )
    assert.throws(
      () =>
        execFileSync(process.execPath, [path.join(root, 'probe.mjs')], {
          stdio: 'pipe',
        }),
      /Command failed/,
    )
    const original = JSON.stringify(pkg.exports['./es/components/*'])
    assert.equal(addComponentDirectoryExports(pkg, root), 2)
    assert.equal(JSON.stringify(pkg.exports['./es/components/*']), original)
    assert.equal(pkg.exports['./es/components/hidden'], null)
    assert.equal(pkg.exports['./lib/components/hidden'], null)
    assert.equal(pkg.exports['./es/wasm/*'], null)
    writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg))
    execFileSync(process.execPath, [path.join(root, 'probe.mjs')], {
      stdio: 'pipe',
    })
    assert.equal(addComponentDirectoryExports(pkg, root), 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('unknown patterns and missing declarations remain fatal', () => {
  const root = fixture()
  try {
    const pkg = manifest()
    pkg.exports['./es/components/*'].import.default = './private/*.mjs'
    assert.throws(
      () => addComponentDirectoryExports(pkg, root),
      /Unsupported es component export pattern/,
    )
    rmSync(path.join(root, 'es/components/select/index.d.mts'))
    assert.throws(
      () => addComponentDirectoryExports(manifest(), root),
      /Missing component directory declaration/,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
