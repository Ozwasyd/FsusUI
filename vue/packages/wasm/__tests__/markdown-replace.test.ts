import { describe, expect, it } from 'vitest'

import { searchMarkdownRawSource, type MarkdownSearchQuery } from '../markdown-search-model'
import {
  applyMarkdownReplacePlan,
  evaluateMarkdownReplaceMutations,
  isMarkdownReplacePlan,
  planMarkdownReplaceAll,
  planMarkdownReplaceCurrent,
  planMarkdownReplaceCurrentInSet,
  type MarkdownReplaceDocument,
} from '../markdown-replace'

const identity = {
  documentId: 'doc-a',
  documentEpoch: 3,
  revision: 8,
}

const documentOf = (
  source: string,
  query: MarkdownSearchQuery,
  extra: Partial<MarkdownReplaceDocument> = {},
): MarkdownReplaceDocument => ({
  source,
  documentId: extra.documentId ?? identity.documentId,
  documentEpoch: extra.documentEpoch ?? identity.documentEpoch,
  revision: extra.revision ?? identity.revision,
  query,
  composition: extra.composition,
  readonly: extra.readonly,
  disabled: extra.disabled,
  previewOnly: extra.previewOnly,
})

const search = (source: string, query: MarkdownSearchQuery) => {
  const result = searchMarkdownRawSource({
    source,
    query,
    documentId: identity.documentId,
    documentEpoch: identity.documentEpoch,
    revision: identity.revision,
  })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('expected matches')
  return result.matches
}

