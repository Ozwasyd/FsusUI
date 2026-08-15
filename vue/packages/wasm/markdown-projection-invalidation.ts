import { MarkdownRuntimeError } from './markdown-runtime-error'
import type { MarkdownSourceRange } from './markdown-source-coordinate-map'
import type {
  MarkdownDocumentIdentity,
  MarkdownStableProjection,
  MarkdownStableSyntaxNode,
} from './markdown-syntax-identity'

export interface MarkdownProjectionChange {
  readonly from: number
  readonly to: number
  readonly insert: string
}

export type MarkdownInvalidationReason =
  | 'local-edit'
  | 'adjacent-boundary'
  | 'unclosed-fence'
  | 'list-structure'
  | 'reference-or-footnote'
  | 'setext-heading'
  | 'expanded-unsafe'
  | 'document-switch'

export type MarkdownProjectionTaskFailure =
  | 'aborted'
  | 'stale-revision'
  | 'document-switch'

export interface MarkdownProjectionInvalidationBudget {
  readonly scannedBytes: number
  readonly examinedNodes: number
}

export interface MarkdownRetainedSyntaxNode {
  readonly id: string
  readonly range: MarkdownSourceRange
}

export interface MarkdownProjectionInvalidationPlan {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly taskId: string
  readonly reason: MarkdownInvalidationReason
  readonly expanded: boolean
  readonly invalidatedRanges: readonly MarkdownSourceRange[]
  readonly invalidatedNodeIds: readonly string[]
  readonly retainedNodeIds: readonly string[]
  readonly retained: readonly MarkdownRetainedSyntaxNode[]
  readonly budget: MarkdownProjectionInvalidationBudget
}

export interface MarkdownProjectionTaskCommitOk<T> {
  readonly ok: true
  readonly value: T
}

export interface MarkdownProjectionTaskCommitErr {
  readonly ok: false
  readonly reason: MarkdownProjectionTaskFailure
}

export interface MarkdownProjectionTask {
  readonly taskId: string
  readonly revision: number
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly aborted: boolean
  abort(): void
  commit<T>(
    current: {
      readonly revision: number
      readonly documentIdentity: MarkdownDocumentIdentity
    },
    value: T,
  ): MarkdownProjectionTaskCommitOk<T> | MarkdownProjectionTaskCommitErr
}

export interface MarkdownProjectionInvalidationInput {
  readonly identity: MarkdownDocumentIdentity
  readonly revision: number
  readonly previousSource: string
  readonly change: MarkdownProjectionChange
  readonly previous: MarkdownStableProjection
  readonly taskId?: string
}

const UNSAFE_KINDS = new Set([
  'code',
  'mermaid',
  'latex',
  'list',
  'table',
  'footnote',
  'task',
])

