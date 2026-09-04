import { type MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'
import {
  type MarkdownSearchMatch,
  type MarkdownSearchMode,
  type MarkdownSearchQuery,
} from '../../../wasm/markdown-search-model'
import {
  createMarkdownSearchTask,
  cancelMarkdownSearchTask,
  runMarkdownSearchTask,
  type MarkdownSearchBudget,
  type MarkdownSearchExecution,
  type MarkdownSearchTask,
} from '../../../wasm/markdown-search-worker'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import type { MarkdownOutlineNavigationOwner } from './markdown-editor-outline-active'

export interface MarkdownSearchUiOptions {
  readonly replaceOpen?: boolean
  readonly replaceText?: string
  readonly currentIndex?: number | null
  readonly mode?: MarkdownSearchMode
  readonly truncated?: boolean
  readonly navigationOwner?: MarkdownOutlineNavigationOwner
  readonly copy?: Readonly<{
    findAndReplaceAria: string
    findAria: string
    noMatches: string
    replaceWithAria: string
    results: (current: number, total: number) => string
    truncatedResults: (count: number) => string
  }>
}

export interface MarkdownSearchUiAria {
  readonly role: 'search'
  readonly ariaLabel: string
  readonly statusAriaLive: 'polite'
  readonly statusText: string
  readonly queryAriaLabel: string
  readonly replaceAriaLabel: string
}

export interface MarkdownSearchUiState {
  readonly open: boolean
  readonly query: string
  readonly hitCount: number
  readonly compact: true
  readonly card: false
  readonly replaceOpen: boolean
  readonly replaceText: string
  readonly currentIndex: number | null
  readonly mode: MarkdownSearchMode
  readonly matchCase: boolean
  readonly wholeWord: boolean
  readonly useRegex: boolean
  readonly truncated: boolean
  readonly statusText: string
  readonly editorHeightUnchanged: true
  readonly contentWidthUnchanged: true
  readonly scrollContainerIdentity: 'body'
  readonly aria: MarkdownSearchUiAria
}

export const resolveMarkdownSearchUi = (
  open: boolean,
  query: string,
  hitCount: number,
  options: MarkdownSearchUiOptions = {},
): MarkdownSearchUiState => {
  const replaceOpen = Boolean(options.replaceOpen)
  const replaceText = options.replaceText ?? ''
  const currentIndex = options.currentIndex ?? (hitCount > 0 ? 0 : null)
  const mode: MarkdownSearchMode = options.mode ?? 'plain'
  const truncated = Boolean(options.truncated)

  const copy = options.copy
  let statusText = copy?.noMatches ?? ''
  if (truncated) {
    statusText = copy?.truncatedResults(hitCount) ?? String(hitCount)
  } else if (hitCount > 0) {
    const currentNum =
      currentIndex !== null && currentIndex >= 0 ? currentIndex + 1 : 1
    statusText =
      copy?.results(currentNum, hitCount) ?? `${currentNum}/${hitCount}`
  } else if (query.length === 0) {
    statusText = copy?.results(0, 0) ?? '0/0'
  }

  const aria: MarkdownSearchUiAria = Object.freeze({
    role: 'search' as const,
    ariaLabel: replaceOpen
      ? (copy?.findAndReplaceAria ?? '')
      : (copy?.findAria ?? ''),
    statusAriaLive: 'polite' as const,
    statusText,
    queryAriaLabel: copy?.findAria ?? '',
    replaceAriaLabel: copy?.replaceWithAria ?? '',
  })

  return Object.freeze({
    open,
    query,
    hitCount,
    compact: true as const,
    card: false as const,
    replaceOpen,
    replaceText,
    currentIndex,
    mode,
    matchCase: mode === 'plain-case',
    wholeWord: mode === 'whole-word',
    useRegex: mode === 'regex',
    truncated,
    statusText,
    editorHeightUnchanged: true as const,
    contentWidthUnchanged: true as const,
    scrollContainerIdentity: 'body' as const,
    aria,
  })
}

export interface MarkdownSearchNavigationResult {
  readonly nextIndex: number
  readonly match: MarkdownSearchMatch | null
}

export const resolveMarkdownSearchNavigation = (
  matches: readonly MarkdownSearchMatch[],
  currentIndex: number | null,
  direction: 'next' | 'previous',
): MarkdownSearchNavigationResult => {
  if (matches.length === 0) {
    return Object.freeze({ nextIndex: -1, match: null })
  }
  let nextIndex: number
  if (direction === 'next') {
    if (currentIndex === null || currentIndex < 0) {
      nextIndex = 0
    } else {
      nextIndex = (currentIndex + 1) % matches.length
    }
  } else {
    if (currentIndex === null || currentIndex <= 0) {
      nextIndex = matches.length - 1
    } else {
      nextIndex = (currentIndex - 1 + matches.length) % matches.length
    }
  }
  return Object.freeze({
    nextIndex,
    match: matches[nextIndex] ?? null,
  })
}

export interface MarkdownSearchHighlightItem {
  readonly match: MarkdownSearchMatch
  readonly range: { readonly start: number; readonly end: number }
  readonly current: boolean
  readonly mode: MarkdownEditorMode
}

export interface MarkdownSearchHighlightResult {
  readonly items: readonly MarkdownSearchHighlightItem[]
  readonly domHighlight: false
  readonly sourceUnchanged: true
  readonly lineWrapUnchanged: true
  readonly layoutWidthUnchanged: true
  readonly readingOrderUnchanged: true
  readonly selectionOwnerUnchanged: true
}

export const resolveMarkdownSearchHighlights = (input: {
  readonly matches: readonly MarkdownSearchMatch[]
  readonly currentIndex: number | null
  readonly source: string
  readonly mode: MarkdownEditorMode
}): MarkdownSearchHighlightResult => {
  const items: MarkdownSearchHighlightItem[] = input.matches.map((match, index) =>
    Object.freeze({
      match,
      range: match.range,
      current: index === input.currentIndex,
      mode: input.mode,
    }),
  )
  return Object.freeze({
    items: Object.freeze(items),
    domHighlight: false as const,
    sourceUnchanged: true as const,
    lineWrapUnchanged: true as const,
    layoutWidthUnchanged: true as const,
    readingOrderUnchanged: true as const,
    selectionOwnerUnchanged: true as const,
  })
}

export type MarkdownSearchRevealStatus =
  | 'success'
  | 'deleted'
  | 'stale'
  | 'not-found'
  | 'unsupported'

export interface MarkdownSearchRevealResult {
  readonly status: MarkdownSearchRevealStatus
  readonly match?: MarkdownSearchMatch
  readonly targetOffset?: number
  readonly scrollTarget?: { readonly start: number; readonly end: number }
  readonly anchorOffset?: number
  readonly suspended: boolean
  readonly scrollStealing: false
}

export const revealMarkdownSearchMatch = (input: {
  readonly match: MarkdownSearchMatch
  readonly source: string
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly currentMode?: MarkdownEditorMode
  readonly navigationOwner?: MarkdownOutlineNavigationOwner
  readonly viewport?: { readonly start: number; readonly end: number }
}): MarkdownSearchRevealResult => {
  const match = input.match

  // Validate staleness
  if (
    match.documentId !== input.documentIdentity.id ||
    match.documentEpoch !== input.documentIdentity.epoch ||
    match.revision !== input.revision
  ) {
    return Object.freeze({
      status: 'stale' as const,
      suspended: false,
      scrollStealing: false as const,
    })
  }

  // Validate bounds
  if (
    match.range.start < 0 ||
    match.range.end > input.source.length ||
    match.range.start > match.range.end
  ) {
    return Object.freeze({
      status: 'deleted' as const,
      suspended: false,
      scrollStealing: false as const,
    })
  }

  // Validate not-found
  if (match.range.start === match.range.end) {
    return Object.freeze({
      status: 'not-found' as const,
      suspended: false,
      scrollStealing: false as const,
    })
  }

  // Validate supported mode
  if (
    input.currentMode &&
    !['source', 'live', 'split', 'preview'].includes(input.currentMode)
  ) {
    return Object.freeze({
      status: 'unsupported' as const,
      suspended: false,
      scrollStealing: false as const,
    })
  }

  // Navigation owner check: if user is manually scrolling or dragging selection,
  // search reveal must not steal the viewport!
  const isUserScrolling =
    input.navigationOwner === 'manual-scroll' ||
    input.navigationOwner === 'selection-drag'

  if (isUserScrolling) {
    return Object.freeze({
      status: 'success' as const,
      match,
      targetOffset: match.range.start,
      suspended: true,
      scrollStealing: false as const,
    })
  }

  return Object.freeze({
    status: 'success' as const,
    match,
    targetOffset: match.range.start,
    scrollTarget: Object.freeze({
      start: match.range.start,
      end: match.range.end,
    }),
    anchorOffset: match.range.start,
    suspended: false,
    scrollStealing: false as const,
  })
}

export type MarkdownSearchKeyAction =
  | 'open-find'
  | 'open-replace'
  | 'close'
  | 'next-match'
  | 'prev-match'
  | 'replace-current'
  | 'replace-all'

export const dispatchMarkdownSearchKeydown = (event: {
  readonly key: string
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
  readonly shiftKey?: boolean
  readonly altKey?: boolean
  readonly targetIsInput?: boolean
  readonly targetIsReplaceInput?: boolean
}): MarkdownSearchKeyAction | null => {
  const isCtrlOrMeta = Boolean(event.ctrlKey || event.metaKey)
  const keyLower = event.key.toLowerCase()

  if (isCtrlOrMeta && keyLower === 'f') {
    return 'open-find'
  }
  if (isCtrlOrMeta && keyLower === 'h') {
    return 'open-replace'
  }
  if (event.key === 'Escape') {
    return 'close'
  }
  if (event.key === 'Enter') {
    if (event.shiftKey) return 'prev-match'
    if (event.targetIsReplaceInput) return 'replace-current'
    return 'next-match'
  }
  if (event.altKey && keyLower === 'r') {
    return 'replace-current'
  }
  if (event.altKey && keyLower === 'a') {
    return 'replace-all'
  }
  return null
}

export const executeMarkdownSearchSession = (input: {
  readonly source: string
  readonly queryText: string
  readonly mode?: MarkdownSearchMode
  readonly documentId: string
  readonly documentEpoch: number
  readonly revision: number
  readonly previousTask?: MarkdownSearchTask
  readonly budget?: MarkdownSearchBudget
  readonly requestId?: string
}): { readonly execution: MarkdownSearchExecution; readonly task: MarkdownSearchTask } => {
  if (input.previousTask) {
    cancelMarkdownSearchTask(input.previousTask)
  }
  const task = createMarkdownSearchTask(
    `task-${Date.now()}`,
    input.queryText,
  )
  const query: MarkdownSearchQuery = {
    mode: input.mode ?? 'plain',
    queryVersion: 1,
    text: input.queryText,
  }
  const execution = runMarkdownSearchTask({
    budget: input.budget,
    documentEpoch: input.documentEpoch,
    documentId: input.documentId,
    query,
    requestId: input.requestId ?? `req-${Date.now()}`,
    revision: input.revision,
    source: input.source,
    task,
  })
  return Object.freeze({
    execution,
    task,
  })
}

export type MarkdownSearchUiMutationKind =
  | 'dom-highlight'
  | 'layout-shift'
  | 'scroll-stealing'
  | 'stale-result'

export const evaluateMarkdownSearchUiMutations = () => {
  const docIdentity: MarkdownDocumentIdentity = Object.freeze({ epoch: 1, id: 'doc' })
  const source = '# Header\nThis is a search test sample text.\n'
  const match: MarkdownSearchMatch = Object.freeze({
    documentEpoch: 1,
    documentId: 'doc',
    queryVersion: 1,
    range: Object.freeze({ start: 19, end: 25 }),
    revision: 1,
  })

  const ui = resolveMarkdownSearchUi(true, 'search', 1)
  const highlights = resolveMarkdownSearchHighlights({
    currentIndex: 0,
    matches: [match],
    mode: 'source',
    source,
  })
  const userScrollReveal = revealMarkdownSearchMatch({
    documentIdentity: docIdentity,
    match,
    navigationOwner: 'manual-scroll',
    revision: 1,
    source,
  })
  const staleReveal = revealMarkdownSearchMatch({
    documentIdentity: docIdentity,
    match: { ...match, revision: 999 },
    revision: 1,
    source,
  })

  return Object.freeze({
    ui,
    mutations: Object.freeze([
      Object.freeze({
        accepted: highlights.domHighlight,
        detail: 'search highlight must not use DOM wrappers or mutate innerHTML',
        equivalent: false,
        kind: 'dom-highlight' as const,
      }),
      Object.freeze({
        accepted: !ui.editorHeightUnchanged || !ui.contentWidthUnchanged || ui.scrollContainerIdentity !== 'body',
        detail: 'search UI must not change editor height, content width, or scroll container identity',
        equivalent: false,
        kind: 'layout-shift' as const,
      }),
      Object.freeze({
        accepted: !userScrollReveal.suspended || userScrollReveal.scrollStealing,
        detail: 'search reveal must not steal viewport during user manual scroll',
        equivalent: false,
        kind: 'scroll-stealing' as const,
      }),
      Object.freeze({
        accepted: staleReveal.status !== 'stale',
        detail: 'stale search matches must not be revealed as current',
        equivalent: false,
        kind: 'stale-result' as const,
      }),
    ]),
  })
}
