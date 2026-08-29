import { createMarkdownEditorProjection } from './markdown-editor-projection'
import { MarkdownRuntimeError } from './markdown-runtime-error'
import {
  createMarkdownSourceCoordinateMap,
  type MarkdownSourceCoordinateMap,
  type MarkdownSourceRange,
} from './markdown-source-coordinate-map'
import {
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
} from './markdown-syntax-identity'

export type SourceSelection = {
  readonly anchor: number
  readonly focus: number
}

export type MarkdownSourceSelection = SourceSelection

export type MarkdownAnchorAffinity = 'before' | 'after'

export type MarkdownVisualKind = 'text' | 'hidden' | 'atomic' | 'virtual'

export type MarkdownVisualPointName =
  | 'start'
  | 'end'
  | 'caret'
  | 'before'
  | 'after'
  | 'inside-source'

export type MarkdownSelectionDirection = 'collapsed' | 'forward' | 'backward'

export const MARKDOWN_POINTER_PLATFORMS = Object.freeze([
  'source',
  'live',
  'split',
  'preview',
] as const)

export type MarkdownPointerPlatform =
  (typeof MARKDOWN_POINTER_PLATFORMS)[number]

export type MarkdownHiddenTraversalDirection = 'forward' | 'backward'

export interface MarkdownPointerHit {
  readonly anchorId: string
  readonly point: MarkdownVisualPointName
  readonly affinity?: MarkdownAnchorAffinity
  readonly localOffset?: number
}

export interface MarkdownPointerSourcePosition {
  readonly offset: number
  readonly end: number
  readonly platform: MarkdownPointerPlatform
  readonly hidden: boolean
  readonly virtual: boolean
  readonly anchorId: string
}

export interface MarkdownHiddenTraversalQuery {
  readonly anchorId: string
  readonly direction: MarkdownHiddenTraversalDirection
}

export interface MarkdownHiddenTraversal {
  readonly offset: number
  readonly crossed: boolean
  readonly hidden: boolean
  readonly nextAnchorId: string
}

export interface MarkdownRevealHighlight {
  readonly anchorId: string
  readonly hidden: boolean
  readonly virtual: boolean
  readonly range: MarkdownSourceRange
}

export interface MarkdownSourceReveal {
  readonly identity: string
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly highlights: readonly MarkdownRevealHighlight[]
  readonly reveal: MarkdownRevealTarget
}

export type MarkdownAnchorSyntaxRange =
  | readonly [number, number]
  | MarkdownSourceRange

export interface MarkdownAnchorSyntaxInput {
  readonly id: string
  readonly range: MarkdownAnchorSyntaxRange
  readonly projectionId?: string
  readonly hidden?: boolean
  readonly parentId?: string
  readonly atomic?: boolean
  readonly virtual?: boolean
}

export interface MarkdownAnchorMapInput {
  readonly identity: string | MarkdownDocumentIdentity
  readonly source: string
  readonly syntax?: readonly MarkdownAnchorSyntaxInput[]
  readonly projection?: MarkdownStableProjection
}

export interface MarkdownSourcePosition {
  readonly offset: number
  readonly affinity: MarkdownAnchorAffinity
}

export interface MarkdownVisualPoint {
  readonly kind: MarkdownVisualKind
  readonly anchorId: string
  readonly side?: MarkdownAnchorAffinity
  readonly point?: MarkdownVisualPointName
  readonly localOffset?: number
  readonly sourceOffset: number
  readonly hidden?: boolean
  readonly parentId?: string
  readonly virtual?: boolean
}

export interface MarkdownVisualSelection {
  readonly identity: string
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly direction: MarkdownSelectionDirection
  readonly anchor: MarkdownVisualPoint
  readonly focus: MarkdownVisualPoint
}

export interface MarkdownVisualPointQuery {
  readonly anchorId: string
  readonly point: MarkdownVisualPointName
}

export interface MarkdownRevealQuery {
  readonly anchorId: string
}

export interface MarkdownRevealTarget {
  readonly virtual: boolean
  readonly identity: string
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly anchorId: string
  readonly range: MarkdownSourceRange
}

export interface MarkdownRangeMutation {
  readonly delete?: readonly [number, number]
  readonly insert?: {
    readonly at: number
    readonly text?: string
    readonly length?: number
  }
}

export type MarkdownRemappedRange =
  | { readonly status: 'deleted' }
  | {
      readonly status: 'partial'
      readonly range: MarkdownSourceRange
    }
  | {
      readonly status: 'mapped'
      readonly range: MarkdownSourceRange
    }

