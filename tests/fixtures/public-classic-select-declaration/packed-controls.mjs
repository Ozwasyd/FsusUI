import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { installedAuthority, assertInstalledDiagnostics } from './authority.mjs'

const consumerRoot = path.resolve(process.argv[2])
const requireConsumer = createRequire(path.join(consumerRoot, 'package.json'))
const ts = requireConsumer('typescript')
const packageJson = JSON.parse(await readFile(path.join(consumerRoot, 'node_modules/@ozwasyd/element-plus/package.json'), 'utf8'))
const authority = await installedAuthority(path.join(consumerRoot, 'node_modules/@ozwasyd/element-plus'))
assert.equal(ts.version, '6.0.2')
assert.equal(requireConsumer('vue/package.json').version, '3.5.32')
const results = []
for (const name of ['positive', 'negative', 'whole-package']) {
  assert.equal(await readFile(path.join(consumerRoot, `${name}.ts`), 'utf8'), await readFile(path.join(import.meta.dirname, `${name}.ts`), 'utf8'), 'Use the original unmodified nonempty fixture selection.')
}
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
    const record = { authority: authority.name, mode, name, strict: true, skipLibCheck: false, rawCompile: diagnostics.length ? 'FAIL' : 'PASS', diagnostics }
    results.push(record)
    await writeFile(path.join(consumerRoot, `${mode}-${name}-diagnostics.json`), JSON.stringify(record, null, 2) + '\n')
    assertInstalledDiagnostics(authority, mode, name, diagnostics)
    if (name === 'negative') {
      const fixtureErrors = diagnostics.filter((row) => row.file === 'negative.ts')
      assert.equal(fixtureErrors.length, 8, `${mode} must reject all eight invalid contracts`)
      assert.deepEqual(new Set(fixtureErrors.map((row) => row.line)), new Set([4, 5, 6, 7, 9, 10, 12, 13]))
    }
  }
}
const unexpected = path.join(consumerRoot, 'unexpected-diagnostic.ts')
await writeFile(unexpected, 'export const unrelatedValue: number = "unexpected";\n')
const refusalProgram = ts.createProgram([path.join(consumerRoot, 'positive.ts'), unexpected], {
  strict: true, skipLibCheck: false, noEmit: true,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], types: [], esModuleInterop: true,
})
const refusalDiagnostics = ts.getPreEmitDiagnostics(refusalProgram).map((row) => ({
  file: row.file && path.relative(consumerRoot, row.file.fileName),
  line: row.file && row.start != null ? row.file.getLineAndCharacterOfPosition(row.start).line + 1 : null,
  code: row.code, message: ts.flattenDiagnosticMessageText(row.messageText, '\n'),
}))
await writeFile(path.join(consumerRoot, 'unknown-diagnostic-refusal.json'), JSON.stringify({ diagnostics: refusalDiagnostics, expectedAuthorityResult: 'FAIL' }, null, 2) + '\n')
assert.equal(refusalDiagnostics.filter((row) => row.file === 'unexpected-diagnostic.ts' && row.code === 2322).length, 1)
assert.throws(() => assertInstalledDiagnostics(authority, 'bundler', 'positive', refusalDiagnostics), /Every diagnostic must match/)
await writeFile(path.join(consumerRoot, 'packed-control-results.json'), JSON.stringify({
  authority: authority.name,
  compiler: ts.version, vue: requireConsumer('vue/package.json').version,
  package: { name: packageJson.name, version: packageJson.version, dependencies: packageJson.dependencies },
  exactDiagnosticControls: 'PASS', originalEightNegativeControls: 'PASS in both modes',
  unknownDiagnosticRefusal: 'PASS: actual unrelated TS2322 causes authority failure',
  packageQualification: Object.fromEntries(['bundler', 'node16'].map((mode) => [mode, results.find((row) => row.mode === mode && row.name === 'whole-package').rawCompile])),
  results,
}, null, 2) + '\n')
console.log(`${authority.name}: exact diagnostic controls PASS; all original eight negatives rejected in both modes. Whole-package Bundler ${results.find((row) => row.mode === 'bundler' && row.name === 'whole-package').rawCompile}; whole-package Node16 FAIL (all diagnostics retained). Expectation PASS is not Node16 package qualification.`)