describe('markdown replace current/all', () => {
  it('replaces current and all on one source snapshot with a single history entry', () => {
    const source = '# Alpha\n# Alpha\n'
    const query: MarkdownSearchQuery = { text: 'Alpha', mode: 'plain', queryVersion: 1 }
    const matches = search(source, query)
    const current = planMarkdownReplaceCurrent(documentOf(source, query), matches[0]!, 'Beta')
    expect(isMarkdownReplacePlan(current)).toBe(true)
    if (!isMarkdownReplacePlan(current)) return
    expect(current.history).toBe('separate')
    expect(current.origin).toBe('command')
    expect(current.focusReturn).toBe('editor')
    expect(current.selection).toEqual({ start: 6, end: 6, direction: 'none' })
    expect(applyMarkdownReplacePlan(source, current)).toBe('# Beta\n# Alpha\n')

    const all = planMarkdownReplaceAll(documentOf(source, query), matches, 'Beta')
    expect(isMarkdownReplacePlan(all)).toBe(true)
    if (!isMarkdownReplacePlan(all)) return
    expect(all.changes).toHaveLength(2)
    expect(all.history).toBe('separate')
    expect(all.currentIndex).toBeNull()
    expect(applyMarkdownReplacePlan(source, all)).toBe('# Beta\n# Beta\n')
    expect(all.selection.direction).toBe('none')
  })

  it('refuses stale document, query, revision, and neighbor-same-text fallback', () => {
    const source = '# Alpha\n'
    const query: MarkdownSearchQuery = { text: 'Alpha', mode: 'plain', queryVersion: 1 }
    const [match] = search(source, query)
    expect(match).toBeTruthy()
    const document = documentOf(source, query)
    expect(planMarkdownReplaceCurrent({ ...document, documentId: 'other' }, match!, 'Beta')).toEqual({
      rejected: 'stale',
    })
    expect(planMarkdownReplaceCurrent({ ...document, documentEpoch: 9 }, match!, 'Beta')).toEqual({
      rejected: 'stale',
    })
    expect(planMarkdownReplaceCurrent({ ...document, revision: 99 }, match!, 'Beta')).toEqual({
      rejected: 'stale',
    })
    expect(
      planMarkdownReplaceCurrent(
        { ...document, query: { ...query, queryVersion: 2 } },
        match!,
        'Beta',
      ),
    ).toEqual({ rejected: 'stale' })
    const neighbor = '# Gamma\nAlpha'
    const stale = planMarkdownReplaceCurrent(documentOf(neighbor, query), match!, 'Beta')
    expect(stale).toEqual({ rejected: 'stale' })
    expect(neighbor).toBe('# Gamma\nAlpha')
  })

  it('expands regex $&, captures, escapes, and rejects zero-length matches', () => {
    const source = 'aaabbb and keep'
    const query: MarkdownSearchQuery = { text: '(?<first>a+)(b+)', mode: 'regex', queryVersion: 1 }
    const matches = search(source, query)
    const document = documentOf(source, query)
    const captures = planMarkdownReplaceCurrent(document, matches[0]!, '$2-$1')
    expect(isMarkdownReplacePlan(captures)).toBe(true)
    if (!isMarkdownReplacePlan(captures)) return
    expect(applyMarkdownReplacePlan(source, captures)).toBe('bbb-aaa and keep')

    const named = planMarkdownReplaceCurrent(document, matches[0]!, '$<first>-$&')
    expect(isMarkdownReplacePlan(named)).toBe(true)
    if (!isMarkdownReplacePlan(named)) return
    expect(applyMarkdownReplacePlan(source, named)).toBe('aaa-aaabbb and keep')

    const escaped = planMarkdownReplaceCurrent(document, matches[0]!, '$$')
    expect(isMarkdownReplacePlan(escaped)).toBe(true)
    if (!isMarkdownReplacePlan(escaped)) return
    expect(applyMarkdownReplacePlan(source, escaped)).toBe('$ and keep')

    const literal = planMarkdownReplaceCurrent(
      documentOf(source, { text: 'aaa', mode: 'plain', queryVersion: 1 }),
      search(source, { text: 'aaa', mode: 'plain', queryVersion: 1 })[0]!,
      '$&-$1',
    )
    expect(isMarkdownReplacePlan(literal)).toBe(true)
    if (!isMarkdownReplacePlan(literal)) return
    expect(applyMarkdownReplacePlan(source, literal)).toBe('$&-$1bbb and keep')

    const zero = planMarkdownReplaceCurrent(document, { ...matches[0]!, range: { start: 3, end: 3 } }, 'x')
    expect(zero).toEqual({ rejected: 'zero-length' })
  })

  it('preserves BOM, CRLF, trailing spaces, final newline, and unedited bytes', () => {
    const source = '\uFEFFAlpha\r\nAlpha \n'
    const query: MarkdownSearchQuery = { text: 'Alpha', mode: 'plain-case', queryVersion: 1 }
    const matches = search(source, query)
    const all = planMarkdownReplaceAll(documentOf(source, query), matches, 'Beta')
    expect(isMarkdownReplacePlan(all)).toBe(true)
    if (!isMarkdownReplacePlan(all)) return
    const next = applyMarkdownReplacePlan(source, all)
    expect(next).toBe('\uFEFFBeta\r\nBeta \n')
    expect(next.startsWith('\uFEFF')).toBe(true)
    expect(next.includes('\r\n')).toBe(true)
    expect(next.endsWith(' \n')).toBe(true)

    const composed = 'café cafe\u0301'
    const nfcQuery: MarkdownSearchQuery = { text: 'café', mode: 'plain-case', queryVersion: 1 }
    const nfcMatches = search(composed, nfcQuery)
    const nfc = planMarkdownReplaceCurrent(documentOf(composed, nfcQuery), nfcMatches[0]!, 'x')
    expect(isMarkdownReplacePlan(nfc)).toBe(true)
    if (!isMarkdownReplacePlan(nfc)) return
    expect(applyMarkdownReplacePlan(composed, nfc)).toBe('x cafe\u0301')
  })

  it('blocks composition, readonly, disabled, and preview-only, and orders remaining matches', () => {
    const source = 'one two one'
    const query: MarkdownSearchQuery = { text: 'one', mode: 'plain', queryVersion: 1 }
    const matches = search(source, query)
    const document = documentOf(source, query)
    expect(planMarkdownReplaceCurrent({ ...document, composition: true }, matches[0]!, 'x')).toEqual({
      rejected: 'composition-active',
    })
    expect(planMarkdownReplaceCurrent({ ...document, readonly: true }, matches[0]!, 'x')).toEqual({
      rejected: 'readonly',
    })
    expect(planMarkdownReplaceAll({ ...document, disabled: true }, matches, 'x')).toEqual({
      rejected: 'disabled',
    })
    expect(planMarkdownReplaceAll({ ...document, previewOnly: true }, matches, 'x')).toEqual({
      rejected: 'preview-only',
    })
    const ordered = planMarkdownReplaceCurrentInSet(document, matches, 0, 'uno')
    expect(isMarkdownReplacePlan(ordered)).toBe(true)
    if (!isMarkdownReplacePlan(ordered)) return
    expect(applyMarkdownReplacePlan(source, ordered)).toBe('uno two one')
    expect(ordered.currentIndex).toBe(0)
    expect(ordered.remainingRanges).toEqual([{ start: 8, end: 11 }])
    expect(ordered.selection).toEqual({ start: 3, end: 3, direction: 'none' })
    expect(ordered.focusReturn).toBe('editor')
  })

  it('kills multi-history replace-all, neighbor fallback, DOM replace, and composition mutation', () => {
    const report = evaluateMarkdownReplaceMutations('# Alpha\n# Alpha\n')
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'multi-history',
      'neighbor-fallback',
      'dom-replace',
      'composition-mutation',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
