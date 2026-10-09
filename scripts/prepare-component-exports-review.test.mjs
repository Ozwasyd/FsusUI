import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { addComponentDirectoryExports } from './prepare-component-exports.mjs'

const manifest = () => ({
  name: 'review-component-fixture',
  exports: {
    './es/components/*': {
      types: ['./es/components/*.d.ts', './es/components/*/index.d.ts'],
      import: './es/components/*.mjs',
    },
    './lib/components/*': {
      types: ['./lib/components/*.d.ts', './lib/components/*/index.d.ts'],
      require: './lib/components/*.js',
    },
  },
})
const put = (root, name, contents = '') => {
  mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
  writeFileSync(path.join(root, name), contents)
}
const fixture = (action) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'export-source-review-'))
  try {
    mkdirSync(path.join(root, 'es/components'), { recursive: true })
    mkdirSync(path.join(root, 'lib/components'), { recursive: true })
    return action(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
const component = (root, owner, value = 'directory') => {
  for (const [format, ext] of [
    ['es', 'mjs'],
    ['lib', 'js'],
  ]) {
    put(
      root,
      `${format}/components/${owner}/index.${ext}`,
      format === 'es'
        ? `export default '${value}'`
        : `module.exports = '${value}'`,
    )
    put(
      root,
      `${format}/components/${owner}/index.d.ts`,
      `declare const value: '${value}'; export default value;`,
    )
  }
}
const probe = (root, pkg, subpath = 'select') => {
  put(root, 'package.json', JSON.stringify(pkg))
  put(
    root,
    'probe.mjs',
    `import {createRequire} from 'node:module';const require=createRequire(import.meta.url);console.log(JSON.stringify([(await import('review-component-fixture/es/components/${subpath}')).default,require('review-component-fixture/lib/components/${subpath}')]))`,
  )
  return JSON.parse(
    execFileSync(process.execPath, [path.join(root, 'probe.mjs')], {
      encoding: 'utf8',
    }),
  )
}

test('preserve working file/facade precedence when a directory shares its name', () =>
  fixture((root) => {
    component(root, 'select')
    put(root, 'es/components/select.mjs', "export default 'facade'")
    put(root, 'lib/components/select.js', "module.exports = 'facade'")
    put(
      root,
      'es/components/select.d.ts',
      "declare const value: 'facade'; export default value;",
    )
    put(
      root,
      'lib/components/select.d.ts',
      "declare const value: 'facade'; export default value;",
    )
    const pkg = manifest()
    assert.deepEqual(probe(root, pkg), ['facade', 'facade'])
    addComponentDirectoryExports(pkg, root)
    assert.deepEqual(probe(root, pkg), ['facade', 'facade'])
  }))
test('preserve the winning null exclusion pattern', () =>
  fixture((root) => {
    component(root, 'private-probe')
    const pkg = manifest()
    pkg.exports['./es/components/private*'] = null
    pkg.exports['./lib/components/private*'] = null
    assert.throws(() => probe(root, pkg, 'private-probe'), /Command failed/)
    addComponentDirectoryExports(pkg, root)
    assert.throws(() => probe(root, pkg, 'private-probe'), /Command failed/)
  }))
test('skip symlinked component directories', () =>
  fixture((root) => {
    component(root, 'select')
    symlinkSync('select', path.join(root, 'es/components/linked'), 'dir')
    symlinkSync('select', path.join(root, 'lib/components/linked'), 'dir')
    const pkg = manifest()
    assert.equal(addComponentDirectoryExports(pkg, root), 2)
    assert.equal(Object.hasOwn(pkg.exports, './es/components/linked'), false)
  }))
test('refuse index and declaration symlinks outside the package boundary', () =>
  fixture((root) => {
    const outside = mkdtempSync(
      path.join(os.tmpdir(), 'export-source-outside-'),
    )
    try {
      put(outside, 'index.mjs', "export default 'outside'")
      put(
        outside,
        'index.d.ts',
        "declare const value: 'outside'; export default value;",
      )
      mkdirSync(path.join(root, 'es/components/select'))
      symlinkSync(
        path.join(outside, 'index.mjs'),
        path.join(root, 'es/components/select/index.mjs'),
      )
      symlinkSync(
        path.join(outside, 'index.d.ts'),
        path.join(root, 'es/components/select/index.d.ts'),
      )
      assert.throws(
        () => addComponentDirectoryExports(manifest(), root),
        /symlink|boundary|regular/i,
      )
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  }))
test('refuse a directory masquerading as a runtime file', () =>
  fixture((root) => {
    mkdirSync(path.join(root, 'es/components/select/index.mjs'), {
      recursive: true,
    })
    put(root, 'es/components/select/index.d.ts')
    assert.throws(
      () => addComponentDirectoryExports(manifest(), root),
      /file|regular|runtime/i,
    )
  }))
test('refuse runtime-only and declaration-only symlinks independently', () => {
  for (const target of ['index.mjs', 'index.d.ts']) {
    fixture((root) => {
      component(root, 'select')
      const outside = mkdtempSync(path.join(os.tmpdir(), 'export-one-link-'))
      try {
        put(outside, target, 'export default 1')
        const destination = path.join(root, 'es/components/select', target)
        rmSync(destination)
        symlinkSync(path.join(outside, target), destination)
        assert.throws(
          () => addComponentDirectoryExports(manifest(), root),
          /boundary|regular/,
        )
      } finally {
        rmSync(outside, { recursive: true, force: true })
      }
    })
  }
})
test('refuse regular targets reached through an escaping parent directory', () =>
  fixture((root) => {
    const outside = mkdtempSync(path.join(os.tmpdir(), 'export-parent-link-'))
    try {
      put(outside, 'select/index.mjs', 'export default 1')
      put(outside, 'select/index.d.ts', 'export default 1')
      rmSync(path.join(root, 'es/components'), { recursive: true })
      symlinkSync(outside, path.join(root, 'es/components'), 'dir')
      assert.throws(
        () => addComponentDirectoryExports(manifest(), root),
        /boundary/,
      )
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  }))
test('preserve the original TypeScript declaration owner when runtime needs an index alias', () =>
  fixture((root) => {
    component(root, 'select')
    put(
      root,
      'es/components/select.d.ts',
      "declare const value: 'facade'; export default value;",
    )
    const pkg = manifest()
    const diagnose = (expected) => {
      put(root, 'package.json', JSON.stringify(pkg))
      put(
        root,
        'consumer.ts',
        `import value from 'review-component-fixture/es/components/select'; const owner: '${expected}' = value;`,
      )
      const program = ts.createProgram([path.join(root, 'consumer.ts')], {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        types: [],
      })
      return ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) => diagnostic.code)
    }
    assert.deepEqual(diagnose('facade'), [])
    assert.deepEqual(diagnose('directory'), [2322])
    assert.equal(addComponentDirectoryExports(pkg, root), 2)
    assert.equal(
      pkg.exports['./es/components/select'].types,
      './es/components/select.d.ts',
    )
    assert.deepEqual(probe(root, pkg), ['directory', 'directory'])
    assert.deepEqual(diagnose('facade'), [])
    assert.deepEqual(diagnose('directory'), [2322])
  }))
test('unchanged file/style paths, exact exclusions, bounded traversal, conditions and idempotence', () =>
  fixture((root) => {
    component(root, 'select')
    component(root, 'hidden')
    component(root, 'beta')
    put(root, 'es/components/select/style/index.mjs')
    put(root, 'lib/components/select/style/index.js')
    put(root, 'es/components/_internal/worker.mjs')
    const pkg = manifest()
    pkg.exports['./es/components/hidden'] = null
    pkg.exports['./lib/components/hidden'] = null
    pkg.exports['./es/wasm/*'] = null
    pkg.exports['./lib/wasm/*'] = null
    const original = structuredClone(pkg.exports)
    assert.equal(addComponentDirectoryExports(pkg, root), 4)
    for (const [key, value] of Object.entries(original))
      assert.deepEqual(pkg.exports[key], value)
    assert.deepEqual(
      Object.keys(pkg.exports).slice(Object.keys(original).length),
      [
        './es/components/beta',
        './es/components/select',
        './lib/components/beta',
        './lib/components/select',
      ],
    )
    assert.equal(
      Object.hasOwn(pkg.exports, './es/components/select/style'),
      false,
    )
    assert.equal(Object.hasOwn(pkg.exports, './es/components/_internal'), false)
    assert.deepEqual(pkg.exports['./es/components/select'], {
      types: './es/components/select/index.d.ts',
      import: './es/components/select/index.mjs',
    })
    assert.deepEqual(pkg.exports['./lib/components/select'], {
      types: './lib/components/select/index.d.ts',
      require: './lib/components/select/index.js',
    })
    const once = JSON.stringify(pkg)
    assert.equal(addComponentDirectoryExports(pkg, root), 0)
    assert.equal(JSON.stringify(pkg), once)
  }))
