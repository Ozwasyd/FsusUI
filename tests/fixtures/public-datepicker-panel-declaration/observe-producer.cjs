const filename = process
  .getBuiltinModule('node:fs')
  .realpathSync(process.argv[1])
const requireSource = process
  .getBuiltinModule('node:module')
  .createRequire(filename)
const assert = requireSource('node:assert/strict')
const fs = requireSource('node:fs')
const path = requireSource('node:path')
const { execFileSync } = requireSource('node:child_process')
const { createHash } = requireSource('node:crypto')
const { Buffer } = requireSource('node:buffer')
const { Project, ts } = requireSource('ts-morph')

const root = path.resolve(path.dirname(filename), '../../..')
const baseline = '2d05f240e5fb04ac0cd602b4ed638ffe00b1859b'
const target = 'vue/packages/components/date-picker/src/panel-utils.ts'
const mode = process.argv[2]
assert.ok(['baseline', 'verify'].includes(mode))
const output = path.resolve(process.argv[3])
const originalSource = execFileSync('git', ['show', `${baseline}:${target}`], {
  cwd: root,
  encoding: 'utf8',
})
const source = fs.readFileSync(path.join(root, target), 'utf8')
const digest = (value) => createHash('sha256').update(value).digest('hex')
const runtime = (text) =>
  ts.transpileModule(text, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText
assert.equal(
  runtime(source),
  runtime(originalSource),
  'runtime JS must be identical',
)
assert.equal(ts.version, '5.9.2')
for (const file of [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'vue/tsconfig.base.json',
  'vue/tsconfig.web.json',
  'vue/packages/element-plus/package.json',
  'config/dependencies/npm-authority.json',
  'vue/internal/build/src/tasks/types-definitions.ts',
  'vue/internal/build/src/utils/pkg.ts',
]) {
  assert.equal(
    fs.readFileSync(path.join(root, file), 'utf8'),
    execFileSync('git', ['show', `${baseline}:${file}`], {
      cwd: root,
      encoding: 'utf8',
    }),
    `${file} must retain its original identity`,
  )
}

const expectedFiles = [
  'cascader/index.ts',
  'cascader/src/cascader.vue.ts',
  'date-picker/src/panel-utils.ts',
  'pagination/src/components/sizes.vue.ts',
  'select/index.ts',
  'select/src/select.vue.ts',
  'select/src/useSelect.ts',
  'slider/index.ts',
  'slider/src/composables/use-slide.ts',
  'slider/src/slider.vue.ts',
  'time-select/index.ts',
  'time-select/src/time-select.vue.ts',
].map((file) => `vue/packages/components/${file}`)
const diagnosticRows = (diagnostics) =>
  diagnostics.map((diagnostic) => ({
    code: diagnostic.getCode(),
    file:
      diagnostic.getSourceFile() &&
      path.relative(root, diagnostic.getSourceFile().getFilePath()),
    start: diagnostic.getStart(),
    message: ts.flattenDiagnosticMessageText(
      diagnostic.compilerObject.messageText,
      '\n',
    ),
  }))
const originalDiagnostics = Project.prototype.getPreEmitDiagnostics
let observation
Project.prototype.getPreEmitDiagnostics = function (...args) {
  const diagnostics = originalDiagnostics.apply(this, args)
  const rows = diagnosticRows(diagnostics)
  const actual = rows.filter((row) => row.code === 7056)
  assert.deepEqual(
    actual.map((row) => row.file),
    expectedFiles.filter((file) => mode === 'baseline' || file !== target),
  )
  assert.equal(rows.filter((row) => ![7056, 2742].includes(row.code)).length, 0)
  if (mode === 'baseline') {
    assert.equal(source, originalSource)
    assert.deepEqual(
      actual.find((row) => row.file === target),
      {
        code: 7056,
        file: target,
        start: 284,
        message:
          'The inferred type of this node exceeds the maximum length the compiler will serialize. An explicit type annotation is needed.',
      },
    )
  } else {
    const file = this.getSourceFileOrThrow(path.join(root, target))
    const originalFile = ts.createSourceFile(
      target,
      originalSource,
      ts.ScriptTarget.Latest,
      true,
    )
    const originalFunction = originalFile.statements
      .find(ts.isVariableStatement)
      .declarationList.declarations[0].initializer.getText(originalFile)
    const statements = file.addStatements(`
const getPanelInferredControl = ${originalFunction}
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T
type ParameterParity = Assert<Same<Parameters<typeof getPanel>, Parameters<typeof getPanelInferredControl>>>
type ReturnParity = Assert<Same<ReturnType<typeof getPanel>, ReturnType<typeof getPanelInferredControl>>>
type ParameterMutationRejected = Assert<Same<Parameters<typeof getPanel>, [number]>>
type ReturnMutationRejected = Assert<Same<ReturnType<typeof getPanel>, typeof DatePickPanel>>
`)
    try {
      const controls = diagnosticRows(
        originalDiagnostics.apply(this, args),
      ).filter((row) => row.file === target)
      assert.equal(
        controls.length,
        2,
        'only the two intentional unequal contracts must fail',
      )
      assert.ok(controls.every((row) => row.code === 2344))
      const checker = this.getTypeChecker().compilerObject
      const initializer = file
        .getVariableDeclarationOrThrow('getPanel')
        .getInitializerOrThrow().compilerNode
      const signatures = checker
        .getTypeAtLocation(initializer)
        .getCallSignatures()
      assert.equal(
        signatures.length,
        1,
        'preserve the original single call signature',
      )
    } finally {
      for (const statement of statements.reverse()) statement.remove()
    }
    assert.equal(
      file.getFullText(),
      source,
      'controls must leave the producer source unchanged',
    )
  }
  observation = {
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    baseline,
    producerTypeScript: ts.version,
    producerTsMorph: requireSource('ts-morph/package.json').version,
    lockfileSha256: digest(fs.readFileSync(path.join(root, 'pnpm-lock.yaml'))),
    originalDiagnosticReturnUnchanged: true,
    runtimeJsSha256: digest(runtime(source)),
    inferredParameterAndReturnParity: mode === 'verify' ? 'PASS' : 'UNRUN',
    intentionalContractMutationsRejected: mode === 'verify' ? 2 : 0,
    diagnostics: rows,
  }
  return diagnostics
}

const { generateTypesDefinitions } = requireSource(
  path.join(root, 'vue/internal/build/src/tasks/types-definitions.ts'),
)
assert.equal(typeof generateTypesDefinitions, 'function')
generateTypesDefinitions((error) => {
  Project.prototype.getPreEmitDiagnostics = originalDiagnostics
  const declarationPath = path.join(
    root,
    'dist/types/packages/components/date-picker/src/panel-utils.d.ts',
  )
  const declaration = fs.existsSync(declarationPath)
    ? fs.readFileSync(declarationPath, 'utf8')
    : null
  const result = {
    ...observation,
    mode,
    canonicalProducerError: error ? String(error) : null,
    declaration,
  }
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
  if (error) {
    console.error(error)
    process.exitCode = 1
    return
  }
  assert.ok(observation, 'canonical producer observation must execute')
  if (mode === 'verify') {
    assert.ok(declaration)
    assert.equal(Buffer.byteLength(declaration), 411)
    assert.match(
      declaration,
      /getPanel: \(type: IDatePickerType\) => typeof DatePickPanel \| typeof DateRangePickPanel \| typeof MonthRangePickPanel/,
    )
  }
  process.stdout.write(
    `PASS canonical producer ${mode}; TS7056=${observation.diagnostics.filter((row) => row.code === 7056).length}\n`,
  )
})
