import assert from 'node:assert/strict'
import path from 'node:path'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { rollup } from 'rollup'
import vue from '@vitejs/plugin-vue'
import esbuild from 'rollup-plugin-esbuild'
import macroModule from '../vue/internal/build/src/utils/vue-macros.ts'

const { createVueMacros } = macroModule
const entry = path.resolve('vue/packages/motion/components/FsuTransition.vue')
const compile = async (production) => {
  const plugins = await createVueMacros({
    setupComponent: false,
    setupSFC: false,
    plugins: { vue: vue({ isProduction: production }) },
  })
  const bundle = await rollup({
    input: entry,
    external: (id) =>
      id !== entry && !id.startsWith(`${entry}?`) && !id.startsWith('\0'),
    plugins: [
      ...plugins,
      esbuild({ target: 'es2022', loaders: { '.vue': 'ts' } }),
    ],
    treeshake: false,
  })
  try {
    const result = await bundle.generate({ format: 'es' })
    return result.output.find((item) => item.type === 'chunk').code
  } finally {
    await bundle.close()
  }
}

test('real FsuTransition compilation is stable with concurrent cold macro factories', async () => {
  const concurrent = await Promise.all([
    compile(false),
    compile(true),
    compile(false),
    compile(true),
  ])
  const sequential = [await compile(false), await compile(true)]
  for (let index = 0; index < concurrent.length; index++) {
    assert.equal(concurrent[index], sequential[index % 2])
    assert.match(concurrent[index], /mode:\s*\{/u)
  }
  console.log(
    JSON.stringify({
      source: 'FsuTransition.vue',
      hashes: sequential.map((code) =>
        createHash('sha256').update(code).digest('hex'),
      ),
    }),
  )
})
