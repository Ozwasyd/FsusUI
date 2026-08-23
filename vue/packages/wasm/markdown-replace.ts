import {
  isMarkdownSearchMatchCurrent,
  type MarkdownSearchMatch,
  type MarkdownSearchQuery,
} from './markdown-search-model'

export type MarkdownReplaceRejection =
  | 'stale'
  | 'composition-active'
  | 'readonly'
  | 'disabled'
  | 'preview-only'
  | 'zero-length'
  | 'overlap'
  | 'empty'

export interface MarkdownReplaceDocument {
  readonly source: string
  readonly documentId: string
  readonly documentEpoch: number
  readonly revision: number
  readonly query: MarkdownSearchQuery
  readonly composition?: boolean
  readonly readonly?: boolean
  readonly disabled?: boolean
  readonly previewOnly?: boolean
}

export interface MarkdownReplaceChange {
  readonly from: number
  readonly to: number
  readonly insert: string
}

export interface MarkdownReplacePlan {
  readonly changes: readonly MarkdownReplaceChange[]
  readonly history: 'separate'
  readonly origin: 'command'
  readonly selection: {
    readonly start: number
    readonly end: number
    readonly direction: 'none'
  }
  readonly focusReturn: 'editor'
  readonly currentIndex: number | null
  readonly remainingRanges: readonly { readonly start: number; readonly end: number }[]
}

export type MarkdownReplaceResult =
  | MarkdownReplacePlan
  | { readonly rejected: MarkdownReplaceRejection }

export const isMarkdownReplacePlan = (
  value: MarkdownReplaceResult,
): value is MarkdownReplacePlan => 'changes' in value

const reject = (code: MarkdownReplaceRejection) => Object.freeze({ rejected: code })

const gate = (document: MarkdownReplaceDocument): MarkdownReplaceRejection | undefined => {
  if (document.composition) return 'composition-active'
  if (document.readonly) return 'readonly'
  if (document.disabled) return 'disabled'
  if (document.previewOnly) return 'preview-only'
  return undefined
}

const identityOf = (document: MarkdownReplaceDocument) => ({
  documentId: document.documentId,
  documentEpoch: document.documentEpoch,
  revision: document.revision,
  queryVersion: document.query.queryVersion,
})

const rangesOverlap = (
  left: { readonly start: number; readonly end: number },
  right: { readonly start: number; readonly end: number },
) => left.start < right.end && right.start < left.end

const matchRegexAt = (source: string, start: number, end: number, pattern: string) => {
  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'gmu')
  } catch {
    return null
  }
  regex.lastIndex = start
  const match = regex.exec(source)
  if (!match || match.index !== start || match.index + match[0].length !== end) {
    return null
  }
  return match
}

const sliceMatchesQuery = (
  source: string,
  range: { readonly start: number; readonly end: number },
  query: MarkdownSearchQuery,
) => {
  const slice = source.slice(range.start, range.end)
  if (query.mode === 'regex') {
    return matchRegexAt(source, range.start, range.end, query.text) !== null
  }
  if (query.mode === 'plain-case') return slice === query.text
  return slice.toLocaleLowerCase('en-US') === query.text.toLocaleLowerCase('en-US')
}

const expandRegexReplacement = (source: string, match: RegExpExecArray, replacement: string) =>
  replacement.replace(/\$(\$|&|`|'|<([^>]+)>|(\d{1,3}))/g, (whole, token: string, name?: string, digits?: string) => {
    if (token === '$') return '$'
    if (token === '&') return match[0] ?? ''
    if (token === '`') return source.slice(0, match.index)
    if (token === "'") return source.slice(match.index + (match[0]?.length ?? 0))
    if (typeof name === 'string' && name.length > 0) {
      if (match.groups && Object.prototype.hasOwnProperty.call(match.groups, name)) {
        return match.groups[name] ?? ''
      }
      return whole
    }
    if (digits) {
      const index = Number(digits)
      if (index > 0 && index < match.length && match[index] != null) return match[index]!
      if (digits.length === 2) {
        const first = Number(digits[0])
        if (first > 0 && first < match.length && match[first] != null) {
          return `${match[first]}${digits[1]}`
        }
      }
      return whole
    }
    return whole
  })

