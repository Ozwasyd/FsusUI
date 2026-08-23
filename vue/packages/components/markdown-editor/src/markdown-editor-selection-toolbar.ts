export interface MarkdownSelectionToolbarPlacement {
  readonly anchor: { readonly start: number; readonly end: number }
  readonly visible: boolean
  readonly reason: 'selection' | 'collapsed' | 'stale'
}

export const resolveMarkdownSelectionToolbarPlacement = (
  selection: { readonly start: number; readonly end: number },
  revision: number,
  expectedRevision: number,
): MarkdownSelectionToolbarPlacement => {
  if (revision !== expectedRevision) {
    return { anchor: selection, visible: false, reason: 'stale' }
  }
  if (selection.start === selection.end) {
    return { anchor: selection, visible: false, reason: 'collapsed' }
  }
  return {
    anchor: {
      start: Math.min(selection.start, selection.end),
      end: Math.max(selection.start, selection.end),
    },
    visible: true,
    reason: 'selection',
  }
}
