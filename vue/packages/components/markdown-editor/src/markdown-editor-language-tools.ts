import {
  type MarkdownAnchorMap,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import type {
  MarkdownEditorDocumentIdentity,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'

export type MarkdownSpellcheckMode = 'auto' | 'enabled' | 'disabled'

export type MarkdownNativeWritingToolsMode = 'auto' | 'disabled'

export type MarkdownLanguageToolStatus =
  | 'supported'
  | 'degraded'
  | 'unavailable'

export type MarkdownLanguageToolReason =
  | 'unsupported-platform'
  | 'disabled'
  | 'readonly'
  | 'preview'
  | 'composition-active'
  | 'code-block'
  | 'url'
  | 'atomic-node'
  | 'hidden-marker'
  | 'nested-syntax'
  | 'stale-document'
  | 'stale-projection'
  | 'stale-revision'
  | 'stale-selection'
  | 'stale-session'
  | 'invalid-range'
  | 'projection-unavailable'
  | 'session-required'
  | 'session-kind-conflict'
  | 'dom-authority-rejected'
  | 'full-source-rejected'

export interface MarkdownLanguageToolConfig {
  readonly autocorrect?: boolean
  readonly dictation?: boolean
  readonly lang?: string
  readonly nativeWritingTools?: MarkdownNativeWritingToolsMode
  readonly spellcheck?: MarkdownSpellcheckMode | boolean
}

export interface MarkdownLanguageToolCapability {
  readonly autocorrect: boolean
  readonly dictation: boolean
  readonly lang?: string
  readonly nativeWritingTools: MarkdownNativeWritingToolsMode
  readonly reason?: MarkdownLanguageToolReason
  readonly spellcheck: boolean
  readonly spellcheckMode: MarkdownSpellcheckMode
  readonly status: MarkdownLanguageToolStatus
}

export type MarkdownLanguageToolSessionKind =
  | 'spellcheck'
  | 'autocorrect'
  | 'dictation'
  | 'writing-tools'
  | 'context-menu'

export interface MarkdownLanguageToolSession {
  readonly active: boolean
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly id: string
  readonly kind: MarkdownLanguageToolSessionKind
  readonly revision: number
  readonly selection: MarkdownEditorSelection
  readonly timestamp: number
}

export interface MarkdownLanguageToolCommitInput {
  readonly anchorMap: MarkdownAnchorMap
  readonly currentDocumentIdentity: MarkdownEditorDocumentIdentity
  readonly currentRevision: number
  readonly currentSelection: MarkdownEditorSelection
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly from: number
  readonly insert: string
  readonly isComposing?: boolean
  readonly kind: MarkdownLanguageToolSessionKind
  readonly projection: MarkdownStableProjection
  readonly projectionRevision: number
  readonly rawHtml?: string
  readonly revision: number
  readonly session: MarkdownLanguageToolSession
  readonly source: string
  readonly to: number
}

export interface MarkdownLanguageToolCommitResult {
  readonly accepted: boolean
  readonly reason?: MarkdownLanguageToolReason
  readonly session?: MarkdownLanguageToolSession
  readonly transaction?: MarkdownEditorTransaction
}

const ATOMIC_KINDS = new Set([
  'latex',
  'mermaid',
  'image',
  'embed',
  'caption',
  'anchor',
])

interface MarkdownLanguageProjectionRange {
  readonly end: number
  readonly start: number
}

type MarkdownLanguageProjectionNode = MarkdownStableSyntaxNode & {
  readonly rawContentRanges?: readonly MarkdownLanguageProjectionRange[]
  readonly rawMarkerRanges?: readonly MarkdownLanguageProjectionRange[]
}

const containsOffset = (
  range: MarkdownLanguageProjectionRange,
  offset: number,
  sourceLength: number,
) =>
  range.start <= offset &&
  (offset < range.end || (offset === range.end && offset === sourceLength))

const overlapsRange = (
  range: MarkdownLanguageProjectionRange,
  from: number,
  to: number,
) =>
  from === to
    ? range.start <= from && from < range.end
    : range.start < to && from < range.end

const markerRangesOf = (node: MarkdownStableSyntaxNode) =>
  (node as MarkdownLanguageProjectionNode).rawMarkerRanges

const contentRangesOf = (node: MarkdownStableSyntaxNode) =>
  (node as MarkdownLanguageProjectionNode).rawContentRanges

const protectedReasonForRange = (
  projection: MarkdownStableProjection,
  from: number,
  to: number,
): MarkdownLanguageToolReason | undefined => {
  const overlapping = projection.nodes.filter((node) =>
    overlapsRange(node.rawRange, from, to),
  )
  for (const node of overlapping) {
    if (node.presentation === 'live-atomic' || ATOMIC_KINDS.has(node.kind)) {
      return 'atomic-node'
    }
  }
  for (const node of overlapping) {
    if (markerRangesOf(node)?.some((range) => overlapsRange(range, from, to))) {
      return 'hidden-marker'
    }
  }
  for (const node of overlapping) {
    if (node.kind === 'code') return 'code-block'
    if (node.kind === 'link' || node.kind === 'image') {
      const target = contentRangesOf(node)?.[1]
      if (!target || overlapsRange(target, from, to)) return 'url'
    }
  }
  if (
    from !== to &&
    overlapping.length > 1 &&
    !overlapping.some(
      (node) => node.rawRange.start <= from && to <= node.rawRange.end,
    )
  ) {
    return 'nested-syntax'
  }
  return undefined
}

const smallestContainingNode = (
  nodes: readonly MarkdownStableSyntaxNode[],
  offset: number,
  sourceLength: number,
): MarkdownStableSyntaxNode | null => {
  const containing = nodes.filter((node) =>
    containsOffset(node.rawRange, offset, sourceLength),
  )
  if (containing.length === 0) return null
  return [...containing].sort((left, right) => {
    const span =
      left.rawRange.end -
      left.rawRange.start -
      (right.rawRange.end - right.rawRange.start)
    if (span !== 0) return span
    return left.id.localeCompare(right.id)
  })[0]!
}

export interface MarkdownLanguageToolInput {
  readonly autocorrect?: boolean
  readonly dictation?: boolean
  readonly lang?: string
  readonly nativeWritingTools?: MarkdownNativeWritingToolsMode
  readonly reason?: MarkdownLanguageToolReason
  readonly spellcheck?: MarkdownSpellcheckMode | boolean
  readonly spellcheckMode?: MarkdownSpellcheckMode
  readonly status?: MarkdownLanguageToolStatus
}

export const resolveMarkdownLanguageToolCapability = (
  input: MarkdownLanguageToolInput = {},
): MarkdownLanguageToolCapability => {
  const rawSpellcheck = input.spellcheck ?? 'auto'
  const spellcheckMode: MarkdownSpellcheckMode =
    typeof rawSpellcheck === 'boolean'
      ? rawSpellcheck
        ? 'enabled'
        : 'disabled'
      : rawSpellcheck
  const spellcheck = spellcheckMode !== 'disabled'
  const nativeWritingTools: MarkdownNativeWritingToolsMode =
    input.nativeWritingTools ?? 'auto'
  const status: MarkdownLanguageToolStatus =
    input.status ?? (spellcheck ? 'supported' : 'unavailable')
  const reason = input.reason ?? (spellcheck ? undefined : 'disabled')

  return Object.freeze({
    autocorrect: input.autocorrect ?? spellcheck,
    dictation: input.dictation ?? spellcheck,
    lang: input.lang,
    nativeWritingTools,
    reason,
    spellcheck,
    spellcheckMode,
    status,
  })
}

let sessionCounter = 0

export const createMarkdownLanguageToolSession = (input: {
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly kind?: MarkdownLanguageToolSessionKind
  readonly revision: number
  readonly selection: MarkdownEditorSelection
  readonly timestamp?: number
}): MarkdownLanguageToolSession => {
  sessionCounter += 1
  const kind = input.kind ?? 'spellcheck'
  const id = `lang-session:${input.documentIdentity.id}:${input.documentIdentity.epoch}:${input.revision}:${kind}:${sessionCounter}`
  return Object.freeze({
    active: true,
    documentIdentity: Object.freeze({
      epoch: input.documentIdentity.epoch,
      id: input.documentIdentity.id,
    }),
    id,
    kind,
    revision: input.revision,
    selection: Object.freeze({
      direction: input.selection.direction ?? 'none',
      end: input.selection.end,
      start: input.selection.start,
    }),
    timestamp: input.timestamp ?? Date.now(),
  })
}

const planMarkdownLanguageToolReplacement = (
  from: number,
  to: number,
  insert: string,
  options?: {
    readonly documentIdentity?: MarkdownEditorDocumentIdentity
    readonly kind?: MarkdownLanguageToolSessionKind
    readonly revision?: number
    readonly session?: MarkdownLanguageToolSession
  },
): MarkdownEditorTransaction =>
  Object.freeze({
    changes: Object.freeze([{ from, insert, to }]),
    expectedRevision: options?.revision ?? options?.session?.revision,
    history: 'separate' as const,
    metadata: Object.freeze({
      kind: options?.kind ?? options?.session?.kind ?? 'spellcheck',
      languageTool: true,
      sessionId: options?.session?.id,
      sessionKind: options?.session?.kind,
    }),
    origin: 'input' as const,
    selection: Object.freeze({
      direction: 'none' as const,
      end: from + insert.length,
      start: from + insert.length,
    }),
  })

export const resolveMarkdownLanguageToolContextCapability = (input: {
  readonly config?: MarkdownLanguageToolConfig
  readonly disabled?: boolean
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly isComposing?: boolean
  readonly mode?: MarkdownEditorMode
  readonly offset?: number
  readonly projection?: MarkdownStableProjection
  readonly readonly?: boolean
  readonly revision?: number
  readonly selection?: MarkdownEditorSelection
  readonly source: string
}): MarkdownLanguageToolCapability => {
  const base = resolveMarkdownLanguageToolCapability(input.config)
  if (input.disabled) {
    return Object.freeze({
      ...base,
      reason: 'disabled',
      spellcheck: false,
      status: 'unavailable',
    })
  }
  if (input.readonly) {
    return Object.freeze({
      ...base,
      reason: 'readonly',
      spellcheck: false,
      status: 'unavailable',
    })
  }
  if (input.mode === 'preview') {
    return Object.freeze({
      ...base,
      reason: 'preview',
      spellcheck: false,
      status: 'unavailable',
    })
  }
  if (input.isComposing) {
    return Object.freeze({
      ...base,
      reason: 'composition-active',
      spellcheck: false,
      status: 'degraded',
    })
  }
  if (base.spellcheckMode === 'disabled') {
    return Object.freeze({
      ...base,
      reason: 'disabled',
      spellcheck: false,
      status: 'unavailable',
    })
  }

  const offset = input.selection?.start ?? input.offset ?? 0
  const projection = input.projection
  if (!projection) {
    return Object.freeze({
      ...base,
      reason: 'projection-unavailable',
      spellcheck: false,
      status: 'degraded',
    })
  }
  if (
    input.documentIdentity &&
    (projection.documentIdentity.id !== input.documentIdentity.id ||
      projection.documentIdentity.epoch !== input.documentIdentity.epoch)
  ) {
    return Object.freeze({
      ...base,
      reason: 'stale-document',
      spellcheck: false,
      status: 'unavailable',
    })
  }

  const node = smallestContainingNode(
    projection.nodes,
    offset,
    input.source.length,
  )
  if (node) {
    const protectedReason = protectedReasonForRange(projection, offset, offset)
    if (protectedReason === 'hidden-marker') {
      return Object.freeze({
        ...base,
        reason: protectedReason,
        spellcheck: false,
        status: 'degraded',
      })
    }
    if (node.kind === 'code') {
      return Object.freeze({
        ...base,
        reason: 'code-block',
        spellcheck: false,
        status: 'degraded',
      })
    }
    if (ATOMIC_KINDS.has(node.kind)) {
      return Object.freeze({
        ...base,
        reason: 'atomic-node',
        spellcheck: false,
        status: 'degraded',
      })
    }
    if (protectedReason) {
      return Object.freeze({
        ...base,
        reason: protectedReason,
        spellcheck: false,
        status: 'degraded',
      })
    }
  }

  return Object.freeze({
    ...base,
    reason: undefined,
    spellcheck: true,
    status: 'supported',
  })
}

const sameDocumentIdentity = (
  left: MarkdownEditorDocumentIdentity,
  right: MarkdownEditorDocumentIdentity,
) => left.id === right.id && left.epoch === right.epoch

const sameSelection = (
  left: MarkdownEditorSelection,
  right: MarkdownEditorSelection,
) =>
  left.start === right.start &&
  left.end === right.end &&
  (left.direction ?? 'none') === (right.direction ?? 'none')

const isSplitSurrogateBoundary = (source: string, offset: number) => {
  if (offset <= 0 || offset >= source.length) return false
  const previous = source.charCodeAt(offset - 1)
  const next = source.charCodeAt(offset)
  return (
    previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
  )
}

export const commitMarkdownLanguageToolMutation = (
  input: MarkdownLanguageToolCommitInput,
): MarkdownLanguageToolCommitResult => {
  if (input.isComposing) {
    return Object.freeze({
      accepted: false,
      reason: 'composition-active',
    })
  }

  if (input.rawHtml !== undefined) {
    return Object.freeze({
      accepted: false,
      reason: 'dom-authority-rejected',
    })
  }

  if (
    !Number.isInteger(input.from) ||
    !Number.isInteger(input.to) ||
    input.from < 0 ||
    input.to < input.from ||
    input.to > input.source.length ||
    isSplitSurrogateBoundary(input.source, input.from) ||
    isSplitSurrogateBoundary(input.source, input.to)
  ) {
    return Object.freeze({
      accepted: false,
      reason: 'invalid-range',
    })
  }

  if (
    input.from === 0 &&
    input.to === input.source.length &&
    input.source.length > 0 &&
    (input.kind === 'spellcheck' ||
      input.kind === 'autocorrect' ||
      input.kind === 'context-menu')
  ) {
    return Object.freeze({
      accepted: false,
      reason: 'full-source-rejected',
    })
  }

  if (
    !sameDocumentIdentity(
      input.currentDocumentIdentity,
      input.documentIdentity,
    ) ||
    !sameDocumentIdentity(
      input.session.documentIdentity,
      input.documentIdentity,
    ) ||
    !sameDocumentIdentity(
      input.projection.documentIdentity,
      input.documentIdentity,
    ) ||
    !sameDocumentIdentity(
      input.anchorMap.documentIdentity,
      input.documentIdentity,
    )
  ) {
    return Object.freeze({
      accepted: false,
      reason: 'stale-document',
    })
  }

  if (input.currentRevision !== input.revision) {
    return Object.freeze({
      accepted: false,
      reason: 'stale-revision',
    })
  }

  if (input.projectionRevision !== input.currentRevision) {
    return Object.freeze({
      accepted: false,
      reason: 'stale-projection',
    })
  }

  if (input.anchorMap.source !== input.source) {
    return Object.freeze({
      accepted: false,
      reason: 'stale-projection',
    })
  }

  if (!input.session.active || input.session.revision !== input.revision) {
    return Object.freeze({
      accepted: false,
      reason: 'stale-session',
    })
  }

  if (input.session.kind !== input.kind) {
    return Object.freeze({
      accepted: false,
      reason: 'session-kind-conflict',
    })
  }

  if (!sameSelection(input.currentSelection, input.session.selection)) {
    return Object.freeze({
      accepted: false,
      reason: 'stale-selection',
    })
  }

  try {
    const visual = input.anchorMap.sourceSelectionToVisual({
      anchor: input.from,
      focus: input.to,
    })
    const roundTrip = input.anchorMap.visualAnchorToSourceSelection(visual)
    if (roundTrip.anchor !== input.from || roundTrip.focus !== input.to) {
      return Object.freeze({
        accepted: false,
        reason: 'invalid-range',
      })
    }
  } catch {
    return Object.freeze({
      accepted: false,
      reason: 'invalid-range',
    })
  }

  const protectedReason = protectedReasonForRange(
    input.projection,
    input.from,
    input.to,
  )
  if (protectedReason) {
    return Object.freeze({
      accepted: false,
      reason: protectedReason,
    })
  }

  const transaction = planMarkdownLanguageToolReplacement(
    input.from,
    input.to,
    input.insert,
    {
      documentIdentity: input.documentIdentity,
      kind: input.kind,
      revision: input.revision,
      session: input.session,
    },
  )

  return Object.freeze({
    accepted: true,
    session: input.session,
    transaction,
  })
}
