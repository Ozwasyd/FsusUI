import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'

export const resolveMarkdownEditorProjection = (
  source: string,
  identity: MarkdownDocumentIdentity,
  projection?: MarkdownStableProjection,
) =>
  projection ??
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    identity,
  )

export const findNarrowestMarkdownSyntaxNode = (
  nodes: readonly MarkdownStableSyntaxNode[],
  matches: (node: MarkdownStableSyntaxNode) => boolean,
): MarkdownStableSyntaxNode | null =>
  [...nodes.filter(matches)].sort((left, right) => {
    const span =
      left.rawRange.end -
      left.rawRange.start -
      (right.rawRange.end - right.rawRange.start)
    return span !== 0 ? span : left.id.localeCompare(right.id)
  })[0] ?? null
