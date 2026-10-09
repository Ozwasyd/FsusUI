import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
require('tsx/cjs')
const {
  rewriteNodeDeclaration,
} = require('../vue/internal/build/src/utils/node-declarations.ts')
const ts = require('typescript')
const { Project, ts: producerTs } = require('ts-morph')
const dependency = `
export interface Item { key: string }
export declare class Box { key: string }
export default function retain<T>(x: T): T;
export declare function keep<T>(x: T): T;
export declare class GenericBox<T extends Item = Item> {
  constructor(value: T);
  value: T;
  private brand;
}
export declare function overload(value: string): number;
export declare function overload(value: number): string;
`

const cases = {
  mixed: {
    input: "export { keep, type Item } from 'dep';",
    positive:
      'import { keep, type Item } from ENTRY; const item: Item = keep({ key: "ok" });',
    negative: 'import { type Item } from ENTRY; const item: Item = { key: 1 };',
    codes: [2322],
  },
  default: {
    input: "export { default } from 'dep';",
    positive: 'import retain from ENTRY; const value: number = retain(1);',
    negative: 'import retain from ENTRY; retain();',
    codes: [2554],
  },
  interface: {
    input: "export { Item } from 'dep';",
    positive: 'import { Item } from ENTRY; const item: Item = { key: "ok" };',
    negative: 'import { Item } from ENTRY; new Item();',
    codes: [2693],
  },
  class: {
    input: "export { Box } from 'dep';",
    positive:
      'import { Box } from ENTRY; const box: Box = new Box(); const key: string = box.key;',
    negative: 'import { Box } from ENTRY; const key: number = new Box().key;',
    codes: [2322],
  },
  imported: {
    input: "import { keep } from 'dep'; export { keep };",
    positive: 'import { keep } from ENTRY; const value: number = keep(1);',
    negative: 'import { keep } from ENTRY; const value: string = keep(1);',
    codes: [2322],
  },
  privateImport: {
    input: "import { keep } from 'dep'; export declare const use: typeof keep;",
    positive: 'import { use } from ENTRY; const value: number = use(1);',
    negative: 'import { keep } from ENTRY;',
    codes: [2459],
  },
  privateDefaultImport: {
    input: "import retain from 'dep'; export declare const use: typeof retain;",
    positive: 'import { use } from ENTRY; const value: number = use(1);',
    negative: 'import { retain } from ENTRY;',
    codes: [2459],
  },
  importedDefault: {
    input: "import retain from 'dep'; export default retain;",
    positive: 'import retain from ENTRY; const value: number = retain(1);',
    negative: 'import retain from ENTRY; const value: string = retain(1);',
    codes: [2322],
  },
  alias: {
    input: "export { default as retain } from 'dep';",
    positive: 'import { retain } from ENTRY; const value: number = retain(1);',
    negative: 'import { retain } from ENTRY; const value: string = retain(1);',
    codes: [2322],
  },
  genericClass: {
    input: "export { GenericBox } from 'dep';",
    positive:
      'import { GenericBox } from ENTRY; const box: GenericBox = new GenericBox({ key: "ok" }); const key: string = box.value.key;',
    negative:
      'import { GenericBox } from ENTRY; type Invalid = GenericBox<number>;',
    codes: [2344],
  },
  defaultClass: {
    input: "export { GenericBox as default } from 'dep';",
    positive:
      'import Box from ENTRY; const box: Box = new Box({ key: "ok" }); const key: string = box.value.key;',
    negative: 'import Box from ENTRY; type Invalid = Box<number>;',
    codes: [2344],
  },
  importedGenericClass: {
    input:
      "import { GenericBox as Local } from 'dep'; export { Local as GenericBox }; export declare class Derived extends Local {}",
    positive:
      'import { GenericBox, Derived } from ENTRY; const box: GenericBox = new Derived({ key: "ok" }); const key: string = box.value.key;',
    negative:
      'import { GenericBox } from ENTRY; type Invalid = GenericBox<number>;',
    codes: [2344],
  },
  mixedImport: {
    input:
      "import { keep, type Item } from 'dep'; export { keep }; export type { Item };",
    positive:
      'import { keep, type Item } from ENTRY; const item: Item = keep({ key: "ok" });',
    negative: 'import { keep } from ENTRY; const value: string = keep(1);',
    codes: [2322],
  },
  overloaded: {
    input: "export { overload as convert } from 'dep';",
    positive:
      'import { convert } from ENTRY; const number: number = convert("ok"); const string: string = convert(1);',
    negative: 'import { convert } from ENTRY; convert(true);',
    codes: [2769],
  },
  typeOnlyClass: {
    input: "export { type Box } from 'dep';",
    positive:
      'import { type Box } from ENTRY; declare const box: Box; const key: string = box.key;',
    negative: 'import { Box } from ENTRY; new Box();',
    codes: [1362],
  },
  privateNameCollision: {
    input:
      "export declare const __fsusNodeImport0: number; export { keep } from 'dep';",
    positive:
      'import { keep, __fsusNodeImport0 } from ENTRY; const value: number = keep(__fsusNodeImport0);',
    negative: 'import { keep } from ENTRY; const value: string = keep(1);',
    codes: [2322],
  },
}