export interface MarkdownAnchorSyntaxNode {
  readonly id: string
  readonly projectionId: string
  readonly start: number
  readonly end: number
  readonly hidden: boolean
  readonly atomic: boolean
  readonly virtual: boolean
  readonly parentId?: string
}

export interface MarkdownAnchorMap {
  readonly identity: string
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly source: string
  readonly coordinates: MarkdownSourceCoordinateMap
  readonly syntax: readonly MarkdownAnchorSyntaxNode[]
  sourceSelectionToVisual(selection: SourceSelection): MarkdownVisualSelection
  visualAnchorToSourceSelection(
    visual: MarkdownVisualSelection,
  ): SourceSelection
  sourcePositionToVisual(position: MarkdownSourcePosition): MarkdownVisualPoint
  visualPointToSource(query: MarkdownVisualPointQuery): {
    readonly offset: number
    readonly end: number
  }
  reveal(query: MarkdownRevealQuery): MarkdownRevealTarget
  remapRange(
    range: MarkdownSourceRange,
    mutation: MarkdownRangeMutation,
  ): MarkdownRemappedRange
  sourceRangeToVisual(range: MarkdownSourceRange): MarkdownVisualSelection
  pointerHitToSource(
    hit: MarkdownPointerHit,
    options?: { readonly platform?: MarkdownPointerPlatform },
  ): MarkdownPointerSourcePosition
  traverseHiddenMarker(
    query: MarkdownHiddenTraversalQuery,
  ): MarkdownHiddenTraversal
  sourceRangeToReveal(range: MarkdownSourceRange): MarkdownSourceReveal
}

const documentIdentityOf = (
  identity: string | MarkdownDocumentIdentity,
): MarkdownDocumentIdentity => {
  if (typeof identity === 'string') {
    if (!identity) {
      throw new MarkdownRuntimeError(
        'protocol',
        'anchor map requires a document identity',
      )
    }
    return Object.freeze({ id: identity, epoch: 0 })
  }
  if (!identity?.id) {
    throw new MarkdownRuntimeError(
      'protocol',
      'anchor map requires a document identity',
    )
  }
  if (!Number.isInteger(identity.epoch)) {
    throw new MarkdownRuntimeError(
      'protocol',
      'anchor map requires a document epoch',
    )
  }
  return Object.freeze({ id: identity.id, epoch: identity.epoch })
}

const identityKeyOf = (
  identity: string | MarkdownDocumentIdentity,
  documentIdentity: MarkdownDocumentIdentity,
) => (typeof identity === 'string' ? identity : documentIdentity.id)

const assertIntegerInRange = (value: number, label: string, max: number) => {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new MarkdownRuntimeError(
      'protocol',
      `${label} ${String(value)} is outside the map`,
    )
  }
}

const asRange = (range: MarkdownAnchorSyntaxRange): MarkdownSourceRange => {
  if ('start' in range) {
    return { start: range.start, end: range.end }
  }
  return { start: range[0], end: range[1] }
}

const rangeLength = (node: MarkdownAnchorSyntaxNode) => node.end - node.start

const smallestNode = (nodes: readonly MarkdownAnchorSyntaxNode[]) =>
  [...nodes].sort((left, right) => {
    const span = rangeLength(left) - rangeLength(right)
    if (span !== 0) return span
    const start = left.start - right.start
    if (start !== 0) return start
    return left.id.localeCompare(right.id)
  })[0] as MarkdownAnchorSyntaxNode

const syntaxFromProjection = (
  projection: MarkdownStableProjection,
): MarkdownAnchorSyntaxInput[] =>
  projection.nodes.map((node) => ({
    id: node.id,
    projectionId: node.id,
    range: node.rawRange,
    atomic: node.presentation === 'live-atomic',
  }))

const freezePoint = (point: MarkdownVisualPoint): MarkdownVisualPoint =>
  Object.freeze({
    kind: point.kind,
    anchorId: point.anchorId,
    sourceOffset: point.sourceOffset,
    ...(point.side === undefined ? {} : { side: point.side }),
    ...(point.point === undefined ? {} : { point: point.point }),
    ...(point.localOffset === undefined
      ? {}
      : { localOffset: point.localOffset }),
    ...(point.hidden === undefined ? {} : { hidden: point.hidden }),
    ...(point.parentId === undefined ? {} : { parentId: point.parentId }),
    ...(point.virtual === undefined ? {} : { virtual: point.virtual }),
  })

