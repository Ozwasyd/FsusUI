import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
require('tsx/cjs')
const {
  preserveSfcTypeProps,
} = require('../vue/internal/build/src/utils/sfc-type-props.ts')
const { Project, ts } = require('ts-morph')
const vue = require('vue/compiler-sfc')

test('canonical compiler boundary retains inherited props and rejects illegal modes', () => {
  const setup =
    "import type { TransitionProps } from 'vue'\nconst props = withDefaults(defineProps<{ mode?: TransitionProps['mode']; enabled?: boolean }>(), { enabled: true })\n"
  const descriptor = vue.parse(
    `<script setup lang="ts">${setup}</script>`,
  ).descriptor
  const compiled = vue.compileScript(descriptor, { id: 'typed-props' }).content
  const check = (content, controls) => {
    const project = new Project({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        types: [],
      },
    })
    const component = project.createSourceFile(
      path.join(process.cwd(), 'vue/typed-props-fixture.ts'),
      content,
    )
    const consumer = project.createSourceFile(
      path.join(process.cwd(), 'vue/typed-props-consumer.ts'),
      `import Component from './typed-props-fixture'\nimport type { TransitionProps } from 'vue'\ntype Props = InstanceType<typeof Component>['$props']\ntype Equal<A, B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false\ntype Assert<T extends true> = T\n${ 
        controls}`,
    )
    const diagnostics = project.getPreEmitDiagnostics()
    assert.ok(
      diagnostics.every(
        (diagnostic) => diagnostic.getSourceFile() === consumer,
      ),
      project.formatDiagnosticsWithColorAndContext(diagnostics),
    )
    assert.ok(component.getDefaultExportSymbol())
    return diagnostics.map((diagnostic) => diagnostic.getCode())
  }
  const positive =
    "type SameMode = Assert<Equal<Props['mode'], TransitionProps['mode']>>\ntype SameBoolean = Assert<Equal<Props['enabled'], boolean | undefined>>\nconst props: Props = { mode: 'out-in' }\n"
  const negative =
    "const badString: Props['mode'] = 'invalid-mode'\nconst badNumber: Props['mode'] = 42\n"
  assert.deepEqual(check(compiled, positive), [2344])
  assert.deepEqual(check(compiled, negative), [2322])
  const retained = preserveSfcTypeProps(setup, compiled)
  assert.deepEqual(check(retained, positive), [])
  assert.deepEqual(check(retained, negative), [2322, 2322])
})

test('runtime-declared props retain their original compiler text and missing owners fail', () => {
  const setup = 'const props = defineProps({ enabled: Boolean })'
  const descriptor = vue.parse(
    `<script setup lang="ts">${setup}</script>`,
  ).descriptor
  const compiled = vue.compileScript(descriptor, {
    id: 'runtime-props',
  }).content
  assert.equal(preserveSfcTypeProps(setup, compiled), compiled)
  assert.throws(
    () =>
      preserveSfcTypeProps(
        'defineProps<{ enabled?: boolean }>()',
        'export default {}',
      ),
    /Missing compiled defineComponent owner/,
  )
})
