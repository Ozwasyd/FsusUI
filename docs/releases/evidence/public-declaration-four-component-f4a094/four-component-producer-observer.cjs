const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const root = '/workspace/FsusUI-public-declaration-integration'
const requireSource = createRequire(root + '/package.json')
const { Project, ts } = requireSource('ts-morph')
const diagnostics = []
let graphInventory = []
let dependencyInventory = []
const originalDiagnostics = Project.prototype.getPreEmitDiagnostics
Project.prototype.getPreEmitDiagnostics = function (...args) {
  const rows = originalDiagnostics.apply(this, args)
  const program = this.getProgram().compilerObject
  const checker = program.getTypeChecker()
  const sourceFiles = program.getSourceFiles()
  graphInventory = sourceFiles.filter(s => s.text.includes('interface GlobalComponents')).map(s => path.relative(root, s.fileName))
  const edges = new Map()
  for (const sf of sourceFiles) {
    if (!sf.fileName.startsWith(root + '/vue/')) continue
    const dependencies = new Set()
    function visit(node) {
      let literal
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) literal = node.moduleSpecifier
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) literal = node.argument.literal
      if (literal && ts.isStringLiteral(literal)) {
        const symbol = checker.getSymbolAtLocation(literal)
        for (const declaration of symbol && symbol.declarations || []) {
          const target = declaration.getSourceFile().fileName
          if (target.startsWith(root + '/vue/')) dependencies.add(target)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    edges.set(sf.fileName, [...dependencies])
  }
  const aliasPaths = ['inbox-primitives', 'metric-primitives', 'settings-primitives'].map(group => root + '/vue/packages/components/' + group + '/index.ts')
  dependencyInventory = rows.filter(d => d.getCode() === 7056).map(d => {
    const from = d.getSourceFile().getFilePath()
    const seen = new Set(), pending = [from]
    while (pending.length) {
      const next = pending.pop()
      if (seen.has(next)) continue
      seen.add(next)
      for (const target of edges.get(next) || []) pending.push(target)
    }
    return { source: path.relative(root, from), localModuleClosure: [...seen].sort().map(f => path.relative(root, f)), reachableAliasBarrels: aliasPaths.filter(f => seen.has(f)).map(f => path.relative(root, f)) }
  })
  for (const d of rows) {
    if (![7056, 2742].includes(d.getCode())) continue
    const source = d.getSourceFile()
    const pos = d.getStart() || 0
    const node = source && source.getDescendantAtPos(pos)
    const actualTrackedSource = source && path.relative(root, source.getFilePath()).replace(/\.vue\.ts$/, '.vue')
    const tracked = actualTrackedSource && require('node:child_process').spawnSync('git', ['ls-files', '--error-unmatch', actualTrackedSource], {cwd: root, encoding:'utf8'}).status === 0
    diagnostics.push({ actualTrackedSource, tracked, nodeKind: node && node.getKindName(), nodeText: node && node.getText().slice(0,300), sourceContext: source && source.getFullText().slice(Math.max(0,pos-200),pos+450), code: d.getCode(), file: source && path.relative(root, source.getFilePath()), start: d.getStart(), message: ts.flattenDiagnosticMessageText(d.compilerObject.messageText, '\n') })
  }
  return rows
}
const { generateTypesDefinitions } = requireSource(root + '/vue/internal/build/src/tasks/types-definitions.ts')
if (typeof generateTypesDefinitions !== 'function') throw Error('Positive canonical declaration task preflight failed')
generateTypesDefinitions(error => {
  const entries = ['cascader', 'select', 'slider', 'time-select'].map(component => ({ component, emitted: fs.existsSync(root + '/dist/types/packages/components/' + component + '/index.d.ts') }))
  fs.writeFileSync('/workspace/.setup/public-declaration-component-offers/four-component-producer-diagnostics.json', JSON.stringify({ sourceHead: 'f4a094f300384185918fc6d4be86e88d9ab9f097', producerTypeScript: ts.version, graphInventory, dependencyInventory, observationOnly: true, originalDiagnosticReturnUnchanged: true, diagnostics, entries, error: error ? String(error) : null }, null, 2) + '\n')
  if (error) { console.error(error); process.exitCode = 1 }
  else console.log('Canonical declaration task completed; original diagnostics were observed without changing its controls.')
})
