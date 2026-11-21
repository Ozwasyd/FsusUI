import type {
  MarkdownStableProjection,
  MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'
import {
  collectMarkdownLiveInlineDecorations,
  type MarkdownLiveRevealPlan,
} from './markdown-editor-live-reveal'
import type {
  MarkdownEditorFocusBlock,
  MarkdownEditorFocusState,
} from './markdown-editor-writing-aids'

export const MARKDOWN_LIVE_VISUAL_WINDOW_THRESHOLD = 50_000

export type MarkdownLiveVisualSegmentKind =
  | 'heading'
  | 'strong'
  | 'emphasis'
  | 'strong-emphasis'
  | 'inline-code'
  | 'link-label'
  | 'link-destination'
  | 'image-alt'
  | 'list-marker'
  | 'task-marker'
  | 'task-checked'
  | 'quote'
  | 'code-block'
  | 'code-language'
  | 'table-header'
  | 'table-marker'
  | 'malformed'
  | 'plain'

export interface MarkdownLiveVisualSegment {
  readonly key: string
  readonly start: number
  readonly end: number
  readonly text: string
  readonly kind: MarkdownLiveVisualSegmentKind
  readonly marker: boolean
  readonly revealed: boolean
  readonly dimmed: boolean
  readonly exempt: boolean
  readonly nodeId?: string
}

export interface MarkdownLiveVisualInput {
  readonly source: string
  readonly projection?: MarkdownStableProjection
  readonly reveal?: MarkdownLiveRevealPlan | null
  readonly focusState?: MarkdownEditorFocusState | null
  readonly activeNodeIds?: readonly string[] | ReadonlySet<string> | null
}

interface VisualSpan {
  readonly start: number
  readonly end: number
  readonly kind: MarkdownLiveVisualSegmentKind
  readonly marker: boolean
  readonly priority: number
}

type SweepEvent =
  | {
      readonly offset: number
      readonly type: 'visual-enter' | 'visual-exit'
      readonly span: VisualSpan
    }
  | {
      readonly offset: number
      readonly type: 'reveal-enter' | 'reveal-exit'
    }
  | {
      readonly offset: number
      readonly type: 'focus-enter' | 'focus-exit'
      readonly block: MarkdownEditorFocusBlock
    }

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff

const clampBoundary = (source: string, offset: number): number => {
  const clamped = Math.max(0, Math.min(source.length, Math.trunc(offset)))
  if (
    clamped > 0 &&
    clamped < source.length &&
    isHighSurrogate(source.charCodeAt(clamped - 1)) &&
    isLowSurrogate(source.charCodeAt(clamped))
  ) {
    return clamped - 1
  }
  return clamped
}

const FENCE_OPEN_WITH_LANG_RE =
  /^([ \t]*(?:`{3,}|~{3,}|:{3,}))([ \t]*)(\S(?:.*\S)?)[ \t]*$/

const collectBlockSpans = (
  source: string,
  nodes: readonly MarkdownStableSyntaxNode[],
  activeSet: ReadonlySet<string> | null,
  pushSpan: (
    start: number,
    end: number,
    kind: MarkdownLiveVisualSegmentKind,
    marker: boolean,
    priority: number,
  ) => void,
) => {
  for (const node of nodes) {
    if (activeSet && !activeSet.has(node.id)) {
      continue
    }

    if (node.kind === 'malformed' || node.status === 'malformed') {
      pushSpan(node.rawRange.start, node.rawRange.end, 'malformed', false, 70)
      for (const range of node.rawMarkerRanges) {
        pushSpan(range.start, range.end, 'malformed', true, 75)
      }
      continue
    }

    if (node.kind === 'heading') {
      pushSpan(node.rawRange.start, node.rawRange.end, 'heading', false, 10)
      for (const range of node.rawMarkerRanges) {
        pushSpan(range.start, range.end, 'heading', true, 20)
      }
      continue
    }

    if (node.kind === 'quote') {
      pushSpan(node.rawRange.start, node.rawRange.end, 'quote', false, 10)
      for (const range of node.rawMarkerRanges) {
        pushSpan(range.start, range.end, 'quote', true, 20)
      }
      continue
    }

    if (node.kind === 'list') {
      for (const range of node.rawMarkerRanges) {
        pushSpan(range.start, range.end, 'list-marker', true, 20)
      }
      continue
    }

    if (node.kind === 'task') {
      const sortedMarkers = [...node.rawMarkerRanges].sort(
        (left, right) => left.start - right.start,
      )
      for (let index = 0; index < sortedMarkers.length; index += 1) {
        const markerRange = sortedMarkers[index]!
        const markerText = source.slice(markerRange.start, markerRange.end)
        const isTaskCheckbox = /\[[ xX]\]/.test(markerText)
        pushSpan(
          markerRange.start,
          markerRange.end,
          isTaskCheckbox ? 'task-marker' : 'list-marker',
          true,
          20,
        )
        if (/\[[xX]\]/.test(markerText)) {
          const limit =
            sortedMarkers[index + 1]?.start ?? node.rawRange.end
          for (const contentRange of node.rawContentRanges) {
            if (
              contentRange.start >= markerRange.end &&
              contentRange.end <= limit
            ) {
              pushSpan(
                contentRange.start,
                contentRange.end,
                'task-checked',
                false,
                10,
              )
            }
          }
        }
      }
      continue
    }

    if (
      node.kind === 'code' ||
      node.kind === 'mermaid' ||
      node.kind === 'latex'
    ) {
      pushSpan(node.rawRange.start, node.rawRange.end, 'code-block', false, 10)
      for (let index = 0; index < node.rawMarkerRanges.length; index += 1) {
        const range = node.rawMarkerRanges[index]!
        if (index === 0) {
          const markerText = source.slice(range.start, range.end)
          const match = markerText.match(FENCE_OPEN_WITH_LANG_RE)
          if (match) {
            const fenceEnd = range.start + match[1]!.length
            const langStart = fenceEnd + match[2]!.length
            const langEnd = langStart + match[3]!.length
            pushSpan(range.start, fenceEnd, 'code-block', true, 20)
            pushSpan(langStart, langEnd, 'code-language', false, 25)
            if (langEnd < range.end) {
              pushSpan(langEnd, range.end, 'code-block', true, 20)
            }
            continue
          }
        }
        pushSpan(range.start, range.end, 'code-block', true, 20)
      }
      continue
    }

    if (node.kind === 'table') {
      if (node.table) {
        const { rows, separatorRow } = node.table
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex]!
          if (rowIndex === separatorRow) {
            pushSpan(
              row.rawRange.start,
              row.rawRange.end,
              'table-marker',
              true,
              20,
            )
            continue
          }

          const sortedCells = [...row.rawCellRanges].sort(
            (left, right) => left.start - right.start,
          )
          if (rowIndex < separatorRow) {
            for (const cell of sortedCells) {
              pushSpan(cell.start, cell.end, 'table-header', false, 10)
            }
          }

          let cursor = row.rawRange.start
          const scanPipes = (from: number, to: number) => {
            for (let offset = from; offset < to; offset += 1) {
              if (source[offset] === '|') {
                pushSpan(offset, offset + 1, 'table-marker', true, 20)
              }
            }
          }
          for (const cell of sortedCells) {
            if (cell.start > cursor) {
              scanPipes(cursor, cell.start)
            }
            cursor = Math.max(cursor, cell.end)
          }
          if (cursor < row.rawRange.end) {
            scanPipes(cursor, row.rawRange.end)
          }
        }
      } else {
        for (const range of node.rawMarkerRanges) {
          pushSpan(range.start, range.end, 'table-marker', true, 20)
        }
      }
      continue
    }

    if (node.kind === 'footnote') {
      for (const range of node.rawMarkerRanges) {
        pushSpan(range.start, range.end, 'link-label', true, 35)
      }
      for (const range of node.rawContentRanges) {
        pushSpan(range.start, range.end, 'link-label', false, 30)
      }
      continue
    }

    if (node.kind === 'explicit-paragraph') {
      for (const range of node.rawMarkerRanges) {
        pushSpan(range.start, range.end, 'plain', true, 20)
      }
    }
  }
}

const collectInlineSpans = (
  source: string,
  projection: MarkdownStableProjection,
  activeSet: ReadonlySet<string> | null,
  pushSpan: (
    start: number,
    end: number,
    kind: MarkdownLiveVisualSegmentKind,
    marker: boolean,
    priority: number,
  ) => void,
) => {
  const decorations = collectMarkdownLiveInlineDecorations(source, projection, {
    activeNodeIds: activeSet,
  })
  for (const decoration of decorations) {
    if (
      decoration.markerKind === 'link' ||
      decoration.markerKind === 'image'
    ) {
      const delimiterKind: MarkdownLiveVisualSegmentKind =
        decoration.markerKind === 'image' ? 'image-alt' : 'link-label'
      for (const range of decoration.revealedRanges) {
        if (range.role === 'open' || range.role === 'close') {
          pushSpan(range.start, range.end, delimiterKind, true, 35)
        } else if (range.role === 'label') {
          pushSpan(range.start, range.end, 'link-label', false, 30)
        } else if (range.role === 'alt') {
          pushSpan(range.start, range.end, 'image-alt', false, 30)
        } else if (range.role === 'destination' || range.role === 'title') {
          pushSpan(range.start, range.end, 'link-destination', false, 50)
        } else if (range.role === 'source-escape') {
          pushSpan(range.start, range.end, 'malformed', false, 70)
        }
      }
      continue
    }

    if (
      decoration.markerKind === 'emphasis' ||
      decoration.markerKind === 'strong' ||
      decoration.markerKind === 'strong-emphasis'
    ) {
      const kind = decoration.markerKind
      for (const range of decoration.revealedRanges) {
        if (range.role === 'open' || range.role === 'close') {
          pushSpan(range.start, range.end, kind, true, 45)
        } else if (range.role === 'content') {
          pushSpan(range.start, range.end, kind, false, 40)
        }
      }
      continue
    }

    if (decoration.markerKind === 'code') {
      for (const range of decoration.revealedRanges) {
        if (range.role === 'open' || range.role === 'close') {
          pushSpan(range.start, range.end, 'inline-code', true, 65)
        } else if (range.role === 'content') {
          pushSpan(range.start, range.end, 'inline-code', false, 60)
        }
      }
      continue
    }

    if (decoration.markerKind === 'heading') {
      for (const range of decoration.revealedRanges) {
        if (range.role === 'open') {
          pushSpan(range.start, range.end, 'heading', true, 20)
        }
      }
    }
  }
}

const resolveActiveVisual = (
  activeVisuals: readonly VisualSpan[],
): { readonly kind: MarkdownLiveVisualSegmentKind; readonly marker: boolean } => {
  if (activeVisuals.length === 0) {
    return { kind: 'plain', marker: false }
  }

  let winner = activeVisuals[0]!
  for (let index = 1; index < activeVisuals.length; index += 1) {
    const candidate = activeVisuals[index]!
    if (
      candidate.priority > winner.priority ||
      (candidate.priority === winner.priority &&
        candidate.marker &&
        !winner.marker)
    ) {
      winner = candidate
    }
  }

  if (
    !winner.marker &&
    (winner.kind === 'strong' || winner.kind === 'emphasis')
  ) {
    let hasStrong = winner.kind === 'strong'
    let hasEmphasis = winner.kind === 'emphasis'
    for (const candidate of activeVisuals) {
      if (candidate.marker || candidate.priority < 40) continue
      if (candidate.kind === 'strong') hasStrong = true
      else if (candidate.kind === 'emphasis') hasEmphasis = true
      else if (candidate.kind === 'strong-emphasis') {
        hasStrong = true
        hasEmphasis = true
      }
    }
    if (hasStrong && hasEmphasis) {
      return { kind: 'strong-emphasis', marker: false }
    }
  }

  return { kind: winner.kind, marker: winner.marker }
}

/**
 * Pure O(N) / O(S log S), SSR-safe visual segmentation for Live mode.
 * Produces a flat sorted list of non-overlapping segments covering
 * `[0, source.length]` with exact character fidelity (`join('') === source`).
 */
export const createMarkdownLiveVisualSegments = (
  input: MarkdownLiveVisualInput,
): readonly MarkdownLiveVisualSegment[] => {
  const { source, projection, reveal, focusState, activeNodeIds } = input
  if (source.length === 0) {
    return Object.freeze([])
  }

  const events: SweepEvent[] = []
  const pushSpan = (
    rawStart: number,
    rawEnd: number,
    kind: MarkdownLiveVisualSegmentKind,
    marker: boolean,
    priority: number,
  ) => {
    const start = clampBoundary(source, rawStart)
    const end = clampBoundary(source, rawEnd)
    if (end <= start) return
    const span: VisualSpan = { end, kind, marker, priority, start }
    events.push({ offset: start, span, type: 'visual-enter' })
    events.push({ offset: end, span, type: 'visual-exit' })
  }

  if (projection && projection.nodes.length > 0) {
    let activeSet: Set<string> | null = null
    if (
      source.length > MARKDOWN_LIVE_VISUAL_WINDOW_THRESHOLD &&
      activeNodeIds != null
    ) {
      activeSet =
        activeNodeIds instanceof Set
          ? new Set(activeNodeIds)
          : new Set(activeNodeIds)
      if (reveal && reveal.state !== 'inactive' && reveal.target) {
        activeSet.add(reveal.target.nodeId)
      }
    }

    collectBlockSpans(source, projection.nodes, activeSet, pushSpan)
    collectInlineSpans(source, projection, activeSet, pushSpan)
  }

  if (reveal && reveal.state !== 'inactive' && reveal.target) {
    for (const range of reveal.target.revealedRanges) {
      const start = clampBoundary(source, range.start)
      const end = clampBoundary(source, range.end)
      if (end <= start) continue
      events.push({ offset: start, type: 'reveal-enter' })
      events.push({ offset: end, type: 'reveal-exit' })
    }
  }

  const focusEnabled = Boolean(focusState?.enabled)
  if (focusEnabled && focusState) {
    for (const block of focusState.blocks) {
      const start = clampBoundary(source, block.sourceRange[0])
      const end = clampBoundary(source, block.sourceRange[1])
      if (end <= start) continue
      events.push({ block, offset: start, type: 'focus-enter' })
      events.push({ block, offset: end, type: 'focus-exit' })
    }
  }

  if (events.length === 0) {
    return Object.freeze([
      Object.freeze({
        dimmed: false,
        end: source.length,
        exempt: false,
        key: `0:${source.length}:plain:0`,
        kind: 'plain',
        marker: false,
        revealed: false,
        start: 0,
        text: source,
      }),
    ])
  }

  events.sort((left, right) => left.offset - right.offset)

  const activeVisuals: VisualSpan[] = []
  const activeFocusBlocks: MarkdownEditorFocusBlock[] = []
  let revealDepth = 0

  const merged: Array<{
    start: number
    end: number
    kind: MarkdownLiveVisualSegmentKind
    marker: boolean
    revealed: boolean
    dimmed: boolean
    exempt: boolean
    nodeId?: string
  }> = []

  const emitInterval = (start: number, end: number) => {
    if (end <= start) return
    const { kind, marker } = resolveActiveVisual(activeVisuals)
    const revealed = revealDepth > 0
    const focusBlock =
      activeFocusBlocks.length > 0
        ? activeFocusBlocks[activeFocusBlocks.length - 1]
        : undefined
    const dimmed = focusEnabled ? (focusBlock ? focusBlock.dimmed : false) : false
    const exempt = focusEnabled ? (focusBlock ? focusBlock.exempt : true) : false
    const nodeId = focusEnabled ? focusBlock?.id : undefined

    const previous = merged[merged.length - 1]
    if (
      previous &&
      previous.end === start &&
      previous.kind === kind &&
      previous.marker === marker &&
      previous.revealed === revealed &&
      previous.dimmed === dimmed &&
      previous.exempt === exempt &&
      previous.nodeId === nodeId
    ) {
      previous.end = end
      return
    }

    merged.push({
      dimmed,
      end,
      exempt,
      kind,
      marker,
      nodeId,
      revealed,
      start,
    })
  }

  let cursor = 0
  let eventIndex = 0
  while (eventIndex < events.length) {
    const offset = events[eventIndex]!.offset
    if (offset > cursor) {
      emitInterval(cursor, offset)
      cursor = offset
    }
    while (
      eventIndex < events.length &&
      events[eventIndex]!.offset === offset
    ) {
      const event = events[eventIndex]!
      if (event.type === 'visual-enter') {
        activeVisuals.push(event.span)
      } else if (event.type === 'visual-exit') {
        const found = activeVisuals.indexOf(event.span)
        if (found !== -1) activeVisuals.splice(found, 1)
      } else if (event.type === 'reveal-enter') {
        revealDepth += 1
      } else if (event.type === 'reveal-exit') {
        revealDepth = Math.max(0, revealDepth - 1)
      } else if (event.type === 'focus-enter') {
        activeFocusBlocks.push(event.block)
      } else if (event.type === 'focus-exit') {
        const found = activeFocusBlocks.indexOf(event.block)
        if (found !== -1) activeFocusBlocks.splice(found, 1)
      }
      eventIndex += 1
    }
  }

  if (cursor < source.length) {
    emitInterval(cursor, source.length)
  }

  return Object.freeze(
    merged.map((segment) =>
      Object.freeze({
        dimmed: segment.dimmed,
        end: segment.end,
        exempt: segment.exempt,
        key: `${segment.start}:${segment.end}:${segment.kind}:${segment.marker ? 1 : 0}`,
        kind: segment.kind,
        marker: segment.marker,
        ...(segment.nodeId !== undefined ? { nodeId: segment.nodeId } : {}),
        revealed: segment.revealed,
        start: segment.start,
        text: source.slice(segment.start, segment.end),
      }),
    ),
  )
}