const FENCE_RE = /```|~~~|\$\$/
const LIST_MARKER_RE = /^(?: {0,3}(?:[-+*] |\d+[.)] |\[[ xX]\] ))/m
const REFERENCE_RE = /^(?: {0,3}\[[^\]]+\]:)/m
const FOOTNOTE_RE = /\[\^[^\]]+\]/
const SETEXT_RE = /^(?: {0,3}(?:=+|-+)[ \t]*)$/m

const sameIdentity = (
  left: MarkdownDocumentIdentity,
  right: MarkdownDocumentIdentity,
) => left.id === right.id && left.epoch === right.epoch

const assertIdentity = (identity: MarkdownDocumentIdentity) => {
  if (!identity?.id) {
    throw new MarkdownRuntimeError(
      'protocol',
      'invalidation requires a document identity',
    )
  }
  if (!Number.isInteger(identity.epoch)) {
    throw new MarkdownRuntimeError(
      'protocol',
      'invalidation requires a document epoch',
    )
  }
}

const assertChange = (source: string, change: MarkdownProjectionChange) => {
  if (!Number.isInteger(change.from) || !Number.isInteger(change.to)) {
    throw new MarkdownRuntimeError('protocol', 'invalidation change is not an integer range')
  }
  if (change.from < 0 || change.to < change.from || change.to > source.length) {
    throw new MarkdownRuntimeError('protocol', 'invalidation change is outside the source')
  }
  if (typeof change.insert !== 'string') {
    throw new MarkdownRuntimeError('protocol', 'invalidation change requires insert text')
  }
}

const overlapsChange = (
  range: MarkdownSourceRange,
  change: MarkdownProjectionChange,
) => range.start <= change.to && range.end >= change.from

const remapThroughChange = (
  range: MarkdownSourceRange,
  change: MarkdownProjectionChange,
):
  | { readonly status: 'deleted' }
  | { readonly status: 'partial'; readonly range: MarkdownSourceRange }
  | { readonly status: 'mapped'; readonly range: MarkdownSourceRange } => {
  const delta = change.insert.length - (change.to - change.from)
  if (range.end <= change.from) {
    return { status: 'mapped', range }
  }
  if (range.start >= change.to) {
    return {
      status: 'mapped',
      range: { start: range.start + delta, end: range.end + delta },
    }
  }
  if (
    range.start >= change.from &&
    range.end <= change.to &&
    range.start < range.end
  ) {
    return { status: 'deleted' }
  }
  const start = Math.min(range.start, change.from)
  const end =
    Math.max(range.end, change.to) + change.insert.length - (change.to - change.from)
  return {
    status: 'partial',
    range: { start, end: Math.max(start, end) },
  }
}

const reasonFromChangedText = (slice: string, insert: string) => {
  const sample = `${slice}\n${insert}`
  if (FENCE_RE.test(sample)) return 'unclosed-fence' as const
  if (REFERENCE_RE.test(sample) || FOOTNOTE_RE.test(sample)) {
    return 'reference-or-footnote' as const
  }
  if (SETEXT_RE.test(sample)) return 'setext-heading' as const
  if (LIST_MARKER_RE.test(sample)) return 'list-structure' as const
  return null
}

const mergeRanges = (ranges: readonly MarkdownSourceRange[]) => {
  const ordered = [...ranges].sort((left, right) => left.start - right.start)
  const merged: { start: number; end: number }[] = []
  for (const range of ordered) {
    const last = merged[merged.length - 1]
    if (!last || range.start > last.end) {
      merged.push({ start: range.start, end: range.end })
      continue
    }
    last.end = Math.max(last.end, range.end)
  }
  return merged.map((range) => Object.freeze({ start: range.start, end: range.end }))
}

const neighborsOf = (
  nodes: readonly MarkdownStableSyntaxNode[],
  change: MarkdownProjectionChange,
) => {
  let before: MarkdownStableSyntaxNode | undefined
  let after: MarkdownStableSyntaxNode | undefined
  for (const node of nodes) {
    if (node.rawRange.end <= change.from) {
      if (!before || node.rawRange.end >= before.rawRange.end) before = node
    }
    if (node.rawRange.start >= change.to) {
      if (!after || node.rawRange.start < after.rawRange.start) after = node
    }
  }
  return { before, after }
}

export const planMarkdownProjectionInvalidation = (
  input: MarkdownProjectionInvalidationInput,
): MarkdownProjectionInvalidationPlan => {
  assertIdentity(input.identity)
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    throw new MarkdownRuntimeError('protocol', 'invalidation requires a source revision')
  }
  if (typeof input.previousSource !== 'string') {
    throw new MarkdownRuntimeError('protocol', 'invalidation requires the previous source')
  }
  if (
    !input.previous ||
    !sameIdentity(input.previous.documentIdentity, input.identity)
  ) {
    throw new MarkdownRuntimeError(
      'protocol',
      'invalidation previous projection does not match the document',
    )
  }
  assertChange(input.previousSource, input.change)

  const change = input.change
  const nodes = input.previous.nodes
  const slice = input.previousSource.slice(change.from, change.to)
  const scannedBytes = slice.length + change.insert.length
  let examinedNodes = 0

  const overlapping: MarkdownStableSyntaxNode[] = []
  for (const node of nodes) {
    examinedNodes += 1
    if (overlapsChange(node.rawRange, change)) overlapping.push(node)
  }

  const textReason = reasonFromChangedText(slice, change.insert)
  const overlappingUnsafe = overlapping.filter((node) => UNSAFE_KINDS.has(node.kind))
  const openFence = nodes.find(
    (node) =>
      (node.kind === 'code' || node.kind === 'mermaid' || node.kind === 'latex') &&
      node.rawRange.end === input.previousSource.length &&
      node.rawRange.start <= change.from,
  )

  const nextLength =
    input.previousSource.length + change.insert.length - (change.to - change.from)
  const toNextOffset = (offset: number) => {
    if (offset <= change.from) return offset
    if (offset >= change.to) {
      return offset + change.insert.length - (change.to - change.from)
    }
    return change.from
  }

  let reason: MarkdownInvalidationReason = 'local-edit'
  let expanded = false
  let invalidateFrom: number | undefined
  let invalidateTo: number | undefined

  if (openFence || textReason === 'unclosed-fence') {
    const start =
      openFence?.rawRange.start ??
      overlappingUnsafe[0]?.rawRange.start ??
      change.from
    reason = 'unclosed-fence'
    expanded = true
    invalidateFrom = toNextOffset(start)
    invalidateTo = nextLength
  } else if (textReason === 'reference-or-footnote' || overlapping.some((node) => node.kind === 'footnote')) {
    reason = 'reference-or-footnote'
    expanded = true
    invalidateFrom = 0
    invalidateTo = nextLength
  } else if (textReason === 'setext-heading') {
    const { before } = neighborsOf(nodes, change)
    reason = 'setext-heading'
    expanded = true
    invalidateFrom = toNextOffset(before?.rawRange.start ?? change.from)
    invalidateTo = nextLength
  } else if (textReason === 'list-structure' || overlapping.some((node) => node.kind === 'list' || node.kind === 'task')) {
    const list = overlapping.find((node) => node.kind === 'list' || node.kind === 'task')
    reason = 'list-structure'
    expanded = true
    invalidateFrom = toNextOffset(list?.rawRange.start ?? change.from)
    invalidateTo = Math.max(
      toNextOffset(list?.rawRange.end ?? change.to),
      toNextOffset(change.to) + change.insert.length,
    )
  } else if (overlappingUnsafe.length > 0) {
    reason = 'expanded-unsafe'
    expanded = true
    invalidateFrom = toNextOffset(overlappingUnsafe[0]!.rawRange.start)
    invalidateTo = nextLength
  }

  const invalidatedIds = new Set<string>()
  const retained: MarkdownRetainedSyntaxNode[] = []
  const invalidatedRanges: MarkdownSourceRange[] = []

  if (expanded && invalidateFrom !== undefined && invalidateTo !== undefined) {
    for (const node of nodes) {
      const remapped = remapThroughChange(node.rawRange, change)
      if (remapped.status === 'deleted') {
        invalidatedIds.add(node.id)
        continue
      }
      const range = remapped.range
      if (range.end > invalidateFrom && range.start < invalidateTo) {
        invalidatedIds.add(node.id)
        invalidatedRanges.push(range)
      } else if (remapped.status === 'mapped') {
        retained.push({ id: node.id, range })
      } else {
        invalidatedIds.add(node.id)
        invalidatedRanges.push(range)
      }
    }
    invalidatedRanges.push({ start: invalidateFrom, end: invalidateTo })
  } else {
    const { before, after } = neighborsOf(nodes, change)
    const local = new Set(overlapping)
    if (overlapping.length === 0) {
      reason = 'adjacent-boundary'
      if (before) local.add(before)
      if (after) local.add(after)
    }

    for (const node of nodes) {
      const remapped = remapThroughChange(node.rawRange, change)
      if (local.has(node) || remapped.status !== 'mapped') {
        invalidatedIds.add(node.id)
        if (remapped.status !== 'deleted') invalidatedRanges.push(remapped.range)
        else invalidatedRanges.push(node.rawRange)
      } else {
        retained.push({ id: node.id, range: remapped.range })
      }
    }
  }

  const taskId =
    input.taskId ??
    `task:${input.identity.id}:${input.identity.epoch}:${input.revision}`

  return Object.freeze({
    documentIdentity: Object.freeze({
      id: input.identity.id,
      epoch: input.identity.epoch,
    }),
    revision: input.revision,
    taskId,
    reason,
    expanded,
    invalidatedRanges: Object.freeze(mergeRanges(invalidatedRanges)),
    invalidatedNodeIds: Object.freeze(
      nodes.filter((node) => invalidatedIds.has(node.id)).map((node) => node.id),
    ),
    retainedNodeIds: Object.freeze(retained.map((node) => node.id)),
    retained: Object.freeze(
      retained.map((node) =>
        Object.freeze({
          id: node.id,
          range: Object.freeze({ start: node.range.start, end: node.range.end }),
        }),
      ),
    ),
    budget: Object.freeze({
      scannedBytes,
      examinedNodes,
    }),
  })
}

export const createMarkdownProjectionTask = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly taskId: string
}): MarkdownProjectionTask => {
  assertIdentity(input.documentIdentity)
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    throw new MarkdownRuntimeError('protocol', 'projection task requires a source revision')
  }
  if (!input.taskId) {
    throw new MarkdownRuntimeError('protocol', 'projection task requires a task identity')
  }

  let aborted = false
  const documentIdentity = Object.freeze({
    id: input.documentIdentity.id,
    epoch: input.documentIdentity.epoch,
  })

  return Object.freeze({
    taskId: input.taskId,
    revision: input.revision,
    documentIdentity,
    get aborted() {
      return aborted
    },
    abort() {
      aborted = true
    },
    commit(current, value) {
      if (aborted) return { ok: false as const, reason: 'aborted' as const }
      if (!sameIdentity(current.documentIdentity, documentIdentity)) {
        return { ok: false as const, reason: 'document-switch' as const }
      }
      if (current.revision !== input.revision) {
        return { ok: false as const, reason: 'stale-revision' as const }
      }
      return { ok: true as const, value }
    },
  })
}

export interface MarkdownProjectionSession {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly currentTask: MarkdownProjectionTask | null
  plan(
    previous: MarkdownStableProjection,
    previousSource: string,
    change: MarkdownProjectionChange,
  ): MarkdownProjectionInvalidationPlan
  begin(plan: MarkdownProjectionInvalidationPlan): MarkdownProjectionTask
}

export const createMarkdownProjectionSession = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision?: number
}): MarkdownProjectionSession => {
  assertIdentity(input.documentIdentity)
  const documentIdentity = Object.freeze({
    id: input.documentIdentity.id,
    epoch: input.documentIdentity.epoch,
  })
  let revision = input.revision ?? 0
  if (!Number.isInteger(revision) || revision < 0) {
    throw new MarkdownRuntimeError('protocol', 'projection session requires a source revision')
  }
  let currentTask: MarkdownProjectionTask | null = null

  return {
    get documentIdentity() {
      return documentIdentity
    },
    get revision() {
      return revision
    },
    get currentTask() {
      return currentTask
    },
    plan(previous, previousSource, change) {
      currentTask?.abort()
      revision += 1
      return planMarkdownProjectionInvalidation({
        identity: documentIdentity,
        revision,
        previousSource,
        change,
        previous,
      })
    },
    begin(plan) {
      if (!sameIdentity(plan.documentIdentity, documentIdentity)) {
        throw new MarkdownRuntimeError(
          'protocol',
          'projection task document does not match the session',
        )
      }
      currentTask?.abort()
      currentTask = createMarkdownProjectionTask({
        documentIdentity,
        revision: plan.revision,
        taskId: plan.taskId,
      })
      return currentTask
    },
  }
}
