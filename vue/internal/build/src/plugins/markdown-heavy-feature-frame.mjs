import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../../..')
const pkgRoot = path.join(repoRoot, 'vue/packages')

const frameUrlRequest = './markdown-heavy-feature-frame.ts?worker&url'
const frameSource = path.resolve(
  pkgRoot,
  'wasm/markdown-heavy-feature-frame.ts',
)
const frameUrlOwner = path.resolve(
  pkgRoot,
  'wasm/markdown-heavy-feature-isolated-client.ts',
)
const frameVirtualId = '\0fsusui:markdown-heavy-feature-frame-url'

let frameAssetSource

const bundleMarkdownHeavyFeatureFrame = () => {
  frameAssetSource ??= (async () => {
    const result = await esbuild.build({
      entryPoints: [frameSource],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      minify: true,
      sourcemap: false,
      treeShaking: true,
      external: ['katex', 'mermaid', 'shiki', 'shiki/*'],
      alias: {
        '@fsusui/core': path.join(pkgRoot, 'core/src/index.ts'),
        '@fsusui/wasm': path.join(pkgRoot, 'wasm/index.ts'),
      },
    })
    const output = result.outputFiles?.[0]?.text ?? ''
    if (
      !output ||
      output.includes('sourceMappingURL') ||
      output.includes('?worker') ||
      output.includes('.worker.ts') ||
      output.includes('import.meta.url')
    ) {
      throw new Error(
        'markdown heavy feature frame must be one self-contained ESM asset',
      )
    }
    return output
  })()
  return frameAssetSource
}

export const MarkdownHeavyFeatureFrameUrl = (options) => {
  let assetReference

  return {
    name: 'fsusui-markdown-heavy-feature-frame-url',
    resolveId(id, importer) {
      if (id !== frameUrlRequest || importer !== frameUrlOwner) return null
      return frameVirtualId
    },
    async load(id) {
      if (id !== frameVirtualId) return null
      assetReference ??= this.emitFile({
        fileName: options.assetFileName,
        source: await bundleMarkdownHeavyFeatureFrame(),
        type: 'asset',
      })
      return `export default import.meta.ROLLUP_FILE_URL_${assetReference}`
    },
  }
}

export default { MarkdownHeavyFeatureFrameUrl }
