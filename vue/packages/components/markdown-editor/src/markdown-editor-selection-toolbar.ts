import {
  createMarkdownAnchorMap,
  type MarkdownAnchorMap,
  type MarkdownSourceReveal,
  type MarkdownVisualSelection,
} from '../../../wasm/markdown-runtime'

export interface MarkdownSelectionToolbarPlacement {
  readonly anchor: {
    readonly start: number
    readonly end: number
    readonly epoch?: number
  }
  readonly reveal?: MarkdownSourceReveal
  readonly visual?: MarkdownVisualSelection
  readonly visible: boolean
  readonly reason: 'selection' | 'collapsed' | 'stale' | 'epoch-mismatch'
}

export interface ResolveSelectionToolbarOptions {
  readonly anchorMap?: MarkdownAnchorMap
  readonly documentEpoch?: number
  readonly expectedEpoch?: number
}

export const resolveMarkdownSelectionToolbarPlacement = (
  selection: { readonly start: number; readonly end: number },
  revision: number,
  expectedRevision: number,
  options?: ResolveSelectionToolbarOptions,
): MarkdownSelectionToolbarPlacement => {
  if (
    options?.documentEpoch !== undefined &&
    options?.expectedEpoch !== undefined &&
    options.documentEpoch !== options.expectedEpoch
  ) {
    return { anchor: selection, visible: false, reason: 'epoch-mismatch' }
  }

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
      epoch: options?.documentEpoch,
    },
    ...(options?.anchorMap
      ? {
          reveal: options.anchorMap.sourceRangeToReveal({
            start: Math.min(selection.start, selection.end),
            end: Math.max(selection.start, selection.end),
          }),
          visual: options.anchorMap.sourceSelectionToVisual({
            anchor: selection.start,
            focus: selection.end,
          }),
        }
      : {}),
    visible: true,
    reason: 'selection',
  }
}

export const resolveMarkdownSelectionToolbarFocusReturn = (selection: {
  readonly start: number
  readonly end: number
}) =>
  Object.freeze({
    target: 'editor' as const,
    selection: Object.freeze({
      start: Math.min(selection.start, selection.end),
      end: Math.max(selection.start, selection.end),
    }),
  })

export type MarkdownSelectionToolbarMutationKind =
  | 'dom-placement'
  | 'naked-coordinates'
  | 'selection-lost'
  | 'stale-epoch-surface'

export const evaluateMarkdownSelectionToolbarMutations = () => {
  const selection = Object.freeze({ start: 4, end: 12 })
  const anchorMap = createMarkdownAnchorMap({
    identity: { id: 'selection-toolbar', epoch: 2 },
    source: 'one selected phrase',
  })
  const authority = resolveMarkdownSelectionToolbarPlacement(selection, 3, 3, {
    anchorMap,
    documentEpoch: 2,
    expectedEpoch: 2,
  })
  const focusReturn = resolveMarkdownSelectionToolbarFocusReturn(selection)
  const staleEpoch = resolveMarkdownSelectionToolbarPlacement(selection, 3, 3, {
    documentEpoch: 2,
    expectedEpoch: 3,
  })
  const syntheticDomRange = Object.freeze({ start: 0, end: 0 })
  const nakedViewportCoordinates = Object.freeze({ start: 20, end: 80 })

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'dom-placement' as const,
        equivalent:
          !authority.visual ||
          (syntheticDomRange.start === authority.anchor.start &&
            syntheticDomRange.end === authority.anchor.end),
        accepted: false,
      }),
      Object.freeze({
        kind: 'naked-coordinates' as const,
        equivalent:
          !authority.reveal ||
          (nakedViewportCoordinates.start === authority.anchor.start &&
            nakedViewportCoordinates.end === authority.anchor.end),
        accepted: false,
      }),
      Object.freeze({
        kind: 'selection-lost' as const,
        equivalent: focusReturn.selection.start === focusReturn.selection.end,
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-epoch-surface' as const,
        equivalent: staleEpoch.visible,
        accepted: false,
      }),
    ]),
  })
}
