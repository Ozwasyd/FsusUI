import type { MarkdownEditorOutlineItem } from './markdown-editor-outline'

export interface MarkdownOutlineViewport {
  readonly start: number
  readonly end: number
}

export const resolveMarkdownActiveHeading = (
  items: readonly MarkdownEditorOutlineItem[],
  viewport: MarkdownOutlineViewport,
): MarkdownEditorOutlineItem | null => {
  const visible = items.filter(
    (item) => item.sourceRange.end > viewport.start && item.sourceRange.start < viewport.end,
  )
  if (visible.length === 0) {
    const before = items.filter((item) => item.sourceRange.start <= viewport.start)
    return before.at(-1) ?? null
  }
  return visible[0] ?? null
}

export const planMarkdownOutlineReveal = (
  items: readonly MarkdownEditorOutlineItem[],
  nodeId: string,
): { readonly status: 'success' | 'not-found'; readonly range?: { readonly start: number; readonly end: number } } => {
  const item = items.find((entry) => entry.nodeId === nodeId)
  if (!item) return { status: 'not-found' }
  return { status: 'success', range: item.sourceRange }
}

export type MarkdownOutlineActiveMutationKind = 'offset-active' | 'dom-scan'

export const evaluateMarkdownOutlineActiveMutations = (
  items: readonly MarkdownEditorOutlineItem[],
  viewport: MarkdownOutlineViewport,
) => {
  const authority = resolveMarkdownActiveHeading(items, viewport)
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'offset-active' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-scan' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}
