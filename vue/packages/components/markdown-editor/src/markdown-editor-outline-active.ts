import type { MarkdownEditorOutlineItem } from './markdown-editor-outline'

export interface MarkdownOutlineViewport {
  readonly start: number
  readonly end: number
}

export type MarkdownOutlineActiveCause =
  | 'caret'
  | 'selection'
  | 'viewport'
  | 'manual-scroll'
  | 'typing'
  | 'selection-drag'
  | 'search'
  | 'outline'
  | 'typewriter'

export type MarkdownOutlineNavigationOwner =
  | 'none'
  | 'typing'
  | 'manual-scroll'
  | 'selection-drag'
  | 'search'
  | 'outline'
  | 'typewriter'

export interface MarkdownOutlineActiveResult {
  readonly headingId: string | null
  readonly documentId: string
  readonly documentEpoch: number
  readonly revision: number
  readonly cause: MarkdownOutlineActiveCause
  readonly owner: MarkdownOutlineNavigationOwner
  readonly suspended: boolean
}

export interface MarkdownOutlineActiveInput {
  readonly items: readonly MarkdownEditorOutlineItem[]
  readonly documentId: string
  readonly documentEpoch: number
  readonly revision: number
  readonly caret?: number
  readonly selection?: {
    readonly start: number
    readonly end: number
    readonly direction?: 'forward' | 'backward' | 'none'
  }
  readonly viewport?: MarkdownOutlineViewport
  readonly cause?: MarkdownOutlineActiveCause
  readonly owner?: MarkdownOutlineNavigationOwner
  readonly previous?: MarkdownOutlineActiveResult | null
}

const sortedItems = (items: readonly MarkdownEditorOutlineItem[]) =>
  [...items].sort((left, right) => left.sourceRange.start - right.sourceRange.start)

export const headingIndexAtSourceOffset = (
  items: readonly MarkdownEditorOutlineItem[],
  offset: number,
) => {
  const ordered = sortedItems(items)
  let found = -1
  for (let index = 0; index < ordered.length; index += 1) {
    if (ordered[index]!.sourceRange.start <= offset) found = index
    else break
  }
  return found
}

export const headingAtSourceOffset = (
  items: readonly MarkdownEditorOutlineItem[],
  offset: number,
): MarkdownEditorOutlineItem | null => {
  const ordered = sortedItems(items)
  const index = headingIndexAtSourceOffset(ordered, offset)
  return index >= 0 ? ordered[index]! : null
}

export const resolveMarkdownOutlineNavigationOwner = (
  previous: MarkdownOutlineNavigationOwner | undefined,
  event: MarkdownOutlineActiveCause,
): MarkdownOutlineNavigationOwner => {
  if (event === 'typing') return 'typing'
  if (event === 'selection-drag') return 'selection-drag'
  if (event === 'manual-scroll') return 'manual-scroll'
  if (event === 'search' || event === 'outline' || event === 'typewriter') return event
  if (
    previous === 'search' ||
    previous === 'outline' ||
    previous === 'typewriter' ||
    previous === 'manual-scroll' ||
    previous === 'selection-drag' ||
    previous === 'typing'
  ) {
    return previous
  }
  return 'none'
}

const anchorOffset = (input: MarkdownOutlineActiveInput) => {
  const selection = input.selection
  if (selection && selection.start !== selection.end) {
    return selection.direction === 'backward' ? selection.end : selection.start
  }
  return input.caret
}

const offsetForOwner = (
  input: MarkdownOutlineActiveInput,
  owner: MarkdownOutlineNavigationOwner,
) => {
  if (owner === 'manual-scroll') return input.viewport?.start
  if (owner === 'selection-drag' || owner === 'none') {
    const selectionAnchor = anchorOffset(input)
    if (selectionAnchor !== undefined) return selectionAnchor
  }
  if (input.caret !== undefined) return input.caret
  if (input.viewport) return input.viewport.start
  return 0
}

const causeForOwner = (
  input: MarkdownOutlineActiveInput,
  owner: MarkdownOutlineNavigationOwner,
): MarkdownOutlineActiveCause => {
  if (owner === 'typing') return 'typing'
  if (owner === 'manual-scroll') return 'manual-scroll'
  if (owner === 'selection-drag') return 'selection-drag'
  if (owner === 'search' || owner === 'outline' || owner === 'typewriter') return owner
  if (input.selection && input.selection.start !== input.selection.end) return 'selection'
  if (input.caret !== undefined) return 'caret'
  return input.cause ?? 'viewport'
}

export const resolveMarkdownOutlineActive = (
  input: MarkdownOutlineActiveInput,
): MarkdownOutlineActiveResult => {
  const previous =
    input.previous &&
    input.previous.documentId === input.documentId &&
    input.previous.documentEpoch === input.documentEpoch
      ? input.previous
      : null
  const event = input.cause ?? (input.caret !== undefined ? 'caret' : 'viewport')
  const owner = input.owner ?? resolveMarkdownOutlineNavigationOwner(previous?.owner, event)
  const explicit =
    owner === 'search' || owner === 'outline' || owner === 'typewriter'
  if (explicit && previous?.headingId) {
    const stillThere = input.items.some((item) => item.nodeId === previous.headingId)
    if (stillThere) {
      return Object.freeze({
        headingId: previous.headingId,
        documentId: input.documentId,
        documentEpoch: input.documentEpoch,
        revision: input.revision,
        cause: owner,
        owner,
        suspended: false,
      })
    }
  }
  const offset = offsetForOwner(input, owner) ?? 0
  const heading = headingAtSourceOffset(input.items, offset)
  return Object.freeze({
    headingId: heading?.nodeId ?? null,
    documentId: input.documentId,
    documentEpoch: input.documentEpoch,
    revision: input.revision,
    cause: causeForOwner(input, owner),
    owner,
    suspended: owner === 'manual-scroll',
  })
}

