const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { execFileSync } = require('node:child_process')
const root = process.cwd()
const evidence = process.env.SLIDER_EVIDENCE_DIR
assert.ok(
  evidence,
  'SLIDER_EVIDENCE_DIR must name a writable evidence directory',
)
fs.mkdirSync(evidence, { recursive: true })
const req = createRequire(path.join(root, 'package.json'))
const { Project, ts } = req('ts-morph')
const vueCompiler = req('vue/compiler-sfc')
const baseline = '2d05f240e5fb04ac0cd602b4ed638ffe00b1859b'
const owned = 'vue/packages/components/slider/src/composables/use-slide.ts'
const originalText = (file) =>
  execFileSync('git', ['show', `${baseline}:${file}`], {
    cwd: root,
    encoding: 'utf8',
  })
for (const file of [
  'package.json',
  'pnpm-lock.yaml',
  'config/dependencies/npm-authority.json',
  'vue/packages/element-plus/package.json',
  'vue/internal/build/src/tasks/types-definitions.ts',
]) {
  assert.equal(
    fs.readFileSync(path.join(root, file), 'utf8'),
    originalText(file),
    `${file} identity`,
  )
}
assert.equal(ts.version, '5.9.2', 'canonical producer embedded TypeScript')
let observed = false
const originalDiagnostics = Project.prototype.getPreEmitDiagnostics
Project.prototype.getPreEmitDiagnostics = function (...args) {
  const rows = originalDiagnostics.apply(this, args)
  observed = true
  const diagnostics = rows.map((d) => ({
    code: d.getCode(),
    file: d
      .getSourceFile()
      ?.getFilePath()
      .replace(root + '/', '')
      .replace(/\.vue\.ts$/, '.vue'),
    start: d.getStart(),
    message: ts.flattenDiagnosticMessageText(
      d.compilerObject.messageText,
      '\n',
    ),
  }))
  const twin = this.createSourceFile(
    path.join(
      root,
      'vue/packages/components/slider/src/composables/original-slide.ts',
    ),
    originalText(owned).replace(
      'export const useSlide =',
      'export const originalUseSlide =',
    ) +
      '\nimport { useSlide as repairedUseSlide } from "./use-slide"\ntype Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false\ntype Assert<T extends true> = T\ntype ExactParameters = Assert<Equal<Parameters<typeof repairedUseSlide>, Parameters<typeof originalUseSlide>>>\ntype ExactReturn = Assert<Equal<ReturnType<typeof repairedUseSlide>, ReturnType<typeof originalUseSlide>>>\n',
  )
  const program = this.getProgram().compilerObject
  const checker = program.getTypeChecker()
  const fixedFn = this.getSourceFileOrThrow(path.join(root, owned))
    .getVariableDeclarationOrThrow('useSlide')
    .getInitializerOrThrow()
  const originalFn = twin
    .getVariableDeclarationOrThrow('originalUseSlide')
    .getInitializerOrThrow()
  const oldRet = checker
    .getTypeAtLocation(originalFn.compilerNode)
    .getCallSignatures()[0]
    .getReturnType()
  const newRet = checker
    .getTypeAtLocation(fixedFn.compilerNode)
    .getCallSignatures()[0]
    .getReturnType()
  const fields = oldRet.getProperties().map((p) => {
    const before = checker.getTypeOfSymbolAtLocation(p, originalFn.compilerNode)
    const q = newRet.getProperty(p.name)
    const after =
      q && checker.getTypeOfSymbolAtLocation(q, fixedFn.compilerNode)
    return {
      name: p.name,
      beforeToAfter: !!after && checker.isTypeAssignableTo(before, after),
      afterToBefore: !!after && checker.isTypeAssignableTo(after, before),
    }
  })
  const pairDiagnostics = program
    .getSemanticDiagnostics(twin.compilerNode)
    .map((d) => ({
      code: d.code,
      message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    }))
  this.removeSourceFile(twin)
  const runtime = []
  for (const file of [
    'vue/packages/components/slider/index.ts',
    owned,
    'vue/packages/components/slider/src/slider.vue',
  ]) {
    const compile = (content) =>
      file.endsWith('.vue')
        ? vueCompiler.compileScript(vueCompiler.parse(content).descriptor, {
            id: 'xxx',
          }).content
        : content
    const transpile = (content) =>
      ts.transpileModule(compile(content), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText
    const before = transpile(originalText(file))
    const after = transpile(fs.readFileSync(path.join(root, file), 'utf8'))
    runtime.push({ file, equal: before === after })
  }
  const report = {
    baseline,
    head: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    producerTypeScript: ts.version,
    originalDiagnosticReturnUnchanged: true,
    diagnostics,
    pairDiagnostics,
    fields,
    runtime,
  }
  fs.writeFileSync(
    path.join(evidence, 'producer.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
  assert.deepEqual(
    pairDiagnostics,
    [],
    'exact original inferred parameters and return contract',
  )
  assert.equal(fields.length, 19, 'complete original useSlide return')
  assert.ok(
    fields.every((p) => p.beforeToAfter && p.afterToBefore),
    'every original return field preserved in both directions',
  )
  assert.ok(
    runtime.every((p) => p.equal),
    'all three slider runtime scripts unchanged',
  )
  assert.equal(
    diagnostics.filter((d) => d.code === 7056).length,
    9,
    'only the three slider diagnostics removed',
  )
  assert.deepEqual(
    diagnostics.filter((d) =>
      d.file?.startsWith('vue/packages/components/slider/'),
    ),
    [],
    'no slider producer diagnostics',
  )
  return rows // Canonical diagnostic filtering, options and generation are unchanged.
}
const { generateTypesDefinitions } = req(
  path.join(root, 'vue/internal/build/src/tasks/types-definitions.ts'),
)
assert.equal(
  typeof generateTypesDefinitions,
  'function',
  'real canonical task preflight',
)
generateTypesDefinitions((error) => {
  try {
    if (error) throw error
    assert.ok(observed, 'canonical project was observed')
    for (const file of [
      'components/slider/index.d.ts',
      'components/slider/src/slider.vue.d.ts',
      'components/slider/src/composables/use-slide.d.ts',
    ]) {
      const output = path.join(root, 'dist/types/packages', file)
      assert.ok(
        fs.existsSync(output) && fs.statSync(output).size > 0,
        `real canonical output ${file}`,
      )
    }
    console.log(
      'PASS: canonical slider output, exact inferred contracts, unchanged runtime scripts',
    )
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
})
