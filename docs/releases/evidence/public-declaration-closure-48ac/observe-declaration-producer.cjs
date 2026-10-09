const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const root = '/workspace/FsusUI-public-declaration-closure'
const requireSource = createRequire(root + '/package.json')
const { Project, ts } = requireSource('ts-morph')
const diagnostics = []
const originalDiagnostics = Project.prototype.getPreEmitDiagnostics
Project.prototype.getPreEmitDiagnostics = function (...args) {
  const rows = originalDiagnostics.apply(this, args)
  for (const d of rows) {
    if (![7056, 2742].includes(d.getCode())) continue
    const source = d.getSourceFile()
    diagnostics.push({ code: d.getCode(), file: source && path.relative(root, source.getFilePath()), start: d.getStart(), message: ts.flattenDiagnosticMessageText(d.compilerObject.messageText, '\n') })
  }
  return rows
}
const { generateTypesDefinitions } = requireSource(root + '/vue/internal/build/src/tasks/types-definitions.ts')
if (typeof generateTypesDefinitions !== 'function') throw Error('Positive canonical declaration task preflight failed')
generateTypesDefinitions(error => {
  const entries = ['cascader', 'select', 'slider', 'time-select'].map(component => ({ component, emitted: fs.existsSync(root + '/dist/types/packages/components/' + component + '/index.d.ts') }))
  fs.writeFileSync('/workspace/.setup/public-declaration-closure/observed-producer-diagnostics.json', JSON.stringify({ sourceHead: '48ac5c2029a231e574a77a4aa537907f5bd447da', producerTypeScript: ts.version, observationOnly: true, originalDiagnosticReturnUnchanged: true, diagnostics, entries, error: error ? String(error) : null }, null, 2) + '\n')
  if (error) { console.error(error); process.exitCode = 1 }
  else console.log('Canonical declaration task completed; original diagnostics were observed without changing its controls.')
})
