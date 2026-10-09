import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
require('tsx/cjs')
const { Project, ts } = require('ts-morph')
const { parse } = require('vue/compiler-sfc')
const originalSha = '2d05f240e5fb04ac0cd602b4ed638ffe00b1859b'
const selectDir = 'vue/packages/components/select'
const evidenceDir = path.resolve(
  process.env.CLASSIC_SELECT_EVIDENCE_DIR || path.join(root, '.tmp/classic-select-declaration'),
)
const original = (file) => execFileSync('git', ['show', `${originalSha}:${file}`], {
  cwd: root,
  encoding: 'utf8',
})
const printRuntime = (source) => {
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true },
  }).outputText
  return ts.createPrinter({ removeComments: true }).printFile(
    ts.createSourceFile('runtime.js', output, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS),
  )
}

test('classic Select keeps the original runtime JavaScript', async () => {
  for (const file of ['index.ts', 'src/select.vue', 'src/useSelect.ts']) {
    const sourcePath = `${selectDir}/${file}`
    const before = original(sourcePath)
    const after = await readFile(path.join(root, sourcePath), 'utf8')
    if (file.endsWith('.vue')) {
      assert.equal(parse(after).descriptor.template.content, parse(before).descriptor.template.content)
      assert.equal(printRuntime(parse(after).descriptor.script.content), printRuntime(parse(before).descriptor.script.content))
    } else {
      assert.equal(printRuntime(after), printRuntime(before), sourcePath)
    }
  }
})