const replacementFor = (
  source: string,
  range: { readonly start: number; readonly end: number },
  replacement: string,
  query: MarkdownSearchQuery,
) => {
  if (query.mode !== 'regex') return replacement
  const match = matchRegexAt(source, range.start, range.end, query.text)
  if (!match) return null
  return expandRegexReplacement(source, match, replacement)
}

const resolveInsert = (
  document: MarkdownReplaceDocument,
  match: MarkdownSearchMatch,
  replacement: string,
): MarkdownReplaceRejection | { readonly insert: string } => {
  if (!isMarkdownSearchMatchCurrent(match, identityOf(document))) return 'stale'
  if (match.range.start === match.range.end) return 'zero-length'
  if (match.range.start < 0 || match.range.end > document.source.length) return 'stale'
  if (!sliceMatchesQuery(document.source, match.range, document.query)) return 'stale'
  const insert = replacementFor(document.source, match.range, replacement, document.query)
  if (insert === null) return 'stale'
  return { insert }
}

const remapRanges = (
  ranges: readonly { readonly start: number; readonly end: number }[],
  from: number,
  to: number,
  insertLength: number,
) => {
  const delta = insertLength - (to - from)
  const remaining: { start: number; end: number }[] = []
  for (const range of ranges) {
    if (range.end <= from) remaining.push({ start: range.start, end: range.end })
    else if (range.start >= to) {
      remaining.push({ start: range.start + delta, end: range.end + delta })
    }
  }
  return remaining
}

const freezePlan = (plan: MarkdownReplacePlan): MarkdownReplacePlan =>
  Object.freeze({
    changes: Object.freeze(plan.changes.map((change) => Object.freeze({ ...change }))),
    history: 'separate',
    origin: 'command',
    selection: Object.freeze({ ...plan.selection }),
    focusReturn: 'editor',
    currentIndex: plan.currentIndex,
    remainingRanges: Object.freeze(plan.remainingRanges.map((range) => Object.freeze({ ...range }))),
  })

export const planMarkdownReplaceCurrent = (
  document: MarkdownReplaceDocument,
  match: MarkdownSearchMatch,
  replacement: string,
): MarkdownReplaceResult => {
  const blocked = gate(document)
  if (blocked) return reject(blocked)
  const resolved = resolveInsert(document, match, replacement)
  if (typeof resolved === 'string') return reject(resolved)
  const insert = resolved.insert
  const selectionStart = match.range.start + insert.length
  return freezePlan({
    changes: [{ from: match.range.start, to: match.range.end, insert }],
    history: 'separate',
    origin: 'command',
    selection: { start: selectionStart, end: selectionStart, direction: 'none' },
    focusReturn: 'editor',
    currentIndex: 0,
    remainingRanges: [],
  })
}

export const planMarkdownReplaceCurrentInSet = (
  document: MarkdownReplaceDocument,
  matches: readonly MarkdownSearchMatch[],
  currentIndex: number,
  replacement: string,
): MarkdownReplaceResult => {
  const current = matches[currentIndex]
  if (!current) return reject('empty')
  const planned = planMarkdownReplaceCurrent(document, current, replacement)
  if (!isMarkdownReplacePlan(planned)) return planned
  const change = planned.changes[0]!
  const survivors = matches.filter((_, index) => index !== currentIndex)
  const remaining = remapRanges(
    survivors.map((match) => match.range),
    change.from,
    change.to,
    change.insert.length,
  )
  const nextIndex = remaining.findIndex((range) => range.start >= change.from + change.insert.length)
  return freezePlan({
    ...planned,
    currentIndex: remaining.length === 0 ? null : nextIndex === -1 ? 0 : nextIndex,
    remainingRanges: remaining,
  })
}

