const fs = require('node:fs')
const {createRequire} = require('node:module')
const path = require('node:path')
const root = '/workspace/FsusUI-public-declaration-closure'
const requireSource = createRequire(root + '/package.json')
const {Project, ts} = requireSource('ts-morph')
const original = Project.prototype.getPreEmitDiagnostics
let result
const marker = 'DIAGNOSTIC_ONLY_OBSERVATION_COMPLETE'
Project.prototype.getPreEmitDiagnostics = function (...args) {
  const before = original.apply(this, args)
  const file = this.getSourceFileOrThrow(root + '/vue/packages/components/date-picker/src/panel-utils.ts')
  const initializer = file.getVariableDeclarationOrThrow('getPanel').getInitializerOrThrow()
  const unannotated = initializer.getText()
  initializer.setReturnType('typeof DatePickPanel | typeof DateRangePickPanel | typeof MonthRangePickPanel')
  file.addStatements(`const getPanelInferredControl = ${unannotated}\ntype Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false\ntype Assert<T extends true> = T\ntype PanelReturnParity = Assert<Same<ReturnType<typeof getPanel>, ReturnType<typeof getPanelInferredControl>>>\ntype PanelParametersParity = Assert<Same<Parameters<typeof getPanel>, Parameters<typeof getPanelInferredControl>>>`)
  const after = original.apply(this, args)
  const output = file.getEmitOutput(true).getOutputFiles()
  const own = rows => rows.filter(d => d.getSourceFile() && d.getSourceFile().getFilePath() === file.getFilePath()).map(d => ({code:d.getCode(),message:ts.flattenDiagnosticMessageText(d.compilerObject.messageText,'\n')}))
  result = {
    sourceHead:'48ac5c2029a231e574a77a4aa537907f5bd447da', producerTypeScript:ts.version,
    mode:'Diagnostic-only in-memory source experiment; not an implemented source offer or tarball qualification',
    trackedSourceChanged:false, before7056:before.filter(d=>d.getCode()===7056).map(d=>path.relative(root,d.getSourceFile().getFilePath())),
    after7056:after.filter(d=>d.getCode()===7056).map(d=>path.relative(root,d.getSourceFile().getFilePath())),
    targetBefore:own(before),targetAfter:own(after),
    otherNewDiagnostics:after.filter(d=>![7056,2742].includes(d.getCode())).map(d=>({code:d.getCode(),message:ts.flattenDiagnosticMessageText(d.compilerObject.messageText,'\n')})),
    emittedDeclarations:output.map(f=>({path:path.relative(root,f.getFilePath()),bytes:f.getText().length})),
    proposedReturnAnnotation:'typeof DatePickPanel | typeof DateRangePickPanel | typeof MonthRangePickPanel',
  }
  for(const f of output) fs.writeFileSync('/workspace/.setup/public-declaration-closure/panel-return-annotation-probe.d.ts',f.getText())
  fs.writeFileSync('/workspace/.setup/public-declaration-closure/panel-return-annotation-probe.json',JSON.stringify(result,null,2)+'\n')
  throw Error(marker)
}
const {generateTypesDefinitions} = requireSource(root + '/vue/internal/build/src/tasks/types-definitions.ts')
if(typeof generateTypesDefinitions !== 'function') throw Error('Canonical task positive preflight failed')
generateTypesDefinitions(error => {
  if(!error || !String(error).includes(marker) || !result) {console.error(error || 'Missing observation');process.exitCode=1;return}
  const pass = result.targetBefore.some(d=>d.code===7056) && result.targetAfter.length===0 && result.otherNewDiagnostics.length===0 && result.emittedDeclarations.length>0
  console.log(JSON.stringify(result,null,2))
  console.log(pass?'PASS diagnostic-only parity/emit experiment; canonical task intentionally stopped before writing any generated artifacts':'FAIL diagnostic-only experiment')
  if(!pass) process.exitCode=1
})
