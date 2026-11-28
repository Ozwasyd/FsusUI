import {
  calculateMarkdownEditorMetrics,
  createMarkdownEditorMetricsSession,
  defaultMarkdownEditorLocaleText,
  resolveMarkdownEditorCapabilityText,
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
  readonly layout: "hidden" | "inline" | "definition"
}

export const resolveMarkdownEditorStatus = (
  source: string,
  density: MarkdownEditorStatusDensity,
  localeText?: MarkdownEditorLocaleTextOverride,
  selection?: { readonly start: number; readonly end: number },
  capability?: readonly string[],
  state?: Partial<MarkdownEditorStatusState>,
  resolvedMetrics?: MarkdownEditorMetrics,
): MarkdownEditorStatusResolution => {
  const copy = resolveMarkdownEditorLocaleText(localeText ?? defaultMarkdownEditorLocaleText)
  const metrics =
    resolvedMetrics ??
    calculateMarkdownEditorMetrics(source, {
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
      ? resolvedCapability
          .filter((value) => value !== 'supported')
          .map((value) =>
            copy.capabilityAnnouncement(
              resolveMarkdownEditorCapabilityText(value, copy),
            ),
          )
          .join(', ')
      : resolvedCapability
          .filter((value) => value !== 'supported')
          .map((value) =>
            copy.capabilityAnnouncement(
              resolveMarkdownEditorCapabilityText(value, copy),
            ),
          )
          .join(', ')

  return Object.freeze({
    density,
    visible: density !== "none",
    metrics,
    charactersLabel: copy.metrics.characters,
    wordsLabel: copy.metrics.words,
    linesLabel: copy.metrics.lines,
    columnLabel: copy.metrics.column,
    selectionLabel: copy.metrics.selected,
    bytesLabel: copy.metrics.bytes,
    slotPayload,
    ariaLiveMessage,
    layout:
      density === 'none'
        ? 'hidden'
        : density === 'minimal'
          ? 'inline'
          : 'definition',
  })
}

export type MarkdownEditorStatusMutationKind =
  | "empty-footer"
  | "badge-dashboard"
  | "shrink-11px"
  | "capability-swallowed"
  | "full-rescan"
  | "product-read-time"

export const evaluateMarkdownEditorStatusMutations = () => {
  const source = `${'word '.repeat(20_000)}end`
  const none = resolveMarkdownEditorStatus(
    source,
    'none',
    undefined,
    undefined,
    ['fatal'],
  )
  const detailed = resolveMarkdownEditorStatus(source, 'detailed')
  const session = createMarkdownEditorMetricsSession()
  session.calculate(source)
  const next = `${source}!`
  const incremental = session.calculate(next, {
    change: { from: source.length, to: source.length, insert: '!' },
  })

  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: "empty-footer" as const,
        equivalent: none.visible || none.layout !== 'hidden',
        accepted: false,
      }),
      Object.freeze({
        kind: "badge-dashboard" as const,
        equivalent: detailed.layout !== 'definition',
        accepted: false,
      }),
      Object.freeze({
        kind: "shrink-11px" as const,
        equivalent: detailed.layout === 'hidden',
        accepted: false,
      }),
      Object.freeze({
        kind: "capability-swallowed" as const,
        equivalent: none.ariaLiveMessage.length === 0,
        accepted: false,
      }),
      Object.freeze({
        kind: "full-rescan" as const,
        equivalent: incremental.scannedCodeUnits === next.length,
        accepted: false,
      }),
      Object.freeze({
        kind: "product-read-time" as const,
        equivalent: 'readTime' in detailed.slotPayload.metrics,
        accepted: false,
      }),
    ]),
  })
}
