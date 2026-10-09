import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'

const [directory, mode, ...files] = process.argv.slice(2)
const root = path.resolve(directory)
assert.ok(['bundler', 'node16'].includes(mode))
const allowed = ['positive.ts', 'positive-node16.ts', 'negative.ts', 'whole-package.ts', 'negative-node16-module.ts', 'unexpected-diagnostic.ts']
assert.ok(files.length > 0 && files.every((file) => allowed.includes(file)))
const require = createRequire(path.join(root, 'package.json'))
const ts = require('typescript')
assert.equal(ts.version, '6.0.2')
assert.equal(require('vue/package.json').version, '3.5.32')
const program = ts.createProgram(files.map((file) => path.join(root, file)), {
  strict: true, skipLibCheck: false, noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: mode === 'node16' ? ts.ModuleKind.Node16 : ts.ModuleKind.ESNext,
  moduleResolution: mode === 'node16' ? ts.ModuleResolutionKind.Node16 : ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], types: [], esModuleInterop: true,
})
process.stdout.write(`${JSON.stringify(ts.getPreEmitDiagnostics(program).map((row) => ({
  file: row.file && path.relative(root, row.file.fileName),
  line: row.file && row.start != null ? row.file.getLineAndCharacterOfPosition(row.start).line + 1 : null,
  code: row.code, message: ts.flattenDiagnosticMessageText(row.messageText, '\n'),
})))}\n`)
