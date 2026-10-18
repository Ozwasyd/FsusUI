import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
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

test('the original Vue CLI preserves shadowed bindings and normalizes real Vue references', () => {
  const root = mkdtempSync(path.join(temporary, 'vue-cli-bindings-'))
  writeFileSync(
    path.join(root, 'source.ts'),
    `import {shallowRef} from 'vue'
import type {ShallowRef, ShallowRef as NativeRef} from 'vue'
import type * as Vue from 'vue'
export declare const Native: ShallowRef<string,string>
export declare const NativeQualified: Vue.ShallowRef<string,string>
export declare const NativeAliased: NativeRef<string,string>
export const NativeInferred = shallowRef<string>('value')
export namespace Legitimate {
  export declare const Nested: ShallowRef<string,string>
  export declare const Qualified: Vue.ShallowRef<string,string>
  export declare const Inline: import('vue').ShallowRef<string,string>
}
export namespace Local {
  export type ShallowRef<T,S=any> = {read:T;write:(value:S)=>void}
  export declare const Value: ShallowRef<string,string>
}
export namespace Shadow {
  export namespace Vue {
    export type ShallowRef<T,S=any> = {read:T;write:(value:S)=>void}
  }
  export declare const Value: Vue.ShallowRef<string,string>
}
export namespace LocalAlias {
  export type NativeRef<T,S=any> = {read:T;write:(value:S)=>void}
  export declare const Value: NativeRef<string,string>
}
`,
  )
  const compilerOptions = {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    strict: true,
    skipLibCheck: false,
    noEmitOnError: true,
    types: [],
  }
  const stockCli = path.resolve('node_modules/vue-tsc/bin/vue-tsc.js')
  let normalizedOutput
  for (const variant of ['raw', 'normalized']) {
    const configuration = path.join(root, `tsconfig.${variant}.json`)
    writeFileSync(
      configuration,
      JSON.stringify({
        compilerOptions: {
          ...compilerOptions,
          declaration: true,
          emitDeclarationOnly: true,
          outDir: `./${variant}`,
        },
        files: ['source.ts'],
      }),
    )
    const output = execFileSync(
      process.execPath,
      [
        variant === 'raw'
          ? stockCli
          : path.resolve('scripts/generate-package-declarations.mjs'),
        '-p',
        configuration,
      ],
      { encoding: 'utf8' },
    )
    if (variant === 'normalized') normalizedOutput = output
  }
  const native = [
    'Native',
    'NativeQualified',
    'NativeAliased',
    'NativeInferred',
    'Legitimate.Nested',
    'Legitimate.Qualified',
    'Legitimate.Inline',
  ]
  const local = ['Local', 'Shadow', 'LocalAlias']
  const compare = path.join(root, 'compare.ts')
  writeFileSync(
    compare,
    `import type * as raw from './raw/source'
import type * as normalized from './normalized/source'
type Assert<T extends true> = T
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false
type IsAny<T> = 0 extends 1 & T ? true:false
export type NativeContracts = [${native.map((name) => `Assert<Equal<typeof raw.${name},typeof normalized.${name}>>`).join(',')}]
export type LocalContracts = [${local.map((name) => `Assert<Equal<typeof raw.${name}.Value,typeof normalized.${name}.Value>>,Assert<Equal<Parameters<typeof normalized.${name}.Value.write>[0],string>>,Assert<Equal<IsAny<Parameters<typeof normalized.${name}.Value.write>[0]>,false>>`).join(',')}]
`,
  )
  const comparisonConfig = path.join(root, 'tsconfig.compare.json')
  writeFileSync(
    comparisonConfig,
    JSON.stringify({
      compilerOptions: { ...compilerOptions, noEmit: true },
      files: ['compare.ts'],
    }),
  )
  const comparison = spawnSync(
    process.execPath,
    [stockCli, '-p', comparisonConfig],
    { encoding: 'utf8' },
  )
  assert.equal(comparison.status, 0, comparison.stdout + comparison.stderr)
  assert.deepEqual(
    diagnostics(ts.createProgram([compare], { ...options, noEmit: true })),
    [],
  )
  assert.match(normalizedOutput, /"ShallowRef":7/u)
  const declaration = readFileSync(
    path.join(root, 'normalized/source.d.ts'),
    'utf8',
  )
  assert.match(declaration, /Native: ShallowRef<string>;/u)
  assert.match(declaration, /NativeQualified: Vue\.ShallowRef<string>;/u)
  assert.match(declaration, /NativeAliased: NativeRef<string>;/u)
})

test('unrelated local arguments are not rejected as non-default Vue arguments', () => {
  const root = mkdtempSync(path.join(temporary, 'vue-local-arguments-'))
  const source = `import type {ShallowRef} from 'vue'
export declare const Native: ShallowRef<string,string>
export namespace Local {
  export type ShallowRef<T,S=any> = {read:T;write:(value:S)=>void}
  export declare const Value: ShallowRef<string,number>
}
`
  const declaration = emit(root, source, true)
  assert.match(declaration, /Native: ShallowRef<string>;/u)
  assert.match(declaration, /Value: ShallowRef<string, number>;/u)
})
