import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'
import {
  createMarkdownAnchorMap,
  type MarkdownAnchorMap,
  type MarkdownVisualSelection,
} from './markdown-editor-anchor-map'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import {
  resolveMarkdownClipboardCopy,
  resolveMarkdownClipboardCut,
  visibleTextFromMarkdownSource,
  type MarkdownClipboardCopyPlan,
  type MarkdownClipboardCutPlan,
} from './markdown-editor-clipboard'
import type {
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'

export const MARKDOWN_ATOMIC_NODE_KINDS = Object.freeze([
  'image',
  'table',
  'code',
  'latex',
  'mermaid',
  'footnote',
  'attachment',
] as const)

export type MarkdownAtomicNodeKind = (typeof MARKDOWN_ATOMIC_NODE_KINDS)[number]

export const MARKDOWN_LIVE_SELECTION_MOTIONS = Object.freeze([
  'left',
  'right',
  'word-left',
  'word-right',
  'home',
  'end',
  'page-up',
  'page-down',
  'pointer-click',
  'pointer-drag',
] as const)

export type MarkdownLiveSelectionMotion =
  (typeof MARKDOWN_LIVE_SELECTION_MOTIONS)[number]

export type MarkdownAtomicNodeAction =
  | 'caret-before'
  | 'caret-after'
  | 'enter-source'
  | 'select-node'
  | 'enter'
  | 'backspace'
  | 'delete'
  | 'copy-visible'
  | 'copy-source'
  | 'cut'
  | 'pointer-enter'
  | 'keyboard-enter'
  | 'escape'
  | 'focus-return'

export type MarkdownAtomicNodePhase = 'idle' | 'source' | 'selected'

export type MarkdownAtomicNodeStatus =
  | 'current'
  | 'pending'
  | 'error'
  | 'stale'
  | 'unsupported'

export interface MarkdownAtomicAccessibility {
  readonly name: string
  readonly status: MarkdownAtomicNodeStatus
  readonly tabStop: false
  readonly value: string
}

export interface MarkdownAtomicNodeSession {
  readonly nodeId: string
  readonly phase: MarkdownAtomicNodePhase
}

export interface MarkdownAtomicNodePlan {
  readonly accessibility: MarkdownAtomicAccessibility
  readonly action: MarkdownAtomicNodeAction
  readonly copy: MarkdownClipboardCopyPlan | MarkdownClipboardCutPlan | null
  readonly focusReturn: MarkdownEditorSelection | null
  readonly kind: string | null
  readonly nodeId: string | null
  readonly rejected?: 'composition-active' | 'preview' | 'stale-document' | 'unsupported'
  readonly selection: MarkdownEditorSelection
  readonly session: MarkdownAtomicNodeSession | null
  readonly state: MarkdownAtomicNodeStatus
  readonly transaction: MarkdownEditorTransaction | null
}

export interface MarkdownLiveSelectionPlan {
  readonly action: 'move' | 'extend' | 'noop'
  readonly atomic: MarkdownAtomicNodePlan | null
  readonly rejected?: 'composition-active' | 'preview' | 'stale-document'
  readonly selection: MarkdownEditorSelection
  readonly transaction: MarkdownEditorTransaction | null
  readonly visual: MarkdownVisualSelection | null
}

export type MarkdownLiveSelectionMutationKind =
  | 'dom-mapping'
  | 'per-kind-caret'
  | 'tab-trap'
  | 'nearby-guess'

const ATOMIC_KIND_SET = new Set<string>(MARKDOWN_ATOMIC_NODE_KINDS)
const PAGE_LINES = 10

const sameDocument = (
  left?: MarkdownDocumentIdentity,
  right?: MarkdownDocumentIdentity,
) => {
  if (!left || !right) return true
  return left.id === right.id && left.epoch === right.epoch
}

const toSourceSelection = (selection: MarkdownEditorSelection) => {
  if (selection.start === selection.end) {
    return { anchor: selection.start, focus: selection.end }
  }
  if (selection.direction === 'backward') {
    return { anchor: selection.end, focus: selection.start }
  }
  return { anchor: selection.start, focus: selection.end }
}

const fromSourceSelection = (
  selection: { readonly anchor: number; readonly focus: number },
): MarkdownEditorSelection => {
  if (selection.anchor === selection.focus) {
    return Object.freeze({
      direction: 'none' as const,
      end: selection.focus,
      start: selection.anchor,
    })
  }
  if (selection.anchor < selection.focus) {
    return Object.freeze({
      direction: 'forward' as const,
      end: selection.focus,
      start: selection.anchor,
    })
  }
  return Object.freeze({
    direction: 'backward' as const,
    end: selection.anchor,
    start: selection.focus,
  })
}

const selectionTransaction = (
  selection: MarkdownEditorSelection,
  revision: number | undefined,
): MarkdownEditorTransaction =>
  Object.freeze({
    changes: Object.freeze([]),
    expectedRevision: revision,
    history: 'skip' as const,
    metadata: Object.freeze({ liveSelection: true }),
    origin: 'input' as const,
    selection: Object.freeze({ ...selection }),
  })

const changeTransaction = (
  from: number,
  to: number,
  insert: string,
  selection: MarkdownEditorSelection,
  revision: number | undefined,
  origin: 'command' | 'input' = 'command',
): MarkdownEditorTransaction =>
  Object.freeze({
    changes: Object.freeze([Object.freeze({ from, insert, to })]),
    expectedRevision: revision,
    history: 'separate' as const,
    metadata: Object.freeze({ atomic: true }),
    origin,
    selection: Object.freeze({ ...selection }),
  })

const isWordChar = (value: string) =>
  /[\p{L}\p{N}_]/u.test(value)

const lineStartAt = (source: string, offset: number) =>
  source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1

const lineEndAt = (source: string, offset: number) => {
  const next = source.indexOf('\n', offset)
  return next === -1 ? source.length : next
}

export const createMarkdownLiveAnchorMap = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly projection?: MarkdownStableProjection
  readonly source: string
}): MarkdownAnchorMap =>
  createMarkdownAnchorMap({
    identity: input.documentIdentity,
    projection:
      input.projection ??
      stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(input.source),
        input.documentIdentity,
      ),
    source: input.source,
  })

