import {
  calculateMarkdownEditorMetrics,
  defaultMarkdownEditorLocaleText,
  resolveMarkdownEditorLocaleText,
  type MarkdownEditorLocaleTextOverride,
  type MarkdownEditorMetrics,
} from "./markdown-editor"

export type MarkdownEditorStatusDensity = "none" | "minimal" | "detailed"

export interface MarkdownEditorStatusState {
  readonly mode: string
  readonly readonly: boolean
  readonly disabled: boolean
  readonly loading: boolean
}

export interface MarkdownEditorStatusSlotPayload {
  readonly metrics: MarkdownEditorMetrics
  readonly state: MarkdownEditorStatusState
  readonly capability: readonly string[]
}

export interface MarkdownEditorStatusResolution {
  readonly density: MarkdownEditorStatusDensity
  readonly visible: boolean
  readonly metrics: MarkdownEditorMetrics
  readonly charactersLabel: string
  readonly wordsLabel: string
  readonly linesLabel: string
  readonly columnLabel: string
  readonly selectionLabel: string
  readonly bytesLabel: string
  readonly slotPayload: MarkdownEditorStatusSlotPayload
  readonly ariaLiveMessage: string
}

export const resolveMarkdownEditorStatus = (
  source: string,
  density: MarkdownEditorStatusDensity,
  localeText?: MarkdownEditorLocaleTextOverride,
  selection?: { readonly start: number; readonly end: number },
  capability?: readonly string[],
  state?: Partial<MarkdownEditorStatusState>,
): MarkdownEditorStatusResolution => {
  const copy = resolveMarkdownEditorLocaleText(localeText ?? defaultMarkdownEditorLocaleText)
  const metrics = calculateMarkdownEditorMetrics(source, {
    selection,
    includeBytes: density === "detailed",
  })

  const resolvedState: MarkdownEditorStatusState = Object.freeze({
    mode: state?.mode ?? "source",
    readonly: state?.readonly ?? false,
    disabled: state?.disabled ?? false,
    loading: state?.loading ?? false,
  })

  const resolvedCapability = Object.freeze([...(capability ?? [])])

  const slotPayload: MarkdownEditorStatusSlotPayload = Object.freeze({
    metrics,
    state: resolvedState,
    capability: resolvedCapability,
  })

  const ariaLiveMessage =
    density === "none"
      ? ""
      : density === "minimal"
        ? `${metrics.graphemeCount} ${copy.metrics.characters}, ${metrics.wordCount} ${copy.metrics.words}`
        : `Line ${metrics.caretLine ?? 1}, Column ${metrics.caretColumn ?? 1}, ${metrics.lineCount} lines, ${metrics.graphemeCount} ${copy.metrics.characters}, ${metrics.wordCount} ${copy.metrics.words}`

  return Object.freeze({
    density,
    visible: density !== "none",
    metrics,
    charactersLabel: copy.metrics.characters,
    wordsLabel: copy.metrics.words,
    linesLabel: "lines",
    columnLabel: "col",
    selectionLabel: "selected",
    bytesLabel: "bytes",
    slotPayload,
    ariaLiveMessage,
  })
}

export type MarkdownEditorStatusMutationKind =
  | "empty-footer"
  | "badge-dashboard"
  | "shrink-11px"
  | "capability-swallowed"
  | "full-rescan"
  | "product-read-time"

export const evaluateMarkdownEditorStatusMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: "empty-footer" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "badge-dashboard" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "shrink-11px" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "capability-swallowed" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "full-rescan" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "product-read-time" as const, equivalent: false, accepted: false }),
    ]),
  })