export const planMarkdownReplaceAll = (
  document: MarkdownReplaceDocument,
  matches: readonly MarkdownSearchMatch[],
  replacement: string,
): MarkdownReplaceResult => {
  const blocked = gate(document)
  if (blocked) return reject(blocked)
  if (matches.length === 0) return reject('empty')
  const ordered = [...matches].sort((left, right) => left.range.start - right.range.start)
  for (let index = 1; index < ordered.length; index += 1) {
    if (rangesOverlap(ordered[index - 1]!.range, ordered[index]!.range)) {
      return reject('overlap')
    }
  }
  const changes: MarkdownReplaceChange[] = []
  for (const match of ordered) {
    const resolved = resolveInsert(document, match, replacement)
    if (typeof resolved === 'string') return reject(resolved)
    changes.push({ from: match.range.start, to: match.range.end, insert: resolved.insert })
  }
  let delta = 0
  let lastEnd = 0
  for (const change of changes) {
    lastEnd = change.from + delta + change.insert.length
    delta += change.insert.length - (change.to - change.from)
  }
  return freezePlan({
    changes,
    history: 'separate',
    origin: 'command',
    selection: { start: lastEnd, end: lastEnd, direction: 'none' },
    focusReturn: 'editor',
    currentIndex: null,
    remainingRanges: [],
  })
}

export const applyMarkdownReplacePlan = (source: string, plan: MarkdownReplacePlan) => {
  let next = source
  const ordered = [...plan.changes].sort((left, right) => right.from - left.from)
  for (const change of ordered) {
    next = `${next.slice(0, change.from)}${change.insert}${next.slice(change.to)}`
  }
  return next
}

export type MarkdownReplaceMutationKind =
  | 'multi-history'
  | 'neighbor-fallback'
  | 'dom-replace'
  | 'composition-mutation'

const snapshot = (
  source: string,
  query: MarkdownSearchQuery,
  extra: Partial<MarkdownReplaceDocument> = {},
): MarkdownReplaceDocument => ({
  source,
  documentId: extra.documentId ?? 'doc',
  documentEpoch: extra.documentEpoch ?? 1,
  revision: extra.revision ?? 1,
  query,
  composition: extra.composition,
  readonly: extra.readonly,
  disabled: extra.disabled,
  previewOnly: extra.previewOnly,
})

export const evaluateMarkdownReplaceMutations = (source = '# Alpha\n# Alpha\n') => {
  const query: MarkdownSearchQuery = { text: 'Alpha', mode: 'plain', queryVersion: 1 }
  const first: MarkdownSearchMatch = {
    documentId: 'doc',
    documentEpoch: 1,
    revision: 1,
    queryVersion: 1,
    range: { start: 2, end: 7 },
  }
  const second: MarkdownSearchMatch = { ...first, range: { start: 10, end: 15 } }
  const all = planMarkdownReplaceAll(snapshot(source, query), [first, second], 'Beta')
  const neighborSource = '# Gamma\nAlpha'
  const neighbor = planMarkdownReplaceCurrent(snapshot(neighborSource, query), first, 'Beta')
  const neighborApplied = isMarkdownReplacePlan(neighbor)
    ? applyMarkdownReplacePlan(neighborSource, neighbor)
    : neighborSource
  const composing = planMarkdownReplaceCurrent(
    snapshot(source, query, { composition: true }),
    first,
    'Beta',
  )
  const multiHistory =
    isMarkdownReplacePlan(all) && (all.history !== 'separate' || all.origin !== 'command')
  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'multi-history' as const,
        equivalent: multiHistory,
        accepted: false,
      }),
      Object.freeze({
        kind: 'neighbor-fallback' as const,
        equivalent: neighborApplied.includes('Beta'),
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-replace' as const,
        equivalent: isMarkdownReplacePlan(all) && all.origin !== 'command',
        accepted: false,
      }),
      Object.freeze({
        kind: 'composition-mutation' as const,
        equivalent: isMarkdownReplacePlan(composing),
        accepted: false,
      }),
    ]),
  })
}