const diagnostics = (file, compiler) => {
  const options = {
    noEmit: true,
    strict: true,
    skipLibCheck: false,
    types: [],
    target: compiler.ScriptTarget.ES2022,
    module: compiler.ModuleKind.Node16,
    moduleResolution: compiler.ModuleResolutionKind.Node16,
  }
  if (compiler === producerTs) {
    const project = new Project({ compilerOptions: options })
    project.addSourceFileAtPath(file)
    return project.getPreEmitDiagnostics().map((row) => row.compilerObject)
  }
  return ts.getPreEmitDiagnostics(ts.createProgram([file], options))
}

for (const [name, fixture] of Object.entries(cases)) {
  test(`Node16 preserves ${name} export contracts in both locked compilers`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'fsus-node-reexport-'))
    const put = async (file, text) => {
      const target = path.join(root, file)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, text)
      return target
    }
    await put('package.json', '{"type":"commonjs"}')
    await put(
      'node_modules/dep/package.json',
      JSON.stringify({
        type: 'module',
        exports: {
          types: './index.d.mts',
          import: './index.mjs',
          require: './index.cjs',
        },
      }),
    )
    assert.deepEqual(
      ts.createSourceFile('dep.d.mts', dependency, ts.ScriptTarget.Latest)
        .parseDiagnostics,
      [],
    )
    await put('node_modules/dep/index.d.mts', dependency)
    await put('original.d.mts', fixture.input)
    const filename = path.join(root, 'rewritten.d.ts')
    const output = rewriteNodeDeclaration(
      fixture.input,
      filename,
      'cjs',
      new Set(),
    )
    await put('rewritten.d.ts', output)
    assert.equal(
      rewriteNodeDeclaration(output, filename, 'cjs', new Set()),
      output,
      'rewriting is idempotent',
    )
    for (const compiler of [producerTs, ts]) {
      const original = await put(
        'original-positive.mts',
        fixture.positive.replaceAll('ENTRY', '"./original.mjs"'),
      )
      assert.deepEqual(
        diagnostics(original, compiler),
        [],
        'the original ESM contract is legal',
      )
      const originalNegative = await put(
        'original-negative.mts',
        fixture.negative.replaceAll('ENTRY', '"./original.mjs"'),
      )
      const originalRows = diagnostics(originalNegative, compiler)
      assert.deepEqual(
        originalRows.map((row) => row.code),
        fixture.codes,
      )
      assert.ok(
        originalRows.every((row) => row.file.fileName === originalNegative),
      )
      const positive = await put(
        'positive.cts',
        fixture.positive.replaceAll('ENTRY', '"./rewritten"'),
      )
      assert.deepEqual(
        diagnostics(positive, compiler),
        [],
        'CJS preserves the complete original contract',
      )
      const negative = await put(
        'negative.cts',
        fixture.negative.replaceAll('ENTRY', '"./rewritten"'),
      )
      const rows = diagnostics(negative, compiler)
      assert.deepEqual(
        rows.map((row) => row.code),
        fixture.codes,
      )
      assert.ok(
        rows.every((row) => row.file.fileName === negative),
        'no declaration or external diagnostics',
      )
    }
    assert.equal(await readFile(filename, 'utf8'), output)
  })
}
