import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const consumerRoot = path.resolve(process.argv[2])
const requireConsumer = createRequire(path.join(consumerRoot, 'package.json'))
const ts = requireConsumer('typescript')
assert.equal(ts.version, '6.0.2')
assert.equal(requireConsumer('vue/package.json').version, '3.5.32')
const file = path.join(consumerRoot, 'packed-options-compatibility.ts')
const source = await readFile(path.join(import.meta.dirname, 'packed-options-compatibility.ts'), 'utf8')
await writeFile(file, source)
const options = {
  strict: true, skipLibCheck: false, noEmit: true,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  types: [], esModuleInterop: true,
}
const program = ts.createProgram([file], options)
const diagnostics = ts.getPreEmitDiagnostics(program).map((row) => ({
  file: row.file && path.relative(consumerRoot, row.file.fileName),
  line: row.file && row.start != null ? row.file.getLineAndCharacterOfPosition(row.start).line + 1 : null,
  code: row.code, message: ts.flattenDiagnosticMessageText(row.messageText, '\n'),
}))
const checker = program.getTypeChecker()
const sourceFile = program.getSourceFile(file)
const props = sourceFile.statements.find((node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'Props')
const prop = checker.getTypeAtLocation(props).getProperty('popperOptions')
const popperOptionsType = checker.typeToString(checker.getTypeOfSymbolAtLocation(prop, props))
const record = {
  artifactSourceSha: '6dd7dc60158ee4a9ffeea18612e1143c47f4b600',
  compiler: ts.version, vue: requireConsumer('vue/package.json').version,
  mode: 'Bundler', strict: true, skipLibCheck: false,
  popperOptionsType, rawCompile: 'FAIL', diagnostics,
}
await writeFile(path.join(consumerRoot, 'packed-options-compatibility-diagnostics.json'), JSON.stringify(record, null, 2) + '\n')
assert.equal(popperOptionsType, 'Partial<Options> | undefined')
assert.equal(diagnostics.length, 4, 'Retain two inherited absent barrels and both invalid Options values.')
assert.deepEqual(diagnostics.filter((row) => row.file === 'packed-options-compatibility.ts').map(({ code, line }) => ({ code, line })), [
  { code: 2322, line: 7 }, { code: 2322, line: 8 },
])
assert.ok(diagnostics.filter((row) => row.file !== 'packed-options-compatibility.ts').every((row) => row.code === 2307 && /Cannot find module '\.\/(cascader|slider)'/.test(row.message)))
console.log('Packed Options controls PASS: both invalid values rejected; complete legal Partial<Options>, omitted and undefined props accepted. Raw compile FAIL retains both inherited absent barrels.')
