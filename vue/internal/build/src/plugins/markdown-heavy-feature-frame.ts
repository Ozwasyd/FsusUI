import path from 'node:path'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { rollup } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { pkgRoot, projRoot } from '@element-plus/build-utils'
import { shouldIgnoreRollupWarning } from '../utils'
import { target } from '../build-info'

import type { Plugin } from 'rollup'

const frameUrlRequest = './markdown-heavy-feature-frame.ts?worker&url'
const frameSource = path.resolve(
  pkgRoot,
  'wasm/markdown-heavy-feature-frame.ts',
)
const frameUrlOwner = path.resolve(
  pkgRoot,
  'wasm/markdown-heavy-feature-isolated-client.ts',
)
const frameVirtualId = '\0element-plus:markdown-heavy-feature-frame-url'
const tsconfig = path.resolve(projRoot, 'vue/tsconfig.web.json')

let frameAssetSource: Promise<string> | undefined

const bundleMarkdownHeavyFeatureFrame = () => {
  frameAssetSource ??= (async () => {
    const bundle = await rollup({
      input: frameSource,
      onwarn(warning, warn) {
        if (shouldIgnoreRollupWarning(warning)) return
        warn(warning)
      },
      plugins: [
        json(),
        nodeResolve({
          browser: true,
          extensions: ['.mjs', '.js', '.json', '.ts'],
        }),
        commonjs(),
        esbuild({
          minify: true,
          sourceMap: false,
          target,
          treeShaking: true,
          tsconfig,
        }),
      ],
      treeshake: true,
    })

    try {
      const output = await bundle.generate({
        format: 'esm',
        inlineDynamicImports: true,
        sourcemap: false,
      })
      const chunks = output.output.filter((item) => item.type === 'chunk')
      if (
        chunks.length !== 1 ||
        output.output.length !== 1 ||
        chunks[0].imports.length > 0 ||
        chunks[0].dynamicImports.length > 0 ||
        chunks[0].referencedFiles.length > 0 ||
        chunks[0].code.includes('sourceMappingURL') ||
        chunks[0].code.includes('?worker') ||
        chunks[0].code.includes('.worker.ts') ||
        chunks[0].code.includes('import.meta.url')
      ) {
        throw new Error(
          'markdown heavy feature frame must be one self-contained ESM asset',
        )
      }
      return chunks[0].code
    } finally {
      await bundle.close()
    }
  })()
  return frameAssetSource
}

export const MarkdownHeavyFeatureFrameUrl = (options: {
  assetFileName: string
}): Plugin => {
  let assetReference: string | undefined

  return {
    name: 'element-plus-markdown-heavy-feature-frame-url',
    resolveId(id, importer) {
      if (id !== frameUrlRequest || importer !== frameUrlOwner) return
      return frameVirtualId
    },
    async load(id) {
      if (id !== frameVirtualId) return
      assetReference ??= this.emitFile({
        fileName: options.assetFileName,
        source: await bundleMarkdownHeavyFeatureFrame(),
        type: 'asset',
      })
      return `export default import.meta.ROLLUP_FILE_URL_${assetReference}`
    },
  }
}
