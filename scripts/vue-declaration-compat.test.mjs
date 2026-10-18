import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { withVueDeclarationDefaults } from './vue-declaration-compat.mjs'

const temporary = path.resolve('.tmp')
mkdirSync(temporary, { recursive: true })
const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: false,
  declaration: true,
  emitDeclarationOnly: true,
  noEmitOnError: true,
  types: [],
}
const diagnostics = (program) =>
  ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
const emit = (root, text, compatible) => {
  const input = path.join(root, 'source.ts')
  writeFileSync(input, text)
  const program = ts.createProgram([input], { ...options, outDir: root })
  assert.deepEqual(diagnostics(program), [])
  if (compatible) withVueDeclarationDefaults(ts, program)
  const result = program.emit()
  assert.equal(result.emitSkipped, false)
  return readFileSync(path.join(root, 'source.d.ts'), 'utf8')
}

test('real Vue emit omits only added defaults and retains the complete latest component/ref types', () => {
  const root = mkdtempSync(path.join(temporary, 'vue-defaults-'))
  const source = `import {defineComponent, shallowRef} from 'vue'
export const Component = defineComponent({props:{label:{type:String,required:true}},setup(){return {count:1}}})
export const Value = shallowRef<{id:string}>({id:'a'})
`
  const raw = emit(root, source, false)
  const normalized = emit(root, source, true)
  assert.notEqual(
    raw,
    normalized,
    'the unmodified real compiler must reproduce redundant trailing arguments',
  )
  writeFileSync(path.join(root, 'raw.d.ts'), raw)
  writeFileSync(path.join(root, 'normalized.d.ts'), normalized)
  const compare = path.join(root, 'compare.ts')
  writeFileSync(
    compare,
    `import type * as raw from './raw'
import type * as normalized from './normalized'
type Assert<T extends true> = T
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false
type IsAny<T> = 0 extends 1 & T ? true:false
export type Contract = [Assert<Equal<typeof raw.Component,typeof normalized.Component>>,Assert<Equal<typeof raw.Value,typeof normalized.Value>>,Assert<Equal<IsAny<typeof normalized.Component>,false>>,Assert<Equal<InstanceType<typeof raw.Component>['$props'],InstanceType<typeof normalized.Component>['$props']>>,Assert<Equal<InstanceType<typeof raw.Component>['$slots'],InstanceType<typeof normalized.Component>['$slots']>>]
`,
  )
  assert.deepEqual(
    diagnostics(ts.createProgram([compare], { ...options, noEmit: true })),
    [],
  )
})

test('refuses a real non-default ShallowRef setter type', () => {
  const root = mkdtempSync(path.join(temporary, 'vue-non-default-'))
  const source = `import type {ShallowRef} from 'vue'
export declare const Value: ShallowRef<{read:string},{write:string}>
`
  assert.throws(
    () => emit(root, source, true),
    /Non-default Vue ShallowRef argument 2/u,
  )
})

test('refuses a real non-default component element type', () => {
  const root = mkdtempSync(path.join(temporary, 'vue-element-'))
  const source = `export declare const Value: import('vue').DefineComponent<${Array(19).fill('any').join(',')},HTMLDivElement>\n`
  assert.throws(
    () => emit(root, source, true),
    /Non-default Vue DefineComponent argument 20/u,
  )
})

test('the original Vue CLI program applies the same default normalization', () => {
  const root = mkdtempSync(path.join(temporary, 'vue-cli-defaults-'))
  writeFileSync(
    path.join(root, 'source.ts'),
    `import {defineComponent,shallowRef} from 'vue'\nexport const Component = defineComponent({})\nexport const Value = shallowRef<{id:string}>()\n`,
  )
  writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        skipLibCheck: false,
        declaration: true,
        emitDeclarationOnly: true,
        types: [],
        outDir: './output',
      },
      files: ['source.ts'],
    }),
  )
  const output = execFileSync(
    process.execPath,
    [
      path.resolve('scripts/generate-package-declarations.mjs'),
      '-p',
      path.join(root, 'tsconfig.json'),
    ],
    { encoding: 'utf8' },
  )
  assert.match(output, /"DefineComponent":1/u)
  assert.match(output, /"ShallowRef":1/u)
  const declaration = readFileSync(
    path.join(root, 'output/source.d.ts'),
    'utf8',
  )
  assert.doesNotMatch(declaration, /, any>;/u)
})