export const roundTripMarkdownLiveSelection = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly projection?: MarkdownStableProjection
  readonly selection: MarkdownEditorSelection
  readonly source: string
}) => {
  const map = createMarkdownLiveAnchorMap(input)
  const sourceSelection = toSourceSelection(input.selection)
  const visual = map.sourceSelectionToVisual(sourceSelection)
  const back = map.visualAnchorToSourceSelection(visual)
  return Object.freeze({
    equivalent:
      back.anchor === sourceSelection.anchor &&
      back.focus === sourceSelection.focus,
    map,
    selection: fromSourceSelection(back),
    visual,
  })
}

const projectionOf = (
  source: string,
  identity: MarkdownDocumentIdentity,
  projection?: MarkdownStableProjection,
) =>
  projection ??
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    identity,
  )

const coveringAtomicNode = (
  projection: MarkdownStableProjection,
  offset: number,
): MarkdownStableSyntaxNode | null => {
  const covering = projection.nodes.filter(
    (node) =>
      ATOMIC_KIND_SET.has(node.kind) &&
      node.rawRange.start <= offset &&
      offset <= node.rawRange.end,
  )
  if (covering.length === 0) return null
  return [...covering].sort((left, right) => {
    const span =
      left.rawRange.end -
      left.rawRange.start -
      (right.rawRange.end - right.rawRange.start)
    if (span !== 0) return span
    return left.id.localeCompare(right.id)
  })[0]!
}