test('canonical producer emits Select; preserves ref contracts and records Options typing compatibility', async () => {
  assert.equal(ts.version, '5.9.2')
  assert.equal(process.cwd(), root, 'Run from the repository root, as the canonical producer requires.')
  await mkdir(evidenceDir, { recursive: true })
  const originalDiagnostics = Project.prototype.getPreEmitDiagnostics
  let capturedProject
  let diagnostics
  Project.prototype.getPreEmitDiagnostics = function (...args) {
    const rows = originalDiagnostics.apply(this, args)
    capturedProject = this
    diagnostics = rows.map((row) => ({
      code: row.getCode(),
      file: row.getSourceFile() && path.relative(root, row.getSourceFile().getFilePath()),
      start: row.getStart(),
      message: ts.flattenDiagnosticMessageText(row.compilerObject.messageText, '\n'),
    }))
    return rows
  }
  try {
    const { generateTypesDefinitions } = require('../vue/internal/build/src/tasks/types-definitions.ts')
    assert.equal(typeof generateTypesDefinitions, 'function')
    await new Promise((resolve, reject) => generateTypesDefinitions((error) => error ? reject(error) : resolve()))
  } finally {
    Project.prototype.getPreEmitDiagnostics = originalDiagnostics
    await writeFile(path.join(evidenceDir, 'producer-diagnostics.json'), JSON.stringify({
      sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      compiler: ts.version,
      originalDiagnosticReturnUnchanged: true,
      diagnostics,
    }, null, 2) + '\n')
  }
  const affected = [
    `${selectDir}/index.ts`, `${selectDir}/src/select.vue.ts`, `${selectDir}/src/useSelect.ts`,
    'vue/packages/components/time-select/index.ts',
    'vue/packages/components/time-select/src/time-select.vue.ts',
    'vue/packages/components/pagination/src/components/sizes.vue.ts',
  ]
  assert.deepEqual(diagnostics.filter((row) => affected.includes(row.file)), [])
  for (const file of [
    'select/index.d.ts', 'select/src/select.vue.d.ts', 'select/src/useSelect.d.ts',
    'time-select/index.d.ts', 'time-select/src/time-select.vue.d.ts',
    'pagination/src/components/sizes.vue.d.ts',
  ]) {
    assert.ok((await readFile(path.join(root, 'dist/types/packages/components', file), 'utf8')).length > 0, file)
  }

  // Reuse the real canonical graph, then add untouched original implementations
  // as virtual siblings. Compare actual compiler-inferred types in one checker.
  const originalUseSelect = path.join(root, selectDir, 'src/useSelect.original.ts')
  capturedProject.createSourceFile(originalUseSelect, original(`${selectDir}/src/useSelect.ts`))
  const originalSelect = path.join(root, selectDir, 'src/select.original.ts')
  const originalSelectFile = capturedProject.createSourceFile(originalSelect,
    parse(original(`${selectDir}/src/select.vue`)).descriptor.script.content
      .replace("from './useSelect'", "from './useSelect.original'"),
  )
  const unboundOptions = originalSelectFile.getDescendantsOfKind(ts.SyntaxKind.Identifier)
    .filter((node) => node.getText() === 'Options')
  assert.equal(unboundOptions.length, 2)
  assert.ok(unboundOptions.every((node) => !node.getSymbol()?.getDeclarations().length), 'Original SFC has no declaration for its existing Popper Options annotation.')
  capturedProject.createSourceFile(path.join(root, selectDir, 'src/select.raworiginal.ts'), originalSelectFile.getFullText())
  const optionsProbeText = await readFile(path.join(root, 'tests/fixtures/public-classic-select-declaration/options-compatibility.ts'), 'utf8')
  const optionsProbe = capturedProject.createSourceFile(path.join(root, 'vue/classic-select-options-compatibility.ts'), optionsProbeText)
  const optionsProgram = capturedProject.getProgram().compilerObject
  const optionsDiagnostics = ts.getPreEmitDiagnostics(optionsProgram, optionsProgram.getSourceFile(optionsProbe.getFilePath())).map((row) => ({
    code: row.code,
    line: row.file && row.start != null ? row.file.getLineAndCharacterOfPosition(row.start).line + 1 : null,
    message: ts.flattenDiagnosticMessageText(row.messageText, '\n'),
  }))
  await writeFile(path.join(evidenceDir, 'raw-options-compatibility-diagnostics.json'), JSON.stringify(optionsDiagnostics, null, 2) + '\n')
  const optionsLine = (name) => optionsProbeText.split('\n').findIndex((line) => line.includes(name)) + 1
  assert.deepEqual(optionsDiagnostics.map(({ code, line }) => ({ code, line })), [
    { code: 2322, line: optionsLine('const repairedInvalidPlacement') },
    { code: 2322, line: optionsLine('const repairedInvalidStrategy') },
    { code: 2344, line: optionsLine('type RawPropsEquality') },
  ], 'Retain every raw diagnostic: original invalid values and both valid/omitted controls compile; repaired invalid values and raw equality fail.')
  // The original SFC never emitted a usable declaration for this free name.
  // Bind its unchanged Partial<Options> annotation to the existing Popper owner
  // before comparing the complete inferred SFC contract. Original useSelect
  // parameters, return fields and ref types are compared without normalization.
  const originalDirectiveEnd = originalSelectFile.getFullText().indexOf('\n', originalSelectFile.getFullText().indexOf('// @ts-nocheck'))
  assert.ok(originalDirectiveEnd >= 0)
  originalSelectFile.insertText(originalDirectiveEnd + 1, "import type { Options } from '@popperjs/core'\n")
  capturedProject.createSourceFile(path.join(root, selectDir, 'index.original.ts'),
    original(`${selectDir}/index.ts`).replace("from './src/select.vue'", "from './src/select.original'"),
  )
  const probeText = await readFile(path.join(root, 'tests/fixtures/public-classic-select-declaration/inferred-contract.ts'), 'utf8')
  const probe = capturedProject.createSourceFile(path.join(root, 'vue/classic-select-inferred-contract.ts'), probeText)
  const program = capturedProject.getProgram().compilerObject
  const probeDiagnostics = ts.getPreEmitDiagnostics(program, program.getSourceFile(probe.getFilePath()))
  const contractDiagnostics = probeDiagnostics.map((row) => ({
    code: row.code,
    line: row.file && row.start != null ? row.file.getLineAndCharacterOfPosition(row.start).line + 1 : null,
    message: ts.flattenDiagnosticMessageText(row.messageText, '\n'),
  }))
  await writeFile(path.join(evidenceDir, 'inferred-contract-diagnostics.json'), JSON.stringify(contractDiagnostics, null, 2) + '\n')
  assert.deepEqual(contractDiagnostics, [])
  const negative = capturedProject.createSourceFile(path.join(root, 'vue/classic-select-inferred-negative.ts'),
    probeText + '\ntype BrokenReturn = Omit<ReturnType<typeof RepairedUseSelect>, "tooltipRef"> & { tooltipRef: null };\ntype RejectBrokenReturn = Assert<Both<BrokenReturn, ReturnType<typeof OriginalUseSelect>>>;\n',
  )
  const negativeProgram = capturedProject.getProgram().compilerObject
  const negativeDiagnostics = ts.getPreEmitDiagnostics(negativeProgram, negativeProgram.getSourceFile(negative.getFilePath()))
  assert.ok(negativeDiagnostics.some((row) => row.code === 2344), 'The same checker must reject an altered ref return contract.')
  await writeFile(path.join(evidenceDir, 'inferred-contract-results.json'), JSON.stringify({
    originalSha, compiler: ts.version, positive: 'PASS', negative: 'PASS',
    originalUseSelectComparedUnmodified: true,
    originalSfcOptionsBinding: 'UNBOUND',
    rawPropsEquality: 'FAIL: TS2344 retained; intentional public popperOptions narrowing',
    rawOptionsCompatibility: { originalInvalidPlacement: 'ACCEPTED', originalInvalidStrategy: 'ACCEPTED', repairedInvalidPlacement: 'TS2322', repairedInvalidStrategy: 'TS2322', validCompletePartialOptions: 'ACCEPTED by both', omittedOptions: 'ACCEPTED by both', diagnostics: optionsDiagnostics },
    sfcComparisonNormalization: 'Bind only the original Partial<Options> free name to @popperjs/core Options; runtime, prop annotation and assertions unchanged.',
    normalizedEqualityPurpose: 'Check the intended declared contract after fixing the original free Options name; not raw original public type parity.',
    negativeCodes: negativeDiagnostics.map((row) => row.code),
    checked: ['parameters', 'return keys and fields', 'ref getter/setter', 'props', 'emits', 'slots', 'instance', 'default/named exports', 'installer extras'],
  }, null, 2) + '\n')
})
