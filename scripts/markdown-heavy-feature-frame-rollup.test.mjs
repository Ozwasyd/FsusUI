import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { rollup } from 'rollup'
import framePluginModule from '../vue/internal/build/src/plugins/markdown-heavy-feature-frame.ts'

const { MarkdownHeavyFeatureFrameUrl } = framePluginModule

const frameRequest = './markdown-heavy-feature-frame.ts?worker&url'
const ownerId = path.resolve(
  process.cwd(),
  'vue/packages/wasm/markdown-heavy-feature-isolated-client.ts',
)

const owner = (id = ownerId) => ({
  name: 'markdown-heavy-feature-frame-test-owner',
  resolveId(source) {
    if (source === id) return source
  },
  load(source) {
    if (source !== id) return
    return `import frameUrl from '${frameRequest}'; export default frameUrl`
  },
})

test('emits one self-contained asset and portable ESM, CJS, and UMD URLs', async () => {
  const bundle = await rollup({
    input: ownerId,
    plugins: [
      owner(),
      MarkdownHeavyFeatureFrameUrl({
        assetFileName: 'wasm/markdown-heavy-feature-frame.mjs',
      }),
    ],
  })

  try {
    for (const outputOptions of [
      { format: 'esm' },
      { exports: 'named', format: 'cjs' },
      {
        exports: 'named',
        format: 'umd',
        inlineDynamicImports: true,
        name: 'FsusMarkdownHeavyFeatureFrameProbe',
      },
    ]) {
      const output = await bundle.generate(outputOptions)
      const assets = output.output.filter((item) => item.type === 'asset')
      const chunks = output.output.filter((item) => item.type === 'chunk')
      assert.equal(assets.length, 1)
      assert.equal(assets[0].fileName, 'wasm/markdown-heavy-feature-frame.mjs')
      assert.match(
        String(assets[0].source),
        /fsus-markdown-heavy-feature-frame@1/u,
      )
      assert.doesNotMatch(
        String(assets[0].source),
        /import\.meta\.url|sourceMappingURL|\?worker|\.worker\.ts/u,
      )
      assert.equal(
        chunks.some((chunk) => chunk.imports.length > 0),
        false,
      )
      assert.match(
        chunks.map((chunk) => chunk.code).join('\n'),
        /wasm\/markdown-heavy-feature-frame\.mjs/u,
      )
    }
  } finally {
    await bundle.close()
  }
})

test('does not take ownership of the same query from another importer', async () => {
  const wrongOwner = path.resolve(
    process.cwd(),
    'vue/packages/wasm/markdown-heavy-feature-frame-wrong-owner.ts',
  )
  await assert.rejects(
    rollup({
      input: wrongOwner,
      plugins: [
        owner(wrongOwner),
        MarkdownHeavyFeatureFrameUrl({
          assetFileName: 'wasm/markdown-heavy-feature-frame.mjs',
        }),
      ],
    }),
    /worker&url|Could not load|ENOENT/u,
  )
})