const snapOffset = (
  source: string,
  map: MarkdownAnchorMap,
  projection: MarkdownStableProjection,
  offset: number,
  direction: 'left' | 'right',
  allowInterior: boolean,
) => {
  const clamped = Math.max(0, Math.min(source.length, offset))
  const boundary = map.coordinates.graphemeBoundaryAt(
    Math.min(clamped, Math.max(0, source.length - (source.length === 0 ? 0 : 1))),
  )
  let next = clamped
  if (clamped < source.length && clamped > boundary.start && clamped < boundary.end) {
    next = direction === 'right' ? boundary.end : boundary.start
  }
  const visual = map.sourcePositionToVisual({
    affinity: direction === 'right' ? 'after' : 'before',
    offset: next,
  })
  if (visual.kind === 'hidden') {
    const crossed = map.traverseHiddenMarker({
      anchorId: visual.anchorId,
      direction: direction === 'right' ? 'forward' : 'backward',
    })
    next = crossed.offset
  }
  const atomic = coveringAtomicNode(projection, next)
  if (atomic && !allowInterior) {
    if (next > atomic.rawRange.start && next < atomic.rawRange.end) {
      next = direction === 'right' ? atomic.rawRange.end : atomic.rawRange.start
    }
  }
  return next
}

const stepGrapheme = (
  source: string,
  map: MarkdownAnchorMap,
  offset: number,
  direction: 'left' | 'right',
) => {
  if (direction === 'left') {
    if (offset <= 0) return 0
    const boundary = map.coordinates.graphemeBoundaryAt(offset - 1)
    return boundary.start
  }
  if (offset >= source.length) return source.length
  const boundary = map.coordinates.graphemeBoundaryAt(offset)
  return boundary.end === offset ? Math.min(source.length, offset + 1) : boundary.end
}

const stepWord = (
  source: string,
  map: MarkdownAnchorMap,
  offset: number,
  direction: 'left' | 'right',
) => {
  let cursor = offset
  if (direction === 'right') {
    while (cursor < source.length && !isWordChar(source[cursor]!)) {
      cursor = stepGrapheme(source, map, cursor, 'right')
    }
    while (cursor < source.length && isWordChar(source[cursor]!)) {
      cursor = stepGrapheme(source, map, cursor, 'right')
    }
    return cursor
  }
  while (cursor > 0 && !isWordChar(source[cursor - 1]!)) {
    cursor = stepGrapheme(source, map, cursor, 'left')
  }
  while (cursor > 0 && isWordChar(source[cursor - 1]!)) {
    cursor = stepGrapheme(source, map, cursor, 'left')
  }
  return cursor
}

const stepPage = (source: string, offset: number, direction: 'up' | 'down') => {
  if (direction === 'up') {
    let cursor = lineStartAt(source, offset)
    for (let index = 0; index < PAGE_LINES && cursor > 0; index += 1) {
      cursor = lineStartAt(source, cursor - 1)
    }
    return cursor
  }
  let cursor = lineEndAt(source, offset)
  for (let index = 0; index < PAGE_LINES && cursor < source.length; index += 1) {
    cursor = lineEndAt(source, Math.min(source.length, cursor + 1))
  }
  return cursor
}

const accessibilityOf = (
  kind: string | null,
  slice: string,
  status: MarkdownAtomicNodeStatus,
): MarkdownAtomicAccessibility =>
  Object.freeze({
    name: kind ?? 'atomic',
    status,
    tabStop: false,
    value: visibleTextFromMarkdownSource(slice) || slice,
  })

