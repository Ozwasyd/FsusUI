import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

// Run after `vitest list --json` for only table-core-popper-return.test.ts.
// Emit real declarations in memory; never alter dist or the source preimage.
const root = fileURLToPath(new URL('../../../../../', import.meta.url))
const require = createRequire(path.join(root, 'package.json'))
const { Project, ts } = require('ts-morph')
const { parse, compileScript } = require('vue/compiler-sfc')
const [
  unitList,
  outputDirectory,
  preimageRef = '07386a74f507d9a6e28559e2f9bea90bab81a00d',
] = process.argv.slice(2)
assert.ok(
  unitList && outputDirectory,
  'Pass the unit discovery JSON and evidence directory',
)
const relativeSource = 'vue/packages/components/table/src/util.ts'
const source = path.join(root, relativeSource)
const tests = path.join(root, 'vue/packages/components/table/__tests__')
const unitFile = path.join(tests, 'table-core-popper-return.test.ts')
const contractFile = path.join(tests, 'table-core-popper-return.test-d.ts')
const read = (file) => readFileSync(file, 'utf8')
const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const expectedNames = [
  'ordinary Table core Popper return > returns the real core instance with its original elements and options',
  'ordinary Table core Popper return > keeps replacement and scroll cleanup tied to the core instance',
]
const discovered = JSON.parse(read(unitList))
assert.equal(discovered.length, 2)
assert.deepEqual(
  discovered.map(({ name }) => name).sort(),
  expectedNames.toSorted(),
)
assert.ok(discovered.every(({ file }) => file === unitFile))
const unitAst = ts.createSourceFile(
  unitFile,
  read(unitFile),
  ts.ScriptTarget.Latest,
  true,
)
const calls = { describe: 0, it: 0, beforeEach: 0, afterEach: 0 }
function countCalls(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text in calls
  ) {
    calls[node.expression.text]++
  }
  ts.forEachChild(node, countCalls)
}
countCalls(unitAst)
assert.deepEqual(calls, { describe: 1, it: 2, beforeEach: 1, afterEach: 1 })
const contract = read(contractFile)
const contractAst = ts.createSourceFile(
  contractFile,
  contract,
  ts.ScriptTarget.Latest,
  true,
)
assert.deepEqual(
  contractAst.statements
    .filter(ts.isTypeAliasDeclaration)
    .filter((node) =>
      node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ),
    )
    .map((node) => node.name.text),
  ['OrdinaryTableCorePopperReturn', 'OrdinaryTableCorePopperNeverNull'],
)
console.log(JSON.stringify({ preflight: 'pass', names: expectedNames, calls }))

const preimage = execFileSync(
  'git',
  ['show', `${preimageRef}:${relativeSource}`],
  { cwd: root, encoding: 'utf8' },
)
const fixed = read(source)
const compilerOptions = {
  strict: true,
  skipLibCheck: false,
  preserveSymlinks: false,
  declaration: true,
  emitDeclarationOnly: true,
  noEmit: false,
}
const projectOptions = {
  tsConfigFilePath: path.join(root, 'vue/tsconfig.web.json'),
  skipAddingFilesFromTsConfig: true,
  compilerOptions,
}
const diagnostics = (project, file) =>
  project
    .getProgram()
    .compilerObject.getSemanticDiagnostics(file.compilerNode)
    .map((diagnostic) => ({
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
    }))
function checkDiagnostics(actual, count) {
  assert.equal(actual.length, count)
  assert.ok(actual.every(({ code }) => code === 2344))
}

const evidence = {
  preimageRef,
  producerTypeScript: ts.version,
  strict: true,
  skipLibCheck: false,
}
for (const [label, content] of [
  ['before', preimage],
  ['after', fixed],
]) {
  const project = new Project(projectOptions)
  const util = project.createSourceFile(source, content, { overwrite: true })
  // Match the canonical producer's SFC script compilation, using the actual Vue component.
  const popper = path.join(
    root,
    'vue/packages/components/popper/src/popper.vue',
  )
  const { descriptor } = parse(read(popper))
  let script =
    (read(popper).includes('@ts-nocheck') ? '// @ts-nocheck\n' : '') +
    (descriptor.script?.content ?? '')
  if (descriptor.scriptSetup)
    script += compileScript(descriptor, { id: 'xxx' }).content
  project.createSourceFile(
    `${popper}.${descriptor.scriptSetup?.lang ?? descriptor.script?.lang ?? 'js'}`,
    script,
  )
  const control = project.addSourceFileAtPath(contractFile)
  project.addSourceFileAtPath(path.join(root, 'vue/typings/env.d.ts'))
  const sourceControls = diagnostics(project, control)
  checkDiagnostics(sourceControls, label === 'before' ? 2 : 0)
  const emitted = util
    .getEmitOutput()
    .getOutputFiles()
    .filter((file) => file.getFilePath().endsWith('/util.d.ts'))
  assert.equal(emitted.length, 1)
  const declaration = emitted[0].getText()
  assert.ok(declaration.length > 0)
  const declarationAst = ts.createSourceFile(
    'util.d.ts',
    declaration,
    ts.ScriptTarget.Latest,
    true,
  )
  const functions = declarationAst.statements.filter(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'createTablePopper',
  )
  assert.equal(functions.length, 1)
  const returnType = functions[0].type.getText(declarationAst)
  if (label === 'before') {
    assert.match(returnType, /GlobalComponents/u)
  } else {
    assert.equal(returnType, 'ReturnType<typeof createPopper>')
    assert.doesNotMatch(
      declaration,
      /GlobalComponents|PopperInstance|@ts-nocheck/u,
    )
  }

  // Check the generated declaration itself, separately from the suppressed source file.
  const generatedProject = new Project(projectOptions)
  const generatedName = '__ordinary_core_popper_generated'
  const generated = generatedProject.createSourceFile(
    path.join(path.dirname(source), `${generatedName}.d.ts`),
    declaration,
  )
  const generatedControl = generatedProject.createSourceFile(
    contractFile,
    contract.replace("'../src/util'", `'../src/${generatedName}'`),
    { overwrite: true },
  )
  generatedProject.addSourceFileAtPath(path.join(root, 'vue/typings/env.d.ts'))
  const declarationDiagnostics = diagnostics(generatedProject, generated)
  const declarationControls = diagnostics(generatedProject, generatedControl)
  checkDiagnostics(declarationDiagnostics, label === 'before' ? 1 : 0)
  checkDiagnostics(declarationControls, label === 'before' ? 2 : 0)
  if (label === 'before')
    assert.match(declarationDiagnostics[0].message, /GlobalComponents/u)
  const directory = path.join(outputDirectory, label)
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'util.d.ts'), declaration)
  evidence[label] = {
    sourceControls,
    declarationDiagnostics,
    declarationControls,
    declarationSha256: sha256(declaration),
    returnType,
  }
}

const emitRuntime = (content) =>
  ts.transpileModule(content, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
    },
  }).outputText
assert.equal(
  emitRuntime(fixed),
  emitRuntime(preimage),
  'The type fix must preserve the complete emitted runtime',
)
evidence.runtimeSha256 = sha256(emitRuntime(fixed))
evidence.preimageSha256 = sha256(preimage)
evidence.sourceSha256 = sha256(fixed)
writeFileSync(
  path.join(outputDirectory, 'controls.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
)
console.log(
  JSON.stringify({
    result: 'pass',
    producerTypeScript: ts.version,
    beforeDeclarationErrors: 1,
    afterDeclarationErrors: 0,
    contractsPerPhase: 2,
    runtimeSha256: evidence.runtimeSha256,
  }),
)
