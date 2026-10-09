const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const root = process.argv[2]
const requireConsumer = createRequire(path.join(root, 'package.json'))
const ts = requireConsumer('typescript')
const results = {}
for (const name of ['positive', 'negative', 'aggregate', 'library']) {
  const file = path.join(root, name + '.ts')
  const program = ts.createProgram([file], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: false,
    noEmit: true,
    types: [],
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  })
  results[name] = ts.getPreEmitDiagnostics(program).map((d) => ({
    code: d.code,
    file: d.file && path.relative(root, d.file.fileName),
    line:
      d.file && d.start !== undefined
        ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
        : null,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
  }))
}
results.typescript = ts.version
results.vue = requireConsumer('vue/package.json').version
results.package = requireConsumer.resolve('@ozwasyd/element-plus')
fs.writeFileSync(
  path.join(root, 'diagnostics.json'),
  JSON.stringify(results, null, 2) + '\n',
)
console.log(JSON.stringify(results, null, 2))