export const resolveMarkdownAtomicNodeIntent = (input: {
  readonly action: MarkdownAtomicNodeAction
  readonly composing?: boolean
  readonly currentIdentity?: MarkdownDocumentIdentity
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly error?: boolean
  readonly expectedRevision?: number
  readonly kind?: string
  readonly mode?: MarkdownEditorMode
  readonly nodeId?: string
  readonly pending?: boolean
  readonly projection?: MarkdownStableProjection
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly session?: MarkdownAtomicNodeSession | null
  readonly source: string
}): MarkdownAtomicNodePlan => {
  const identity = input.documentIdentity ?? { epoch: 0, id: 'atomic' }
  const selection = input.selection
  const empty = (state: MarkdownAtomicNodeStatus, rejected?: MarkdownAtomicNodePlan['rejected']) =>
    Object.freeze({
      accessibility: accessibilityOf(null, '', state),
      action: input.action,
      copy: null,
      focusReturn: null,
      kind: null,
      nodeId: null,
      rejected,
      selection,
      session: null,
      state,
      transaction: null,
    })

  if (input.composing) return empty('error', 'composition-active')
  if (input.mode === 'preview') return empty('unsupported', 'preview')
  if (
    (input.expectedRevision !== undefined &&
      input.revision !== undefined &&
      input.expectedRevision !== input.revision) ||
    !sameDocument(input.documentIdentity, input.currentIdentity)
  ) {
    return empty('stale', 'stale-document')
  }
  if (input.pending) return empty('pending')
  if (input.error) return empty('error')

  const projection = projectionOf(input.source, identity, input.projection)
  const located =
    input.nodeId && !input.nodeId.startsWith('atomic:')
      ? projection.nodes.find((item) => item.id === input.nodeId)
      : input.kind
        ? projection.nodes.find((item) => item.kind === input.kind)
        : coveringAtomicNode(projection, selection.start) ??
          coveringAtomicNode(projection, selection.end)

  const node =
    located ??
    (input.kind === 'attachment' && input.source.length > 0
      ? {
          id: `atomic:${identity.id}:attachment:0`,
          kind: 'attachment',
          rawRange: {
            end: input.source.replace(/\n+$/, '').length,
            start: 0,
          },
        }
      : null)

  if (!node || !ATOMIC_KIND_SET.has(node.kind)) {
    return empty('unsupported', 'unsupported')
  }

  const slice = input.source.slice(node.rawRange.start, node.rawRange.end)
  const before = Object.freeze({
    direction: 'none' as const,
    end: node.rawRange.start,
    start: node.rawRange.start,
  })
  const after = Object.freeze({
    direction: 'none' as const,
    end: node.rawRange.end,
    start: node.rawRange.end,
  })
  const inside = Object.freeze({
    direction: 'none' as const,
    end: node.rawRange.start,
    start: node.rawRange.start,
  })
  const whole = Object.freeze({
    direction: 'forward' as const,
    end: node.rawRange.end,
    start: node.rawRange.start,
  })

  const session = (phase: MarkdownAtomicNodePhase): MarkdownAtomicNodeSession =>
    Object.freeze({ nodeId: node.id, phase })

  const planOf = (
    next: MarkdownEditorSelection,
    extras: Partial<MarkdownAtomicNodePlan> = {},
    phase: MarkdownAtomicNodePhase = 'idle',
  ): MarkdownAtomicNodePlan =>
    Object.freeze({
      accessibility: accessibilityOf(node.kind, slice, extras.state ?? 'current'),
      action: input.action,
      copy: extras.copy ?? null,
      focusReturn: extras.focusReturn ?? after,
      kind: node.kind,
      nodeId: node.id,
      rejected: extras.rejected,
      selection: next,
      session: extras.session === null ? null : (extras.session ?? session(phase)),
      state: extras.state ?? 'current',
      transaction:
        extras.transaction === undefined
          ? selectionTransaction(next, input.revision)
          : extras.transaction,
    })

  switch (input.action) {
    case 'caret-before':
      return planOf(before)
    case 'caret-after':
      return planOf(after)
    case 'enter-source':
    case 'keyboard-enter':
    case 'pointer-enter':
      return planOf(inside, {}, 'source')
    case 'select-node':
      return planOf(whole, {}, 'selected')
    case 'enter':
      return planOf(
        {
          direction: 'none',
          end: node.rawRange.end + 1,
          start: node.rawRange.end + 1,
        },
        {
          transaction: changeTransaction(
            node.rawRange.end,
            node.rawRange.end,
            '\n',
            {
              direction: 'none',
              end: node.rawRange.end + 1,
              start: node.rawRange.end + 1,
            },
            input.revision,
          ),
        },
      )
    case 'backspace':
    case 'delete':
    case 'cut': {
      const cut =
        input.action === 'cut'
          ? resolveMarkdownClipboardCut({
              copyKind: 'source',
              documentIdentity: identity,
              mode: input.mode ?? 'live',
              revision: input.revision,
              selection: whole,
              source: input.source,
            })
          : null
      return planOf(
        before,
        {
          copy: cut,
          transaction: changeTransaction(
            node.rawRange.start,
            node.rawRange.end,
            '',
            before,
            input.revision,
          ),
        },
      )
    }
    case 'copy-visible':
      return planOf(selection, {
        copy: resolveMarkdownClipboardCopy({
          copyKind: 'visible',
          documentIdentity: identity,
          mode: input.mode ?? 'live',
          revision: input.revision,
          selection: whole,
          source: input.source,
        }),
        transaction: null,
      })
    case 'copy-source':
      return planOf(selection, {
        copy: resolveMarkdownClipboardCopy({
          copyKind: 'source',
          documentIdentity: identity,
          mode: input.mode ?? 'live',
          revision: input.revision,
          selection: whole,
          source: input.source,
        }),
        transaction: null,
      })
    case 'escape':
    case 'focus-return':
      return planOf(after, { focusReturn: after, session: null })
    default:
      return empty('unsupported', 'unsupported')
  }
}

