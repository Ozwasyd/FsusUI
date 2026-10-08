import type {
  MarkdownHeavyFeatureProjectionSnapshot,
  MarkdownHeavyFeatureProjectionTracker,
} from '../../../wasm/markdown-heavy-feature-identity'

export const createRendererHeavyProjectionTracker = async () => {
  const { createMarkdownHeavyFeatureProjectionTracker } =
    await import('../../../wasm/markdown-heavy-feature-identity')
  const tracker = createMarkdownHeavyFeatureProjectionTracker()
  let cached: Readonly<{
    input: Parameters<MarkdownHeavyFeatureProjectionTracker['project']>[0]
    projection: MarkdownHeavyFeatureProjectionSnapshot | null
  }> | null = null

  return Object.freeze({
    project(
      input: Parameters<MarkdownHeavyFeatureProjectionTracker['project']>[0],
    ) {
      if (
        cached?.input.documentKey === input.documentKey &&
        cached.input.documentEpoch === input.documentEpoch &&
        cached.input.source === input.source
      ) {
        return cached.projection
      }
      const projection = tracker.project(input)
      cached = Object.freeze({ input: Object.freeze({ ...input }), projection })
      return projection
    },
  })
}
