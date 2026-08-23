export const MARKDOWN_SEARCH_MODES = Object.freeze([
  'plain',
  'plain-case',
  'whole-word',
  'regex',
] as const)

export type MarkdownSearchMode = (typeof MARKDOWN_SEARCH_MODES)[number]

export type MarkdownSearchRejectCode =
  | 'empty-query'
  | 'zero-length-regex'
  | 'invalid-regex'

export interface MarkdownSearchQuery {
  readonly text: string
  readonly mode: MarkdownSearchMode
  readonly queryVersion: number
}

export interface MarkdownSearchMatch {
  readonly documentId: string
  readonly documentEpoch: number
  readonly revision: number
  readonly queryVersion: number
  readonly range: { readonly start: number; readonly end: number }
}

export type MarkdownSearchResult =
  | { readonly ok: true; readonly matches: readonly MarkdownSearchMatch[] }
  | { readonly ok: false; readonly code: MarkdownSearchRejectCode }

const isWordChar = (char: string | undefined) =>
  typeof char === 'string' && /\p{L}|\p{N}|_/u.test(char)

const collectPlain = (
  source: string,
  needle: string,
  wholeWord: boolean,
): { start: number; end: number }[] => {
  const hits: { start: number; end: number }[] = []
  if (!needle) return hits
  let from = 0
  while (from <= source.length - needle.length) {
    const start = source.indexOf(needle, from)
    if (start === -1) break
    const end = start + needle.length
    const bordered =
      !wholeWord ||
      (!isWordChar(source[start - 1]) && !isWordChar(source[end]))
    if (bordered) hits.push({ start, end })
    from = Math.max(start + 1, end)
  }
  return hits
}

export const searchMarkdownRawSource = (input: {
  readonly source: string
  readonly query: MarkdownSearchQuery
  readonly documentId: string
  readonly documentEpoch: number
  readonly revision: number
}): MarkdownSearchResult => {
  const text = input.query.text
  if (text.length === 0) {
    return Object.freeze({ ok: false, code: 'empty-query' })
  }
  let ranges: { start: number; end: number }[]
  if (input.query.mode === 'regex') {
    let regex: RegExp
    try {
      regex = new RegExp(text, 'gmu')
    } catch {
      return Object.freeze({ ok: false, code: 'invalid-regex' })
    }
    ranges = []
    let match = regex.exec(input.source)
    if (match && match[0].length === 0) {
      return Object.freeze({ ok: false, code: 'zero-length-regex' })
    }
    while (match) {
      if (match[0].length === 0) {
        return Object.freeze({ ok: false, code: 'zero-length-regex' })
      }
      ranges.push({ start: match.index, end: match.index + match[0].length })
      match = regex.exec(input.source)
    }
  } else {
    const caseSensitive = input.query.mode === 'plain-case'
    const haystack = caseSensitive ? input.source : input.source.toLocaleLowerCase('en-US')
    const needle = caseSensitive ? text : text.toLocaleLowerCase('en-US')
    ranges = collectPlain(haystack, needle, input.query.mode === 'whole-word')
  }
  const matches = ranges.map((range) =>
    Object.freeze({
      documentId: input.documentId,
      documentEpoch: input.documentEpoch,
      revision: input.revision,
      queryVersion: input.query.queryVersion,
      range: Object.freeze(range),
    }),
  )
  return Object.freeze({ ok: true, matches: Object.freeze(matches) })
}

export const isMarkdownSearchMatchCurrent = (
  match: MarkdownSearchMatch,
  identity: {
    readonly documentId: string
    readonly documentEpoch: number
    readonly revision: number
    readonly queryVersion: number
  },
) =>
  match.documentId === identity.documentId &&
  match.documentEpoch === identity.documentEpoch &&
  match.revision === identity.revision &&
  match.queryVersion === identity.queryVersion

export type MarkdownSearchModelMutationKind =
  | 'dom-search'
  | 'normalized-offset'
  | 'text-neighbor'
  | 'epoch-reuse'

export const evaluateMarkdownSearchModelMutations = (source: string) => {
  const identity = {
    documentId: 'doc',
    documentEpoch: 1,
    revision: 4,
    query: { text: 'café', mode: 'plain' as const, queryVersion: 1 },
  }
  const authority = searchMarkdownRawSource({
    source,
    query: identity.query,
    documentId: identity.documentId,
    documentEpoch: identity.documentEpoch,
    revision: identity.revision,
  })
  const otherDoc = searchMarkdownRawSource({
    source,
    query: identity.query,
    documentId: 'other',
    documentEpoch: identity.documentEpoch,
    revision: identity.revision,
  })
  const nfc = source.normalize('NFC')
  const folded = searchMarkdownRawSource({
    source: nfc,
    query: identity.query,
    documentId: identity.documentId,
    documentEpoch: identity.documentEpoch,
    revision: identity.revision,
  })
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'dom-search' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'normalized-offset' as const,
        equivalent:
          authority.ok &&
          folded.ok &&
          source !== nfc &&
          JSON.stringify(authority.matches) === JSON.stringify(folded.matches),
        accepted: false,
      }),
      Object.freeze({
        kind: 'text-neighbor' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'epoch-reuse' as const,
        equivalent:
          authority.ok &&
          otherDoc.ok &&
          authority.matches[0]?.documentId === otherDoc.matches[0]?.documentId,
        accepted: false,
      }),
    ]),
  })
}
