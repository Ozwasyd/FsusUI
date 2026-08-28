import {
  createMarkdownEditorProjection,
  createMarkdownSourceCoordinateMap,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownSourceCoordinateMap,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import {
  commitMarkdownLiveFeatureResult,
  resolveMarkdownLiveLayoutStability,
  type MarkdownLiveFeatureCommit,
  type MarkdownLiveLayoutPlan,
} from './markdown-editor-live-layout'
import { resolveMarkdownLiveSyntaxReveal } from './markdown-editor-live-reveal'
import {
  resolveMarkdownAtomicNodeIntent,
  type MarkdownAtomicNodeAction,
  type MarkdownAtomicNodePlan,
} from './markdown-editor-live-selection'
import type { MarkdownEditorSelection } from './markdown-editor-transaction'

export const MARKDOWN_TECHNICAL_NODE_KINDS = Object.freeze([
  'code',
  'latex',
  'mermaid',
] as const)

export type MarkdownTechnicalNodeKind =
  (typeof MARKDOWN_TECHNICAL_NODE_KINDS)[number]

export const MARKDOWN_TECHNICAL_STATES = Object.freeze([
  'pending',
  'resolved',
  'degraded',
  'error',
  'stale',
  'deleted',
  'document-switched',
] as const)

export type MarkdownTechnicalNodeState =
  (typeof MARKDOWN_TECHNICAL_STATES)[number]

export type MarkdownTechnicalFeatureKind =
  | 'code-highlight'
  | 'latex'
  | 'mermaid'

export interface MarkdownTechnicalMappedRange {
  readonly normalized: Readonly<{ end: number; start: number }>
  readonly raw: Readonly<{ end: number; start: number }>
}

export interface MarkdownTechnicalRanges {
  readonly body: MarkdownTechnicalMappedRange
  readonly closed: boolean
  readonly closing: MarkdownTechnicalMappedRange
  readonly info: MarkdownTechnicalMappedRange
  readonly infoText: string
  readonly opening: MarkdownTechnicalMappedRange
}

export interface MarkdownTechnicalNodePlan {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly kind: MarkdownTechnicalNodeKind
  readonly nodeId: string
  readonly ranges: MarkdownTechnicalRanges
  readonly rawRange: Readonly<{ end: number; start: number }>
  readonly rejected?: 'unsupported'
  readonly revision: number
}

export interface MarkdownTechnicalFeatureRequest {
  readonly abortSignal: AbortSignal | null
  readonly config: Readonly<Record<string, unknown>>
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly featureKind: MarkdownTechnicalFeatureKind
  readonly id: string
  readonly kind: MarkdownTechnicalNodeKind
  readonly locale: string | null
  readonly nodeId: string
  readonly ranges: MarkdownTechnicalRanges
  readonly revision: number
  readonly state: MarkdownTechnicalNodeState
  readonly theme: string | null
}

export interface MarkdownTechnicalFeatureOutput {
  readonly kind: MarkdownTechnicalFeatureKind
  readonly payload: string
  readonly rootId?: string
}

export interface MarkdownTechnicalFeatureCommit extends MarkdownLiveFeatureCommit {
  readonly diagnostic: MarkdownTechnicalDiagnostic | null
  readonly editorCapability: 'supported'
  readonly sourceUnchanged: true
  readonly state: MarkdownTechnicalNodeState
}

export interface MarkdownTechnicalDiagnostic {
  readonly code: string
  readonly message: string
  readonly nodeId: string
  readonly range: Readonly<{ end: number; start: number }>
  readonly reveal: ReturnType<typeof resolveMarkdownLiveSyntaxReveal>
}

export type MarkdownTechnicalMutationKind =
  | 'regex-node'
  | 'innerHTML'
  | 'body-hash-reuse'
  | 'toast-only-error'

const TECHNICAL_KIND_SET = new Set<string>(MARKDOWN_TECHNICAL_NODE_KINDS)

const technicalKindOf = (
  node: MarkdownStableSyntaxNode,
): MarkdownTechnicalNodeKind | null => {
  if (TECHNICAL_KIND_SET.has(node.kind)) {
    return node.kind as MarkdownTechnicalNodeKind
  }
  return node.kind === 'malformed' &&
    node.status === 'malformed' &&
    node.diagnosticCode === 'unclosed-code-fence'
    ? 'code'
    : null
}

const sameDocument = (
  left?: MarkdownDocumentIdentity,
  right?: MarkdownDocumentIdentity,
) => {
  if (!left || !right) return true
  return left.id === right.id && left.epoch === right.epoch
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

const emptyMapped = (
  coordinates: MarkdownSourceCoordinateMap,
  at: number,
): MarkdownTechnicalMappedRange => {
  const raw = Object.freeze({ end: at, start: at })
  return Object.freeze({
    normalized: Object.freeze(coordinates.toNormalizedRange(raw)),
    raw,
  })
}

const mappedRange = (
  coordinates: MarkdownSourceCoordinateMap,
  start: number,
  end: number,
): MarkdownTechnicalMappedRange => {
  const raw = Object.freeze({
    end: Math.max(start, end),
    start,
  })
  return Object.freeze({
    normalized: Object.freeze(coordinates.toNormalizedRange(raw)),
    raw,
  })
}

const leadingIndent = (slice: string, index: number) => {
  let cursor = index
  while (cursor < slice.length && (slice[cursor] === ' ' || slice[cursor] === '\t')) {
    cursor += 1
  }
  return cursor
}

const fenceRun = (slice: string, index: number) => {
  const marker = slice[index]
  if (marker !== '`' && marker !== '~' && marker !== ':') {
    return { char: '', length: 0 }
  }
  let length = 0
  while (slice[index + length] === marker) length += 1
  return { char: marker, length }
}

const lineBreakAt = (slice: string, from: number) => {
  for (let index = from; index < slice.length; index += 1) {
    if (slice[index] === '\n' || slice[index] === '\r') return index
  }
  return -1
}

const skipLineBreak = (slice: string, at: number) => {
  if (slice[at] === '\r' && slice[at + 1] === '\n') return at + 2
  return at + 1
}

const lastNonEmptyLineStart = (slice: string) => {
  let end = slice.length
  while (
    end > 0 &&
    (slice[end - 1] === '\n' ||
      slice[end - 1] === '\r' ||
      slice[end - 1] === ' ' ||
      slice[end - 1] === '\t')
  ) {
    end -= 1
  }
  const prefix = slice.slice(0, end)
  const newline = prefix.lastIndexOf('\n')
  if (newline !== -1) return newline + 1
  const cr = prefix.lastIndexOf('\r')
  return cr === -1 ? 0 : cr + 1
}

const featureKindOf = (
  kind: MarkdownTechnicalNodeKind,
): MarkdownTechnicalFeatureKind =>
  kind === 'code' ? 'code-highlight' : kind

const coveringTechnical = (
  projection: MarkdownStableProjection,
  offset: number,
  kind?: string,
): MarkdownStableSyntaxNode | null => {
  const covering = projection.nodes.filter(
    (node) => {
      const technicalKind = technicalKindOf(node)
      return (
        technicalKind !== null &&
        (!kind || technicalKind === kind) &&
        node.rawRange.start <= offset &&
        offset <= node.rawRange.end
      )
    },
  )
  if (covering.length > 0) {
    return [...covering].sort((left, right) => {
      const span =
        left.rawRange.end -
        left.rawRange.start -
        (right.rawRange.end - right.rawRange.start)
      if (span !== 0) return span
      return left.id.localeCompare(right.id)
    })[0]!
  }
  if (kind) {
    return (
      projection.nodes.find((node) => technicalKindOf(node) === kind) ?? null
    )
  }
  return (
    projection.nodes.find((node) => technicalKindOf(node) !== null) ?? null
  )
}

const partitionRanges = (
  source: string,
  node: MarkdownStableSyntaxNode,
  coordinates: MarkdownSourceCoordinateMap,
): MarkdownTechnicalRanges => {
  const start = node.rawRange.start
  const end = node.rawRange.end
  const slice = source.slice(start, end)
  const bom = slice.startsWith('\uFEFF') ? 1 : 0
  const indent = leadingIndent(slice, bom)

  if (node.kind === 'latex' && (slice.startsWith('\\(', indent) || slice.startsWith('\\[', indent))) {
    const openEnd = indent + 2
    const closer = slice.startsWith('\\(', indent) ? '\\)' : '\\]'
    const closeAt = slice.indexOf(closer, openEnd)
    const closed = closeAt !== -1
    const bodyEnd = closed ? start + closeAt : end
    return Object.freeze({
      body: mappedRange(coordinates, start + openEnd, bodyEnd),
      closed,
      closing: closed
        ? mappedRange(coordinates, start + closeAt, start + closeAt + 2)
        : emptyMapped(coordinates, end),
      info: emptyMapped(coordinates, start + openEnd),
      infoText: '',
      opening: mappedRange(coordinates, start + indent, start + openEnd),
    })
  }

  if (node.kind === 'latex' && slice.startsWith('$$', indent)) {
    const openEnd = indent + 2
    const firstBreak = lineBreakAt(slice, openEnd)
    const lastStart = lastNonEmptyLineStart(slice)
    const lastText = slice.slice(lastStart).replace(/\s+$/u, '')
    const singleLine =
      firstBreak === -1 && slice.trimEnd().endsWith('$$') && slice.trim().length > 4
    const closed =
      singleLine || (lastStart > 0 && lastText.trim() === '$$')
    const bodyStart = firstBreak === -1 ? start + openEnd : start + skipLineBreak(slice, firstBreak)
    const bodyEnd = singleLine
      ? end - 2
      : closed
        ? start + lastStart
        : end
    return Object.freeze({
      body: mappedRange(coordinates, Math.min(bodyStart, bodyEnd), bodyEnd),
      closed,
      closing: singleLine
        ? mappedRange(coordinates, end - 2, end)
        : closed
          ? mappedRange(coordinates, start + lastStart, end)
          : emptyMapped(coordinates, end),
      info: mappedRange(
        coordinates,
        start + openEnd,
        start + (firstBreak === -1 && !singleLine ? slice.length : Math.max(openEnd, firstBreak === -1 ? openEnd : firstBreak)),
      ),
      infoText: '',
      opening: mappedRange(coordinates, start + indent, start + openEnd),
    })
  }

  const run = fenceRun(slice, indent)
  const colonFence = run.char === ':' && run.length >= 3
  const tickFence =
    (run.char === '`' || run.char === '~') && run.length >= 3
  if (tickFence || colonFence) {
    const openEnd = indent + run.length
    const firstBreak = lineBreakAt(slice, openEnd)
    const infoEnd = firstBreak === -1 ? slice.length : firstBreak
    const infoText = slice.slice(openEnd, infoEnd).trim()
    const lastStart = lastNonEmptyLineStart(slice)
    const lastIndent = leadingIndent(slice, lastStart)
    const lastRun = fenceRun(slice, lastIndent)
    const closed =
      lastStart > 0 &&
      lastRun.char === run.char &&
      lastRun.length >= (colonFence ? 3 : Math.min(3, run.length))
    const bodyStart =
      firstBreak === -1 ? start + openEnd : start + skipLineBreak(slice, firstBreak)
    const bodyEnd = closed ? start + lastStart : end
    return Object.freeze({
      body: mappedRange(coordinates, Math.min(bodyStart, bodyEnd), bodyEnd),
      closed,
      closing: closed
        ? mappedRange(coordinates, start + lastStart, end)
        : emptyMapped(coordinates, end),
      info: mappedRange(coordinates, start + openEnd, start + infoEnd),
      infoText,
      opening: mappedRange(coordinates, start + indent, start + openEnd),
    })
  }

  return Object.freeze({
    body: mappedRange(coordinates, start, end),
    closed: true,
    closing: emptyMapped(coordinates, end),
    info: emptyMapped(coordinates, start),
    infoText: '',
    opening: emptyMapped(coordinates, start),
  })
}

export const resolveMarkdownTechnicalNode = (input: {
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly kind?: MarkdownTechnicalNodeKind
  readonly nodeId?: string
  readonly projection?: MarkdownStableProjection
  readonly revision?: number
  readonly selection?: MarkdownEditorSelection
  readonly source: string
}): MarkdownTechnicalNodePlan | null => {
  const identity = input.documentIdentity ?? { epoch: 0, id: 'technical' }
  const projection = projectionOf(input.source, identity, input.projection)
  const located =
    input.nodeId && !input.nodeId.startsWith('regex:')
      ? projection.nodes.find((node) => node.id === input.nodeId)
      : coveringTechnical(
          projection,
          input.selection?.start ?? 0,
          input.kind,
        )
  if (!located) return null
  const kind = technicalKindOf(located)
  if (!kind) return null
  const coordinates = createMarkdownSourceCoordinateMap(input.source)
  return Object.freeze({
    documentIdentity: identity,
    kind,
    nodeId: located.id,
    ranges: partitionRanges(input.source, located, coordinates),
    rawRange: Object.freeze({
      end: located.rawRange.end,
      start: located.rawRange.start,
    }),
    revision: input.revision ?? 0,
  })
}

const requestIdOf = (
  identity: MarkdownDocumentIdentity,
  revision: number,
  nodeId: string,
) => `tech:${identity.id}:${identity.epoch}:${revision}:${nodeId}`

export const createMarkdownTechnicalFeatureRequest = (input: {
  readonly abortSignal?: AbortSignal | null
  readonly config?: Readonly<Record<string, unknown>>
  readonly currentIdentity?: MarkdownDocumentIdentity
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly expectedRevision?: number
  readonly kind?: MarkdownTechnicalNodeKind
  readonly locale?: string | null
  readonly mode?: MarkdownEditorMode
  readonly nodeId?: string
  readonly projection?: MarkdownStableProjection
  readonly revision?: number
  readonly selection?: MarkdownEditorSelection
  readonly source: string
  readonly theme?: string | null
}): MarkdownTechnicalFeatureRequest | null => {
  const identity = input.documentIdentity ?? { epoch: 0, id: 'technical' }
  const revision = input.revision ?? 0
  const node = resolveMarkdownTechnicalNode({
    documentIdentity: identity,
    kind: input.kind,
    nodeId: input.nodeId,
    projection: input.projection,
    revision,
    selection: input.selection,
    source: input.source,
  })
  if (!node) return null
  let state: MarkdownTechnicalNodeState = 'pending'
  if (!sameDocument(identity, input.currentIdentity)) {
    state = 'document-switched'
  } else if (
    input.expectedRevision !== undefined &&
    input.expectedRevision !== revision
  ) {
    state = 'stale'
  }
  return Object.freeze({
    abortSignal: input.abortSignal ?? null,
    config: Object.freeze({ ...(input.config ?? {}) }),
    documentIdentity: identity,
    featureKind: featureKindOf(node.kind),
    id: requestIdOf(identity, revision, node.nodeId),
    kind: node.kind,
    locale: input.locale ?? null,
    nodeId: node.nodeId,
    ranges: node.ranges,
    revision,
    state,
    theme: input.theme ?? null,
  })
}

const diagnosticOf = (
  input: {
    readonly documentIdentity: MarkdownDocumentIdentity
    readonly source: string
    readonly selection?: MarkdownEditorSelection
  },
  nodeId: string,
  range: Readonly<{ end: number; start: number }>,
  code: string,
  message: string,
): MarkdownTechnicalDiagnostic =>
  Object.freeze({
    code,
    message,
    nodeId,
    range,
    reveal: resolveMarkdownLiveSyntaxReveal({
      diagnosticNodeId: nodeId,
      documentIdentity: input.documentIdentity,
      intent: 'diagnostic',
      selection: input.selection ?? {
        direction: 'none',
        end: range.start,
        start: range.start,
      },
      source: input.source,
    }),
  })

export const resolveMarkdownTechnicalDiagnostic = (input: {
  readonly code?: string
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly kind?: MarkdownTechnicalNodeKind
  readonly message?: string
  readonly nodeId?: string
  readonly projection?: MarkdownStableProjection
  readonly selection?: MarkdownEditorSelection
  readonly source: string
}): MarkdownTechnicalDiagnostic | null => {
  const identity = input.documentIdentity ?? { epoch: 0, id: 'technical' }
  const node = resolveMarkdownTechnicalNode({
    documentIdentity: identity,
    kind: input.kind,
    nodeId: input.nodeId,
    projection: input.projection,
    selection: input.selection,
    source: input.source,
  })
  if (!node) return null
  const unclosed = !node.ranges.closed
  const code =
    input.code ?? (unclosed ? 'unclosed-fence' : 'technical-error')
  const message =
    input.message ??
    (unclosed
      ? `${node.kind} fence is unclosed`
      : `${node.kind} feature failed`)
  const range = unclosed ? node.ranges.opening.raw : node.ranges.body.raw
  return diagnosticOf(
    { documentIdentity: identity, selection: input.selection, source: input.source },
    node.nodeId,
    range.start === range.end ? node.rawRange : range,
    code,
    message,
  )
}

const isGatewayOutput = (
  value: unknown,
): value is MarkdownTechnicalFeatureOutput => {
  if (!value || typeof value !== 'object') return false
  const record = value as MarkdownTechnicalFeatureOutput
  if (typeof record.payload !== 'string') return false
  if (record.kind === 'code-highlight' || record.kind === 'latex') return true
  return record.kind === 'mermaid' && typeof record.rootId === 'string'
}

export const commitMarkdownTechnicalFeatureResult = (input: {
  readonly aborted?: boolean
  readonly consumerHtml?: string
  readonly currentIdentity?: MarkdownDocumentIdentity
  readonly currentRevision?: number
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly innerHTML?: boolean
  readonly output?: unknown
  readonly projection?: MarkdownStableProjection
  readonly request: MarkdownTechnicalFeatureRequest
  readonly source: string
}): MarkdownTechnicalFeatureCommit => {
  const identity = input.documentIdentity ?? input.request.documentIdentity
  const currentRevision = input.currentRevision ?? input.request.revision
  const failed = (
    state: MarkdownTechnicalNodeState,
    reason: MarkdownLiveFeatureCommit['reason'],
    diagnostic: MarkdownTechnicalDiagnostic | null = null,
  ): MarkdownTechnicalFeatureCommit =>
    Object.freeze({
      accepted: false,
      diagnostic,
      editorCapability: 'supported',
      reason,
      sourceUnchanged: true,
      state,
      visualUnchanged: true,
    })

  if (input.aborted || input.request.abortSignal?.aborted) {
    return failed('error', 'aborted')
  }
  if (input.consumerHtml !== undefined || input.innerHTML) {
    return failed(
      'error',
      'aborted',
      diagnosticOf(
        { documentIdentity: identity, source: input.source },
        input.request.nodeId,
        input.request.ranges.body.raw,
        'unsafe-output',
        'feature output must use the unique gateway',
      ),
    )
  }
  if (!sameDocument(identity, input.currentIdentity ?? input.request.documentIdentity)) {
    return failed('document-switched', 'stale-document')
  }
  const present = resolveMarkdownTechnicalNode({
    documentIdentity: identity,
    nodeId: input.request.nodeId,
    projection: input.projection,
    revision: currentRevision,
    source: input.source,
  })
  if (!present) return failed('deleted', 'stale-node')
  const layout = commitMarkdownLiveFeatureResult({
    expected: {
      documentIdentity: input.request.documentIdentity,
      nodeId: input.request.nodeId,
      revision: input.request.revision,
    },
    incoming: {
      documentIdentity: identity,
      nodeId: present.nodeId,
      revision: currentRevision,
    },
  })
  if (!layout.accepted) {
    return failed(
      layout.reason === 'stale-document' ? 'document-switched' : 'stale',
      layout.reason,
    )
  }
  if (input.output !== undefined && !isGatewayOutput(input.output)) {
    return failed(
      'error',
      'aborted',
      diagnosticOf(
        { documentIdentity: identity, source: input.source },
        present.nodeId,
        present.ranges.body.raw,
        'unsafe-output',
        'feature output must use the unique gateway',
      ),
    )
  }
  if (input.output === undefined) {
    return Object.freeze({
      accepted: true,
      diagnostic: present.ranges.closed
        ? null
        : resolveMarkdownTechnicalDiagnostic({
            documentIdentity: identity,
            nodeId: present.nodeId,
            source: input.source,
          }),
      editorCapability: 'supported',
      sourceUnchanged: true,
      state: present.ranges.closed ? 'degraded' : 'error',
      visualUnchanged: false,
    })
  }
  return Object.freeze({
    accepted: true,
    diagnostic: null,
    editorCapability: 'supported',
    sourceUnchanged: true,
    state: 'resolved',
    visualUnchanged: false,
  })
}

export const resolveMarkdownTechnicalAtomic = (input: {
  readonly action: MarkdownAtomicNodeAction
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly kind?: MarkdownTechnicalNodeKind
  readonly mode?: MarkdownEditorMode
  readonly nodeId?: string
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}): MarkdownAtomicNodePlan => {
  const node = resolveMarkdownTechnicalNode({
    documentIdentity: input.documentIdentity,
    kind: input.kind,
    nodeId: input.nodeId,
    revision: input.revision,
    selection: input.selection,
    source: input.source,
  })
  return resolveMarkdownAtomicNodeIntent({
    action: input.action,
    documentIdentity: input.documentIdentity,
    kind: node?.kind ?? input.kind,
    mode: input.mode,
    nodeId: node?.nodeId ?? input.nodeId,
    revision: input.revision,
    selection: input.selection,
    source: input.source,
  })
}

export const resolveMarkdownTechnicalHeight = (input: {
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly kind?: MarkdownTechnicalNodeKind
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}): MarkdownLiveLayoutPlan => {
  const node = resolveMarkdownTechnicalNode({
    documentIdentity: input.documentIdentity,
    kind: input.kind,
    revision: input.revision,
    selection: input.selection,
    source: input.source,
  })
  const trigger =
    node?.kind === 'latex'
      ? 'latex-result'
      : node?.kind === 'mermaid'
        ? 'mermaid-result'
        : 'shiki-result'
  return resolveMarkdownLiveLayoutStability({
    documentIdentity: input.documentIdentity,
    revision: input.revision,
    selection: input.selection,
    source: input.source,
    trigger,
  })
}

export const evaluateMarkdownTechnicalMutations = () => {
  const identity = Object.freeze({ epoch: 1, id: 'tech-doc' })
  const source = '```js\nconst x = 1\n```\n'
  const authority = resolveMarkdownTechnicalNode({
    documentIdentity: identity,
    kind: 'code',
    source,
  })
  const regex = /```[\s\S]*?```/.exec(source)
  const request = createMarkdownTechnicalFeatureRequest({
    documentIdentity: identity,
    kind: 'code',
    revision: 1,
    source,
  })
  const other = createMarkdownTechnicalFeatureRequest({
    documentIdentity: { epoch: 2, id: 'other-doc' },
    kind: 'code',
    revision: 1,
    source,
  })
  const html = commitMarkdownTechnicalFeatureResult({
    consumerHtml: '<img onerror="1">',
    request: request!,
    source,
  })
  const diagnostic = resolveMarkdownTechnicalDiagnostic({
    documentIdentity: identity,
    kind: 'code',
    source: '```js\nconst x = 1\n',
  })
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        accepted:
          !authority?.nodeId.startsWith('syn:') ||
          authority.nodeId === `regex:${regex?.index ?? -1}`,
        detail: 'technical nodes come from the projection, not a fence regex',
        kind: 'regex-node' as const,
      }),
      Object.freeze({
        accepted: html.accepted,
        detail: 'feature output must not accept consumer innerHTML',
        kind: 'innerHTML' as const,
      }),
      Object.freeze({
        accepted: Boolean(request && other && request.id === other.id),
        detail: 'same body in another document must not reuse the request',
        kind: 'body-hash-reuse' as const,
      }),
      Object.freeze({
        accepted:
          !diagnostic?.range ||
          diagnostic.reveal.state !== 'diagnostic-reveal',
        detail: 'errors must reveal an exact source range',
        kind: 'toast-only-error' as const,
      }),
    ]),
  })
}
