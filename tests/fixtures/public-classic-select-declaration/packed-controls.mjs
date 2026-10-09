import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const consumerRoot = path.resolve(process.argv[2])
const requireConsumer = createRequire(path.join(consumerRoot, 'package.json'))
const ts = requireConsumer('typescript')
const packageJson = JSON.parse(await readFile(path.join(consumerRoot, 'node_modules/@ozwasyd/element-plus/package.json'), 'utf8'))
assert.equal(ts.version, '6.0.2')
assert.equal(requireConsumer('vue/package.json').version, '3.5.32')
const results = []
for (const [mode, module, moduleResolution] of [
  ['bundler', ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
  ['node16', ts.ModuleKind.Node16, ts.ModuleResolutionKind.Node16],
]) {
  for (const name of ['positive', 'negative', 'whole-package']) {
    const file = path.join(consumerRoot, `${name}.ts`)
    assert.ok((await readFile(file, 'utf8')).length > 0)
    const options = {
      strict: true, skipLibCheck: false, noEmit: true,
      target: ts.ScriptTarget.ES2022, module, moduleResolution,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      types: [], esModuleInterop: true,
    }
    const program = ts.createProgram([file], options)
    const diagnostics = ts.getPreEmitDiagnostics(program).map((row) => ({
      file: row.file && path.relative(consumerRoot, row.file.fileName),
      line: row.file && row.start != null ? row.file.getLineAndCharacterOfPosition(row.start).line + 1 : null,
      code: row.code, message: ts.flattenDiagnosticMessageText(row.messageText, '\n'),
    }))
    const record = { mode, name, strict: true, skipLibCheck: false, diagnostics }
    results.push(record)
    await writeFile(path.join(consumerRoot, `${mode}-${name}-diagnostics.json`), JSON.stringify(record, null, 2) + '\n')
    if (name === 'positive') {
      assert.equal(diagnostics.length, 2, `${mode} must retain the two unrelated absent barrels`)
      assert.ok(diagnostics.every((row) => row.code === 2307 && /Cannot find module '\.\/(cascader|slider)'/.test(row.message)))
    } else if (name === 'negative') {
      const fixtureErrors = diagnostics.filter((row) => row.file === 'negative.ts')
      const inheritedErrors = diagnostics.filter((row) => row.file !== 'negative.ts')
      assert.equal(fixtureErrors.length, 8, `${mode} must reject all eight invalid contracts`)
      assert.deepEqual(new Set(fixtureErrors.map((row) => row.line)), new Set([4, 5, 6, 7, 9, 10, 12, 13]))
      assert.equal(inheritedErrors.length, 2)
      assert.ok(inheritedErrors.every((row) => row.code === 2307 && /Cannot find module '\.\/(cascader|slider)'/.test(row.message)))
    } else {
      // Other assigned owners still have two absent barrels and two globals.
      assert.equal(diagnostics.length, 4, `${mode} original whole-package errors must reduce from ten to four`)
      assert.deepEqual(diagnostics.map((row) => row.code).sort(), [2307, 2307, 2339, 2339])
      assert.ok(diagnostics.every((row) => /cascader|slider|ElCascader|ElSlider/.test(row.message)))
    }
  }
}
await writeFile(path.join(consumerRoot, 'packed-control-results.json'), JSON.stringify({
  compiler: ts.version, vue: requireConsumer('vue/package.json').version,
  package: { name: packageJson.name, version: packageJson.version, dependencies: packageJson.dependencies },
  scopedPositive: 'PASS', scopedNegative: 'PASS', rawPositiveCompile: 'FAIL',
  unrelatedPositiveCompileErrors: 2, wholePackage: 'FAIL', expectedRemainingErrors: 4,
  results,
}, null, 2) + '\n')
console.log('Scoped packed strict positive/negative controls PASS in Bundler and Node16; raw positive compile retains two unrelated absent barrels, and whole-package strict remains FAIL with four Cascader/Slider errors.')