export const createMarkdownAnchorMap = (
  input: MarkdownAnchorMapInput,
): MarkdownAnchorMap => {
  if (!input || typeof input.source !== 'string') {
    throw new MarkdownRuntimeError(
      'protocol',
      'anchor map requires a source string',
    )
  }

  const documentIdentity = documentIdentityOf(input.identity)
  const identity = identityKeyOf(input.identity, documentIdentity)
  const coordinates = createMarkdownSourceCoordinateMap(input.source)
  const source = coordinates.rawSource
  const documentAnchorId = `doc:${documentIdentity.id}:${documentIdentity.epoch}`
  const projection =
    input.projection ??
    stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      documentIdentity,
    )

  if (
    projection.documentIdentity.id !== documentIdentity.id ||
    projection.documentIdentity.epoch !== documentIdentity.epoch
  ) {
    throw new MarkdownRuntimeError(
      'protocol',
      'anchor projection identity does not match the map',
    )
  }
  if (projection.normalizedSource !== coordinates.normalizedSource) {
    throw new MarkdownRuntimeError(
      'protocol',
      'anchor projection source does not match the map',
    )
  }

  const syntaxInput = input.syntax ?? syntaxFromProjection(projection)
  const projectionById = new Map(
    projection.nodes.map((node) => [node.id, node]),
  )
  const seen = new Set<string>()
  const syntax: MarkdownAnchorSyntaxNode[] = syntaxInput.map((entry) => {
    if (!entry.id) {
      throw new MarkdownRuntimeError('protocol', 'anchor syntax requires an id')
    }
    if (seen.has(entry.id)) {
      throw new MarkdownRuntimeError(
        'protocol',
        `duplicate anchor syntax id: ${entry.id}`,
      )
    }
    seen.add(entry.id)
    const range = asRange(entry.range)
    assertIntegerInRange(range.start, 'syntax start', source.length)
    assertIntegerInRange(range.end, 'syntax end', source.length)
    if (range.end < range.start) {
      throw new MarkdownRuntimeError(
        'protocol',
        `syntax range ${entry.id} is inverted`,
      )
    }
    const projectionNode = entry.projectionId
      ? projectionById.get(entry.projectionId)
      : projection.nodes
          .filter(
            (node) =>
              node.rawRange.start <= range.start &&
              node.rawRange.end >= range.end,
          )
          .sort((left, right) => {
            const span =
              left.rawRange.end -
              left.rawRange.start -
              (right.rawRange.end - right.rawRange.start)
            if (span !== 0) return span
            return left.id.localeCompare(right.id)
          })[0]
    if (!projectionNode) {
      throw new MarkdownRuntimeError(
        'protocol',
        `anchor syntax ${entry.id} is not bound to the projection`,
      )
    }
    if (
      projectionNode.rawRange.start > range.start ||
      projectionNode.rawRange.end < range.end
    ) {
      throw new MarkdownRuntimeError(
        'protocol',
        `anchor syntax ${entry.id} escapes projection ${projectionNode.id}`,
      )
    }
    return Object.freeze({
      id: entry.id,
      projectionId: projectionNode.id,
      start: range.start,
      end: range.end,
      hidden: entry.hidden === true,
      atomic: entry.atomic === true,
      virtual: entry.virtual === true,
      ...(entry.parentId === undefined ? {} : { parentId: entry.parentId }),
    })
  })

  for (const node of syntax) {
    if (node.parentId !== undefined && !seen.has(node.parentId)) {
      throw new MarkdownRuntimeError(
        'protocol',
        `syntax parent ${node.parentId} is missing`,
      )
    }
    if (
      node.parentId !== undefined &&
      syntax.find((candidate) => candidate.id === node.parentId)
        ?.projectionId !== node.projectionId
    ) {
      throw new MarkdownRuntimeError(
        'protocol',
        `anchor syntax ${node.id} crosses projection identity`,
      )
    }
  }

  const byId = new Map(syntax.map((node) => [node.id, node]))

  const requireNode = (anchorId: string) => {
    const node = byId.get(anchorId)
    if (!node) {
      throw new MarkdownRuntimeError(
        'protocol',
        `unknown visual anchor: ${anchorId}`,
      )
    }
    return node
  }

  const locate = (
    offset: number,
    affinity: MarkdownAnchorAffinity,
  ): MarkdownVisualPoint => {
    assertIntegerInRange(offset, 'source offset', source.length)

    const atomics = syntax.filter(
      (node) => node.atomic && node.start <= offset && offset < node.end,
    )
    if (atomics.length > 0) {
      const node = smallestNode(atomics)
      return freezePoint({
        kind: 'atomic',
        anchorId: node.id,
        side: affinity,
        point: affinity,
        localOffset: offset - node.start,
        sourceOffset: offset,
        virtual: node.virtual,
        hidden: node.hidden,
        parentId: node.parentId,
      })
    }

    const covering = syntax.filter(
      (node) => node.start <= offset && offset <= node.end,
    )
    if (covering.length > 0) {
      const atStart = covering.filter((node) => node.start === offset)
      const atEnd = covering.filter((node) => node.end === offset)
      const node =
        affinity === 'after' && atStart.length > 0
          ? smallestNode(atStart)
          : affinity === 'before' && atEnd.length > 0
            ? smallestNode(atEnd)
            : smallestNode(covering)
      const localOffset = offset - node.start
      const point: MarkdownVisualPointName =
        offset === node.start ? 'start' : offset === node.end ? 'end' : 'caret'
      return freezePoint({
        kind: node.atomic
          ? 'atomic'
          : node.hidden
            ? 'hidden'
            : node.virtual
              ? 'virtual'
              : 'text',
        anchorId: node.id,
        point,
        localOffset,
        sourceOffset: offset,
        hidden: node.hidden,
        virtual: node.virtual,
        parentId: node.parentId,
      })
    }

    return freezePoint({
      kind: 'text',
      anchorId: documentAnchorId,
      point:
        offset === 0 ? 'start' : offset === source.length ? 'end' : 'caret',
      localOffset: offset,
      sourceOffset: offset,
    })
  }

  const resolvePoint = (point: MarkdownVisualPoint) => {
    assertIntegerInRange(
      point.sourceOffset,
      'visual source offset',
      source.length,
    )
    if (point.anchorId === documentAnchorId) {
      if (point.kind !== 'text' || !Number.isInteger(point.localOffset)) {
        throw new MarkdownRuntimeError(
          'protocol',
          'document visual point is not resolvable',
        )
      }
      assertIntegerInRange(
        point.localOffset as number,
        'visual local offset',
        source.length,
      )
      if (point.sourceOffset !== point.localOffset) {
        throw new MarkdownRuntimeError(
          'protocol',
          'document visual point does not match its source offset',
        )
      }
      return point.localOffset as number
    }

    const node = requireNode(point.anchorId)
    const expectedKind: MarkdownVisualKind = node.atomic
      ? 'atomic'
      : node.hidden
        ? 'hidden'
        : node.virtual
          ? 'virtual'
          : 'text'
    if (point.kind !== expectedKind) {
      throw new MarkdownRuntimeError(
        'protocol',
        `visual point kind does not match anchor ${point.anchorId}`,
      )
    }

    let offset: number
    if (Number.isInteger(point.localOffset)) {
      const localOffset = point.localOffset as number
      if (localOffset < 0 || localOffset > rangeLength(node)) {
        throw new MarkdownRuntimeError(
          'protocol',
          'visual local offset is outside the anchor',
        )
      }
      offset = node.start + localOffset
    } else if (point.point === 'start' || point.point === 'before') {
      offset = node.start
    } else if (point.point === 'end' || point.point === 'after') {
      offset = node.end
    } else if (point.point === 'inside-source') {
      offset = node.start
    } else {
      throw new MarkdownRuntimeError(
        'protocol',
        'visual point is not resolvable',
      )
    }
    if (point.sourceOffset !== offset) {
      throw new MarkdownRuntimeError(
        'protocol',
        `visual point does not match anchor ${point.anchorId}`,
      )
    }
    return offset
  }

  const sourceSelectionToVisual = (selection: SourceSelection) => {
    assertIntegerInRange(selection.anchor, 'selection anchor', source.length)
    assertIntegerInRange(selection.focus, 'selection focus', source.length)
    const direction: MarkdownSelectionDirection =
      selection.anchor === selection.focus
        ? 'collapsed'
        : selection.focus > selection.anchor
          ? 'forward'
          : 'backward'
    const anchorAffinity: MarkdownAnchorAffinity =
      direction === 'backward' ? 'after' : 'before'
    const focusAffinity: MarkdownAnchorAffinity =
      direction === 'forward' ? 'after' : 'before'
    return Object.freeze({
      identity,
      documentIdentity,
      direction,
      anchor: locate(selection.anchor, anchorAffinity),
      focus: locate(selection.focus, focusAffinity),
    })
  }

  const visualAnchorToSourceSelection = (visual: MarkdownVisualSelection) => {
    if (
      visual.identity !== identity ||
      visual.documentIdentity.id !== documentIdentity.id ||
      visual.documentIdentity.epoch !== documentIdentity.epoch
    ) {
      throw new MarkdownRuntimeError(
        'protocol',
        'visual selection identity does not match the map',
      )
    }
    const anchor = resolvePoint(visual.anchor)
    const focus = resolvePoint(visual.focus)
    const direction: MarkdownSelectionDirection =
      anchor === focus ? 'collapsed' : focus > anchor ? 'forward' : 'backward'
    if (visual.direction !== direction) {
      throw new MarkdownRuntimeError(
        'protocol',
        'visual selection direction does not match its anchors',
      )
    }
    return Object.freeze({ anchor, focus })
  }

  const sourcePositionToVisual = (position: MarkdownSourcePosition) => {
    if (position.affinity !== 'before' && position.affinity !== 'after') {
      throw new MarkdownRuntimeError(
        'protocol',
        'source position requires affinity',
      )
    }
    return locate(position.offset, position.affinity)
  }

  const visualPointToSource = (query: MarkdownVisualPointQuery) => {
    const node = requireNode(query.anchorId)
    if (query.point === 'end' || query.point === 'after') {
      return Object.freeze({ offset: node.end, end: node.end })
    }
    return Object.freeze({ offset: node.start, end: node.end })
  }

  const reveal = (query: MarkdownRevealQuery) => {
    const node = requireNode(query.anchorId)
    return Object.freeze({
      virtual: node.virtual,
      identity,
      documentIdentity,
      anchorId: node.id,
      range: Object.freeze({ start: node.start, end: node.end }),
    })
  }

  const remapRange = (
    range: MarkdownSourceRange,
    mutation: MarkdownRangeMutation,
  ): MarkdownRemappedRange => {
    assertIntegerInRange(range.start, 'remap start', source.length)
    assertIntegerInRange(range.end, 'remap end', source.length)
    let start = Math.min(range.start, range.end)
    let end = Math.max(range.start, range.end)
    let partial = false

    if (mutation.delete) {
      const deleteStart = mutation.delete[0]
      const deleteEnd = mutation.delete[1]
      assertIntegerInRange(deleteStart, 'delete start', source.length)
      assertIntegerInRange(deleteEnd, 'delete end', source.length)
      if (deleteEnd < deleteStart) {
        throw new MarkdownRuntimeError('protocol', 'delete range is inverted')
      }

      const fullyCovered =
        start >= deleteStart &&
        end <= deleteEnd &&
        (start < end ||
          (start === end && start >= deleteStart && start < deleteEnd))
      if (fullyCovered) {
        return Object.freeze({ status: 'deleted' as const })
      }

      const overlaps = start < deleteEnd && end > deleteStart
      if (overlaps) {
        const nextStart = start < deleteStart ? start : deleteStart
        const nextEnd =
          end > deleteEnd ? end - (deleteEnd - deleteStart) : deleteStart
        return Object.freeze({
          status: 'partial' as const,
          range: Object.freeze({
            start: nextStart,
            end: Math.max(nextStart, nextEnd),
          }),
        })
      }

      if (start >= deleteEnd) {
        const delta = deleteEnd - deleteStart
        start -= delta
        end -= delta
      }
    }

    if (mutation.insert) {
      const at = mutation.insert.at
      const length =
        mutation.insert.length ??
        (typeof mutation.insert.text === 'string'
          ? mutation.insert.text.length
          : 0)
      assertIntegerInRange(at, 'insert at', source.length)
      if (!Number.isInteger(length) || length < 0) {
        throw new MarkdownRuntimeError('protocol', 'insert length is invalid')
      }
      if (at <= start) {
        start += length
        end += length
      } else if (at < end) {
        end += length
        partial = true
      }
    }

    return Object.freeze({
      status: partial ? ('partial' as const) : ('mapped' as const),
      range: Object.freeze({ start, end }),
    })
  }

  const sourceRangeToVisual = (range: MarkdownSourceRange) =>
    sourceSelectionToVisual({ anchor: range.start, focus: range.end })

  const resolveHitOffset = (
    hit: MarkdownPointerHit,
    node: MarkdownAnchorSyntaxNode,
  ) => {
    if (Number.isInteger(hit.localOffset)) {
      const raw = node.start + (hit.localOffset as number)
      assertIntegerInRange(raw, 'pointer local offset', source.length)
      if (raw < node.start || raw > node.end) {
        throw new MarkdownRuntimeError(
          'protocol',
          'pointer local offset is outside the anchor',
        )
      }
      return raw
    }
    if (hit.point === 'end' || hit.point === 'after') return node.end
    if (hit.point === 'caret' && hit.affinity === 'after') return node.end
    return node.start
  }

  const pointerHitToSource = (
    hit: MarkdownPointerHit,
    options?: { readonly platform?: MarkdownPointerPlatform },
  ): MarkdownPointerSourcePosition => {
    const platform = options?.platform ?? 'live'
    if (!MARKDOWN_POINTER_PLATFORMS.includes(platform)) {
      throw new MarkdownRuntimeError(
        'protocol',
        `unknown pointer platform: ${String(platform)}`,
      )
    }
    const node = requireNode(hit.anchorId)
    const raw = resolveHitOffset(hit, node)
    const boundary = coordinates.graphemeBoundaryAt(raw)
    const offset =
      hit.affinity === 'after' && raw > boundary.start && raw < boundary.end
        ? boundary.end
        : raw > boundary.start && raw < boundary.end
          ? boundary.start
          : raw
    return Object.freeze({
      offset,
      end: node.end,
      platform,
      hidden: node.hidden,
      virtual: node.virtual,
      anchorId: node.id,
    })
  }

  const nodeAtBoundary = (
    offset: number,
    side: 'start' | 'end',
    preferVisible: boolean,
  ) => {
    const matches = syntax.filter((node) =>
      side === 'start' ? node.start === offset : node.end === offset,
    )
    if (matches.length === 0) return undefined
    const visible = matches.filter((node) => !node.hidden)
    const pool = preferVisible && visible.length > 0 ? visible : matches
    return smallestNode(pool)
  }

  const traverseHiddenMarker = (
    query: MarkdownHiddenTraversalQuery,
  ): MarkdownHiddenTraversal => {
    const node = requireNode(query.anchorId)
    if (query.direction !== 'forward' && query.direction !== 'backward') {
      throw new MarkdownRuntimeError(
        'protocol',
        'hidden traversal requires a direction',
      )
    }
    if (query.direction === 'forward') {
      const next = nodeAtBoundary(node.end, 'start', true)
      return Object.freeze({
        offset: node.end,
        crossed: node.hidden,
        hidden: node.hidden,
        nextAnchorId: next?.id ?? documentAnchorId,
      })
    }
    const previous = nodeAtBoundary(node.start, 'end', true)
    return Object.freeze({
      offset: node.start,
      crossed: node.hidden,
      hidden: node.hidden,
      nextAnchorId: previous?.id ?? documentAnchorId,
    })
  }

  const sourceRangeToReveal = (
    range: MarkdownSourceRange,
  ): MarkdownSourceReveal => {
    assertIntegerInRange(range.start, 'reveal start', source.length)
    assertIntegerInRange(range.end, 'reveal end', source.length)
    const start = Math.min(range.start, range.end)
    const end = Math.max(range.start, range.end)
    const overlapping = syntax.filter((node) =>
      start === end
        ? node.start <= start && node.end >= end
        : node.start < end && node.end > start,
    )
    const highlights = overlapping.map((node) =>
      Object.freeze({
        anchorId: node.id,
        hidden: node.hidden,
        virtual: node.virtual,
        range: Object.freeze({ start: node.start, end: node.end }),
      }),
    )
    const exact = overlapping.filter(
      (node) => node.start === start && node.end === end,
    )
    const revealNode =
      exact.length > 0
        ? smallestNode(exact)
        : overlapping.length > 0
          ? smallestNode(overlapping)
          : undefined
    return Object.freeze({
      identity,
      documentIdentity,
      highlights: Object.freeze(highlights),
      reveal: revealNode
        ? reveal({ anchorId: revealNode.id })
        : Object.freeze({
            virtual: false,
            identity,
            documentIdentity,
            anchorId: documentAnchorId,
            range: Object.freeze({ start, end }),
          }),
    })
  }

  return Object.freeze({
    identity,
    documentIdentity,
    source,
    coordinates,
    syntax: Object.freeze(syntax),
    sourceSelectionToVisual,
    visualAnchorToSourceSelection,
    sourcePositionToVisual,
    visualPointToSource,
    reveal,
    remapRange,
    sourceRangeToVisual,
    pointerHitToSource,
    traverseHiddenMarker,
    sourceRangeToReveal,
  })
}