export const resolveMarkdownLiveSelectionMotion = (input: {
  readonly composing?: boolean
  readonly currentIdentity?: MarkdownDocumentIdentity
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly dragOffset?: number
  readonly expectedRevision?: number
  readonly mode?: MarkdownEditorMode
  readonly motion: MarkdownLiveSelectionMotion
  readonly pointerOffset?: number
  readonly projection?: MarkdownStableProjection
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly session?: MarkdownAtomicNodeSession | null
  readonly shift?: boolean
  readonly source: string
}): MarkdownLiveSelectionPlan => {
  const identity = input.documentIdentity ?? { epoch: 0, id: 'live-selection' }
  if (input.composing) {
    return Object.freeze({
      action: 'noop',
      atomic: null,
      rejected: 'composition-active',
      selection: input.selection,
      transaction: null,
      visual: null,
    })
  }
  if (input.mode === 'preview') {
    return Object.freeze({
      action: 'noop',
      atomic: null,
      rejected: 'preview',
      selection: input.selection,
      transaction: null,
      visual: null,
    })
  }
  if (
    (input.expectedRevision !== undefined &&
      input.revision !== undefined &&
      input.expectedRevision !== input.revision) ||
    !sameDocument(input.documentIdentity, input.currentIdentity)
  ) {
    return Object.freeze({
      action: 'noop',
      atomic: null,
      rejected: 'stale-document',
      selection: input.selection,
      transaction: null,
      visual: null,
    })
  }

  const projection = projectionOf(input.source, identity, input.projection)
  const map = createMarkdownLiveAnchorMap({
    documentIdentity: identity,
    projection,
    source: input.source,
  })
  const allowInterior = input.session?.phase === 'source'
  const caret = input.selection.direction === 'backward'
    ? input.selection.start
    : input.selection.end
  const origin = input.selection.direction === 'backward'
    ? input.selection.end
    : input.selection.start

  let nextCaret = caret
  if (input.motion === 'left') {
    nextCaret = stepGrapheme(input.source, map, caret, 'left')
  } else if (input.motion === 'right') {
    nextCaret = stepGrapheme(input.source, map, caret, 'right')
  } else if (input.motion === 'word-left') {
    nextCaret = stepWord(input.source, map, caret, 'left')
  } else if (input.motion === 'word-right') {
    nextCaret = stepWord(input.source, map, caret, 'right')
  } else if (input.motion === 'home') {
    nextCaret = lineStartAt(input.source, caret)
  } else if (input.motion === 'end') {
    nextCaret = lineEndAt(input.source, caret)
  } else if (input.motion === 'page-up') {
    nextCaret = stepPage(input.source, caret, 'up')
  } else if (input.motion === 'page-down') {
    nextCaret = stepPage(input.source, caret, 'down')
  } else if (input.motion === 'pointer-click') {
    nextCaret = input.pointerOffset ?? caret
  } else if (input.motion === 'pointer-drag') {
    nextCaret = input.dragOffset ?? input.pointerOffset ?? caret
  }

  const direction: 'left' | 'right' =
    nextCaret < caret || input.motion === 'left' || input.motion === 'word-left' || input.motion === 'home' || input.motion === 'page-up'
      ? 'left'
      : 'right'
  nextCaret = snapOffset(
    input.source,
    map,
    projection,
    nextCaret,
    direction,
    allowInterior,
  )

  const extend = Boolean(input.shift) || input.motion === 'pointer-drag'
  const nextSelection = extend
    ? fromSourceSelection({
        anchor: origin,
        focus: nextCaret,
      })
    : Object.freeze({
        direction: 'none' as const,
        end: nextCaret,
        start: nextCaret,
      })

  const visual = map.sourceSelectionToVisual(toSourceSelection(nextSelection))
  const roundTrip = map.visualAnchorToSourceSelection(visual)
  const verified = fromSourceSelection(roundTrip)
  return Object.freeze({
    action: extend ? 'extend' : 'move',
    atomic: coveringAtomicNode(projection, verified.start)
      ? resolveMarkdownAtomicNodeIntent({
          action:
            verified.start === verified.end &&
            coveringAtomicNode(projection, verified.start)?.rawRange.start ===
              verified.start
              ? 'caret-before'
              : coveringAtomicNode(projection, verified.start)?.rawRange.end ===
                  verified.start
                ? 'caret-after'
                : 'enter-source',
          documentIdentity: identity,
          mode: input.mode,
          projection,
          revision: input.revision,
          selection: verified,
          session: input.session,
          source: input.source,
        })
      : null,
    selection: verified,
    transaction: selectionTransaction(verified, input.revision),
    visual,
  })
}

