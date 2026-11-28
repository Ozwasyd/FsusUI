import type { Plugin } from 'rollup'

export interface MarkdownHeavyFeatureFramePluginOptions {
  baseDir: string
  assetFileName?: string
  chunkPrefix?: string
}

export declare function MarkdownHeavyFeatureFrameUrl(
  options: MarkdownHeavyFeatureFramePluginOptions,
): Plugin

export default MarkdownHeavyFeatureFrameUrl
