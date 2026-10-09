import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
const root = process.cwd()
const output = process.argv[2]
const base = '2d05f240e5fb04ac0cd602b4ed638ffe00b1859b'
const requireSource = createRequire(path.join(root, 'package.json'))
const { Project, ts } = requireSource('ts-morph')
const compiler = requireSource('vue/compiler-sfc')
assert.equal(ts.version, '5.9.2')
assert.equal(requireSource('@element-plus/build-utils').projRoot, root)
const originalSource = execFileSync(
  'git',
  ['show', `${base}:vue/packages/components/cascader/src/cascader.vue`],
  { encoding: 'utf8' },
)
const originalCompiled = compiler.compileScript(
  compiler.parse(originalSource).descriptor,
  { id: 'xxx' },
).content
const originalDiagnostics = Project.prototype.getPreEmitDiagnostics
let result
Project.prototype.getPreEmitDiagnostics = function (...args) {
  const rows = originalDiagnostics.apply(this, args)
  const controls = []
  const directory = path.join(root, 'vue/packages/components/cascader/src')
  try {
    controls.push(
      this.createSourceFile(
        path.join(directory, 'cascader.original.vue.ts'),
        originalCompiled,
      ),
    )
    controls.push(
      this.createSourceFile(
        path.join(directory, 'contract-parity.ts'),
        `
import Current from './cascader.vue'
import Original from './cascader.original.vue'
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T
type ComponentParity = Assert<Same<typeof Current, typeof Original>>
type CurrentInstance = InstanceType<typeof Current>
type OriginalInstance = InstanceType<typeof Original>
type CheckedParameters = Assert<Same<Parameters<CurrentInstance['getCheckedNodes']>, Parameters<OriginalInstance['getCheckedNodes']>>>
type CheckedReturn = Assert<Same<ReturnType<CurrentInstance['getCheckedNodes']>, ReturnType<OriginalInstance['getCheckedNodes']>>>
type ToggleParameters = Assert<Same<Parameters<CurrentInstance['togglePopperVisible']>, Parameters<OriginalInstance['togglePopperVisible']>>>
type ToggleReturn = Assert<Same<ReturnType<CurrentInstance['togglePopperVisible']>, ReturnType<OriginalInstance['togglePopperVisible']>>>
type SlotsParity = Assert<Same<CurrentInstance['$slots'], OriginalInstance['$slots']>>
type EmitsParity = Assert<Same<CurrentInstance['$emit'], OriginalInstance['$emit']>>
type PropsParity = Assert<Same<CurrentInstance['$props'], OriginalInstance['$props']>>
type PanelParity = Assert<Same<CurrentInstance['cascaderPanelRef'], OriginalInstance['cascaderPanelRef']>>
type ContentParity = Assert<Same<CurrentInstance['contentRef'], OriginalInstance['contentRef']>>
`,
      ),
    )
    const observed = originalDiagnostics.apply(this, args)
    const parityErrors = observed.filter(
      (d) => controls.includes(d.getSourceFile()) && d.getCode() !== 7056,
    )
    const normalize = (d) => ({
      code: d.getCode(),
      source: path
        .relative(root, d.getSourceFile()?.getFilePath() || '')
        .replace(/\.vue\.ts$/, '.vue'),
      message: ts.flattenDiagnosticMessageText(
        d.compilerObject.messageText,
        '\n',
      ),
    })
    result = {
      producerTypeScript: ts.version,
      diagnostics: rows.map(normalize),
      parityErrors: parityErrors.map(normalize),
      originalSfc7056: observed.some(
        (d) => d.getSourceFile() === controls[0] && d.getCode() === 7056,
      ),
      assertions: [
        'entire inferred component',
        'props',
        'emits',
        'slots',
        'instance refs',
        'actual inferred getCheckedNodes and togglePopperVisible parameters and returns',
      ],
      originalDiagnosticReturnUnchanged: true,
    }
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
    assert.deepEqual(result.parityErrors, [])
    assert.equal(result.originalSfc7056, true)
  } finally {
    for (const control of controls) this.removeSourceFile(control)
  }
  return rows
}
const { generateTypesDefinitions } = requireSource(
  path.join(root, 'vue/internal/build/src/tasks/types-definitions.ts'),
)
assert.equal(typeof generateTypesDefinitions, 'function')
generateTypesDefinitions((error) => {
  if (error) {
    console.error(error)
    process.exitCode = 1
    return
  }
  assert.ok(result)
  result.entries = ['index.d.ts', 'src/cascader.vue.d.ts'].map((file) => ({
    file,
    emitted: fs.existsSync(
      path.join(root, 'dist/types/packages/components/cascader', file),
    ),
  }))
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
  assert.ok(result.entries.every((entry) => entry.emitted))
  assert.deepEqual(
    result.diagnostics.filter((d) =>
      d.source.startsWith('vue/packages/components/cascader/'),
    ),
    [],
  )
  process.stdout.write(
    'PASS canonical emission and original inferred contract parity\n',
  )
})