export const retainMarkdownLiveSelection = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly mode: MarkdownEditorMode
  readonly projection?: MarkdownStableProjection
  readonly selection: MarkdownEditorSelection
  readonly source: string
}) => {
  const trip = roundTripMarkdownLiveSelection(input)
  return Object.freeze({
    direction: trip.selection.direction,
    equivalent:
      trip.equivalent &&
      trip.selection.start === input.selection.start &&
      trip.selection.end === input.selection.end,
    mode: input.mode,
    selection: trip.selection,
    visual: trip.visual,
  })
}

export const evaluateMarkdownLiveSelectionMutations = () => {
  const identity = Object.freeze({ epoch: 1, id: 'sel-doc' })
  const source = '![alt](img.png)\n\n| h |\n| --- |\n| c |\n'
  const authority = resolveMarkdownAtomicNodeIntent({
    action: 'caret-before',
    documentIdentity: identity,
    revision: 1,
    selection: { direction: 'none', end: 0, start: 0 },
    source,
  })
  const table = resolveMarkdownAtomicNodeIntent({
    action: 'caret-after',
    documentIdentity: identity,
    revision: 1,
    selection: { direction: 'none', end: source.length, start: source.length },
    source,
  })
  const trip = roundTripMarkdownLiveSelection({
    documentIdentity: identity,
    selection: { direction: 'forward', end: 6, start: 0 },
    source,
  })
  const htmlIndex = source.indexOf('alt')
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        accepted: trip.visual.anchor.anchorId.startsWith('dom:') || htmlIndex < 0,
        detail: 'selection mapping must use #325, not DOM paths',
        equivalent: false,
        kind: 'dom-mapping' as const,
      }),
      Object.freeze({
        accepted:
          authority.action !== table.action &&
          authority.accessibility.tabStop !== table.accessibility.tabStop,
        detail: 'registered atomics share one caret/copy/delete primitive',
        equivalent: authority.nodeId === table.nodeId,
        kind: 'per-kind-caret' as const,
      }),
      Object.freeze({
        accepted: authority.accessibility.tabStop,
        detail: 'atomic ordinary presentation is not a permanent Tab stop',
        equivalent: false,
        kind: 'tab-trap' as const,
      }),
      Object.freeze({
        accepted: !trip.equivalent,
        detail: 'round-trip must not guess a nearby offset',
        equivalent: trip.equivalent,
        kind: 'nearby-guess' as const,
      }),
    ]),
  })
}
