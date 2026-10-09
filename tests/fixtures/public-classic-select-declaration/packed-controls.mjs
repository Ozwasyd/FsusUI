import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
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
// Each real compiler program exits before the next, bounding checker memory.
const compile = (mode, ...files) => JSON.parse(execFileSync(process.execPath, [path.join(import.meta.dirname, 'compile-control.mjs'), consumerRoot, mode, ...files], { encoding: 'utf8' }).trim())
for (const name of ['positive', 'negative', 'whole-package']) {
  assert.equal(await readFile(path.join(consumerRoot, `${name}.ts`), 'utf8'), await readFile(path.join(import.meta.dirname, `${name}.ts`), 'utf8'), 'Use the original unmodified nonempty fixture selection.')
}
if (authority.node16ModuleObject) {
  for (const name of ['positive-node16', 'negative-node16-module']) {
    const content = await readFile(path.join(import.meta.dirname, `${name}.ts`), 'utf8')
    assert.ok(content.length > 0)
    await writeFile(path.join(consumerRoot, `${name}.ts`), content)
  }
}
for (const mode of ['bundler', 'node16']) {
  const selections = ['positive', 'negative', 'whole-package', ...(mode === 'node16' && authority.node16ModuleObject ? ['module-negative', 'legacy-default-negative'] : [])]
  for (const name of selections) {
    const filename = mode === 'node16' && authority.node16ModuleObject && name === 'positive' ? 'positive-node16.ts' : name === 'module-negative' ? 'negative-node16-module.ts' : name === 'legacy-default-negative' ? 'positive.ts' : `${name}.ts`
    const file = path.join(consumerRoot, filename)
    assert.ok((await readFile(file, 'utf8')).length > 0)
    const diagnostics = compile(mode, filename)
    const record = { authority: authority.name, mode, name, filename, strict: true, skipLibCheck: false, rawCompile: diagnostics.length ? 'FAIL' : 'PASS', diagnostics }
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
const refusalDiagnostics = compile('bundler', 'positive.ts', 'unexpected-diagnostic.ts')
await writeFile(path.join(consumerRoot, 'unknown-diagnostic-refusal.json'), JSON.stringify({ diagnostics: refusalDiagnostics, expectedAuthorityResult: 'FAIL' }, null, 2) + '\n')
assert.equal(refusalDiagnostics.filter((row) => row.file === 'unexpected-diagnostic.ts' && row.code === 2322).length, 1)
assert.throws(() => assertInstalledDiagnostics(authority, 'bundler', 'positive', refusalDiagnostics), /Every diagnostic must match/)
const runtimeDefaults = authority.node16ModuleObject ? JSON.parse(execFileSync(process.execPath, [path.join(import.meta.dirname, 'runtime-default-controls.mjs'), consumerRoot], { encoding: 'utf8' }).trim()) : { result: 'UNRUN: legacy declaration/exports boundary; original failures retained' }
await writeFile(path.join(consumerRoot, 'packed-control-results.json'), JSON.stringify({
  authority: authority.name,
  compiler: ts.version, vue: requireConsumer('vue/package.json').version,
  package: { name: packageJson.name, version: packageJson.version, dependencies: packageJson.dependencies },
  exactDiagnosticControls: 'PASS', originalEightNegativeControls: 'PASS in both modes',
  unknownDiagnosticRefusal: 'PASS: actual unrelated TS2322 causes authority failure',
  runtimeDefaults,
  packageQualification: Object.fromEntries(['bundler', 'node16'].map((mode) => [mode, results.find((row) => row.mode === mode && row.name === 'whole-package').rawCompile])),
  results,
}, null, 2) + '\n')
console.log(`${authority.name}: exact diagnostic controls PASS; all original eight negatives rejected in both modes. Whole-package Bundler ${results.find((row) => row.mode === 'bundler' && row.name === 'whole-package').rawCompile}; whole-package Node16 ${results.find((row) => row.mode === 'node16' && row.name === 'whole-package').rawCompile}. Every raw result is retained separately from expectation controls.`)
