import type { MarkdownEditorDocumentIdentity } from './markdown-editor-transaction'

export interface MarkdownEditorOutlineRange {
  readonly start: number
  readonly end: number
}

export interface MarkdownEditorOutlineItem {
  readonly nodeId: string
  readonly sourceRange: MarkdownEditorOutlineRange
  readonly contentRange: MarkdownEditorOutlineRange
  readonly level: number
}

export interface MarkdownOutlineDiagnostic {
  readonly code: string
  readonly nodeId?: string
}

export type MarkdownEditorRevealResult =
  | 'success'
  | 'deleted'
  | 'stale'
  | 'not-found'
  | 'unsupported'

export interface MarkdownEditorOutlineInput {
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly revision: number
  readonly source: string
  readonly nodes: readonly {
    readonly kind: string
    readonly rawRange: MarkdownEditorOutlineRange
  }[]
}

const headingLevel = (source: string, range: MarkdownEditorOutlineRange): number => {
  const slice = source.slice(range.start, range.end)
  const match = /^(#{1,6})\s/u.exec(slice)
  return match ? match[1].length : 1
}

export const resolveMarkdownEditorOutline = (
  input: MarkdownEditorOutlineInput,
): readonly MarkdownEditorOutlineItem[] =>
  Object.freeze(
    input.nodes
      .filter((node) => node.kind === 'heading')
      .map((node, index) => {
        const sourceRange = Object.freeze({ ...node.rawRange })
        const contentStart = Math.min(
          sourceRange.end,
          sourceRange.start + headingLevel(input.source, sourceRange) + 1,
        )
        return Object.freeze({
          nodeId: `${input.documentIdentity.id}:${input.revision}:heading:${index}`,
          sourceRange,
          contentRange: Object.freeze({
            start: contentStart,
            end: sourceRange.end,
          }),
          level: headingLevel(input.source, sourceRange),
        })
      }),
  )

export const revealHeading = (
  outline: readonly MarkdownEditorOutlineItem[],
  nodeId: string,
  expected: { readonly documentIdentity: MarkdownEditorDocumentIdentity; readonly revision: number },
  actual: { readonly documentIdentity: MarkdownEditorDocumentIdentity; readonly revision: number },
): MarkdownEditorRevealResult => {
  if (
    expected.documentIdentity.id !== actual.documentIdentity.id ||
    expected.documentIdentity.epoch !== actual.documentIdentity.epoch ||
    expected.revision !== actual.revision
  ) {
    return 'stale'
  }
  return outline.some((item) => item.nodeId === nodeId) ? 'success' : 'not-found'
}

export const revealSourceRange = (
  outline: readonly MarkdownEditorOutlineItem[],
  range: MarkdownEditorOutlineRange,
): MarkdownEditorRevealResult =>
  outline.some(
    (item) =>
      item.sourceRange.start <= range.start && item.sourceRange.end >= range.end,
  )
    ? 'success'
    : 'not-found'