export const commitMarkdownOutlineActive = (
  current: { readonly documentId: string; readonly documentEpoch: number; readonly revision: number },
  result: MarkdownOutlineActiveResult,
): MarkdownOutlineActiveResult | { readonly rejected: 'stale' } => {
  if (
    result.documentId !== current.documentId ||
    result.documentEpoch !== current.documentEpoch
  ) {
    return Object.freeze({ rejected: 'stale' as const })
  }
  return result
}

export const resolveMarkdownActiveHeading = (
  items: readonly MarkdownEditorOutlineItem[],
  viewport: MarkdownOutlineViewport,
): MarkdownEditorOutlineItem | null => {
  const active = resolveMarkdownOutlineActive({
    items,
    documentId: '',
    documentEpoch: 0,
    revision: 0,
    viewport,
    cause: 'viewport',
    owner: 'none',
  })
  return items.find((item) => item.nodeId === active.headingId) ?? null
}

export const planMarkdownOutlineReveal = (
  items: readonly MarkdownEditorOutlineItem[],
  nodeId: string,
): { readonly status: 'success' | 'not-found'; readonly range?: { readonly start: number; readonly end: number } } => {
  const item = items.find((entry) => entry.nodeId === nodeId)
  if (!item) return { status: 'not-found' }
  return { status: 'success', range: item.sourceRange }
}

export type MarkdownOutlineActiveMutationKind =
  | 'dom-active'
  | 'click-only'
  | 'text-match'
  | 'scroll-loop'

export const evaluateMarkdownOutlineActiveMutations = (
  items: readonly MarkdownEditorOutlineItem[],
  viewport: MarkdownOutlineViewport,
) => {
  const identity = { documentId: 'doc', documentEpoch: 1, revision: 4 }
  const caretInSecond =
    items[1] !== undefined
      ? resolveMarkdownOutlineActive({
          ...identity,
          items,
          caret: items[1]!.sourceRange.start + 1,
          viewport,
          cause: 'caret',
        })
      : resolveMarkdownOutlineActive({ ...identity, items, viewport, cause: 'viewport' })
  const clickOnly =
    items[0] !== undefined &&
    caretInSecond.headingId === items[0].nodeId &&
    items[1] !== undefined &&
    caretInSecond.headingId !== items[1].nodeId
  const renamed = items.map((item, index) =>
    index === 0 ? { ...item, text: 'Renamed' } : item,
  )
  const afterRename = resolveMarkdownOutlineActive({
    ...identity,
    items: renamed,
    caret: items[0]?.sourceRange.start ?? 0,
    previous: {
      headingId: items[0]?.nodeId ?? null,
      ...identity,
      cause: 'caret',
      owner: 'typing',
      suspended: false,
    },
  })
  const textMatch =
    Boolean(items[0]) &&
    afterRename.headingId !== items[0]!.nodeId &&
    afterRename.headingId ===
      renamed.find((item) => item.text === items[0]!.text)?.nodeId
  const typewriter = resolveMarkdownOutlineActive({
    ...identity,
    items,
    caret: items[0]?.sourceRange.start ?? 0,
    viewport: items[1] ? { start: items[1].sourceRange.start, end: items[1].sourceRange.end } : viewport,
    owner: 'typewriter',
    previous: {
      headingId: items[0]?.nodeId ?? null,
      ...identity,
      cause: 'typewriter',
      owner: 'typewriter',
      suspended: false,
    },
  })
  const afterViewport = resolveMarkdownOutlineActive({
    ...identity,
    items,
    caret: items[0]?.sourceRange.start ?? 0,
    viewport: items[1] ? { start: items[1].sourceRange.start, end: items[1].sourceRange.end } : viewport,
    cause: 'viewport',
    owner: 'typewriter',
    previous: typewriter,
  })
  const scrollLoop =
    typewriter.headingId !== afterViewport.headingId &&
    Boolean(items[0]) &&
    Boolean(items[1])
  const otherDoc = commitMarkdownOutlineActive(
    { documentId: 'other', documentEpoch: 1, revision: 4 },
    {
      headingId: items[0]?.nodeId ?? null,
      documentId: 'doc',
      documentEpoch: 1,
      revision: 4,
      cause: 'caret',
      owner: 'none',
      suspended: false,
    },
  )
  void otherDoc
  return Object.freeze({
    authority: resolveMarkdownActiveHeading(items, viewport),
    mutations: Object.freeze([
      Object.freeze({
        kind: 'dom-active' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'click-only' as const,
        equivalent: clickOnly,
        accepted: false,
      }),
      Object.freeze({
        kind: 'text-match' as const,
        equivalent: Boolean(textMatch),
        accepted: false,
      }),
      Object.freeze({
        kind: 'scroll-loop' as const,
        equivalent: scrollLoop,
        accepted: false,
      }),
    ]),
  })
}
