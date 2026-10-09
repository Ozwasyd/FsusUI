import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
require('tsx/cjs')
const {
  writeNodeDeclarationFormats,
  rewriteNodeDeclaration,
} = require('../vue/internal/build/src/utils/node-declarations.ts')
const ts = require('typescript')

test('Node16 distinguishes ESM defaults and preserves CJS callable re-export types', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fsus-node-declarations-'))
  const put = async (file, contents) => {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, contents)
  }
  await put(
    'package.json',
    JSON.stringify({
      name: 'element-plus',
      exports: {
        '.': {
          import: { types: './es/index.d.mts', default: './es/index.mjs' },
          require: { types: './lib/index.d.ts', default: './lib/index.js' },
        },
        './lib': { types: './lib/index.d.ts', require: './lib/index.js' },
      },
    }),
  )
  await put(
    'node_modules/interop-dependency/package.json',
    JSON.stringify({
      name: 'interop-dependency',
      type: 'module',
      exports: {
        types: './index.d.mts',
        import: './index.mjs',
        require: './index.cjs',
      },
    }),
  )
  await put(
    'node_modules/interop-dependency/index.d.mts',
    'export declare function retain<T>(value: T): T;\nexport interface Item { key: string }\n',
  )
  await put('es/index.d.ts', "export { default, create } from './component';\n")
  await put(
    'es/component.d.ts',
    'export declare function create(value: string): { value: string };\nexport default create;\n',
  )
  await put(
    'lib/index.d.ts',
    "export { retain } from 'interop-dependency';\nexport type Item = import('interop-dependency').Item;\n",
  )
  await put('global.d.ts', 'export {};\n')
  const esmProbe =
    'import create from "element-plus";\nconst value: string = create("ok").value;\n'
  await put(
    'positive.mts',
    `${esmProbe 
      }import { retain, type Item } from "element-plus/lib";\nconst item: Item = retain({ key: "ok" });\n`,
  )
  await put('negative.mts', `${esmProbe  }create(42);\n`)
  const check = (file) => {
    const program = ts.createProgram([path.join(root, file)], {
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.Node16,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      types: [],
    })
    return ts.getPreEmitDiagnostics(program)
  }
  const before = check('positive.mts')
  assert.ok(before.some((row) => row.code === 2307))
  assert.ok(before.some((row) => [1479, 1542].includes(row.code)))
  await writeNodeDeclarationFormats(root)
  assert.deepEqual(check('positive.mts'), [])
  const negative = check('negative.mts')
  assert.deepEqual(
    negative.map((row) => row.code),
    [2345],
  )
  assert.ok(
    negative.every(
      (row) => row.file.fileName === path.join(root, 'negative.mts'),
    ),
  )
  assert.equal(
    await readFile(path.join(root, 'es/index.d.ts'), 'utf8'),
    "export { default, create } from './component';\n",
    'legacy ESM declarations stay intact',
  )
  const first = await readFile(path.join(root, 'lib/index.d.ts'), 'utf8')
  await writeNodeDeclarationFormats(root)
  assert.equal(await readFile(path.join(root, 'lib/index.d.ts'), 'utf8'), first)
})

test('missing declaration owners and unsupported value exports stay fatal', () => {
  assert.throws(
    () =>
      rewriteNodeDeclaration(
        "export { missing } from './missing';\n",
        '/tmp/fsus/entry.d.ts',
        'esm',
        new Set(),
      ),
    /Cannot resolve ESM declaration owner/,
  )
  assert.throws(
    () =>
      rewriteNodeDeclaration(
        "import type { Missing } from 'missing-dependency';\n",
        '/tmp/fsus/entry.d.ts',
        'cjs',
        new Set(),
      ),
    /Cannot resolve declaration import/,
  )
})
