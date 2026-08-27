export interface MarkdownSelectionToolbarPlacement {
  readonly anchor: { readonly start: number; readonly end: number; readonly epoch?: number }
  readonly visible: boolean
  readonly reason: "selection" | "collapsed" | "stale" | "epoch-mismatch"
}

export interface ResolveSelectionToolbarOptions {
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
    return { anchor: selection, visible: false, reason: "epoch-mismatch" }
  }

  if (revision !== expectedRevision) {
    return { anchor: selection, visible: false, reason: "stale" }
  }

  if (selection.start === selection.end) {
    return { anchor: selection, visible: false, reason: "collapsed" }
  }

  return {
    anchor: {
      start: Math.min(selection.start, selection.end),
      end: Math.max(selection.start, selection.end),
      epoch: options?.documentEpoch,
    },
    visible: true,
    reason: "selection",
  }
}

export const resolveMarkdownSelectionToolbarFocusReturn = (
  selection: { readonly start: number; readonly end: number },
) =>
  Object.freeze({
    target: "editor" as const,
    selection: Object.freeze({
      start: Math.min(selection.start, selection.end),
      end: Math.max(selection.start, selection.end),
    }),
  })

export type MarkdownSelectionToolbarMutationKind =
  | "dom-placement"
  | "naked-coordinates"
  | "selection-lost"
  | "stale-epoch-surface"

export const evaluateMarkdownSelectionToolbarMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: "dom-placement" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "naked-coordinates" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "selection-lost" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "stale-epoch-surface" as const, equivalent: false, accepted: false }),
    ]),
  })
