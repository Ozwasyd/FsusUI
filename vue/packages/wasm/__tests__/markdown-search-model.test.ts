import { describe, expect, it } from 'vitest'

import {
  evaluateMarkdownSearchModelMutations,
  isMarkdownSearchMatchCurrent,
  searchMarkdownRawSource,
} from '../markdown-search-model'

const identity = {
  documentId: 'doc-a',
  documentEpoch: 3,
  revision: 8,
}

describe('markdown raw source search model', () => {
  it('matches plain, case-sensitive, whole-word, and unicode queries on raw UTF-16 ranges', () => {
    const source = '\uFEFFHello café cafe\r\nword\n'
    const plain = searchMarkdownRawSource({
      ...identity,
      source,
      query: { text: 'CAFÉ', mode: 'plain', queryVersion: 1 },
    })
    expect(plain.ok).toBe(true)
    if (!plain.ok) return
    expect(plain.matches).toHaveLength(1)
    expect(source.slice(plain.matches[0]!.range.start, plain.matches[0]!.range.end)).toBe(
      'café',
    )
    const sensitive = searchMarkdownRawSource({
      ...identity,
      source,
      query: { text: 'Hello', mode: 'plain-case', queryVersion: 1 },
    })
    expect(sensitive.ok && sensitive.matches).toHaveLength(1)
    const whole = searchMarkdownRawSource({
      ...identity,
      source: 'word wording word',
      query: { text: 'word', mode: 'whole-word', queryVersion: 2 },
    })
    expect(whole.ok && whole.matches).toHaveLength(2)
    const bomCr = searchMarkdownRawSource({
      ...identity,
      source,
      query: { text: 'Hello', mode: 'plain-case', queryVersion: 1 },
    })
    expect(bomCr.ok && bomCr.matches[0]?.range.start).toBe(1)
  })

  it('rejects empty queries and zero-length regex, and keeps documents distinct', () => {
    expect(
      searchMarkdownRawSource({
        ...identity,
        source: 'abc',
        query: { text: '', mode: 'plain', queryVersion: 1 },
      }).ok,
    ).toBe(false)
    expect(
      searchMarkdownRawSource({
        ...identity,
        source: 'abc',
        query: { text: '(?=a)', mode: 'regex', queryVersion: 1 },
      }),
    ).toEqual({ ok: false, code: 'zero-length-regex' })
    const first = searchMarkdownRawSource({
      ...identity,
      source: 'Alpha',
      query: { text: 'Alpha', mode: 'plain', queryVersion: 1 },
    })
    expect(first.ok && first.matches[0]).toBeTruthy()
    if (!first.ok) return
    expect(
      isMarkdownSearchMatchCurrent(first.matches[0]!, {
        documentId: identity.documentId,
        documentEpoch: 9,
        revision: identity.revision,
        queryVersion: 1,
      }),
    ).toBe(false)
    expect(
      isMarkdownSearchMatchCurrent(first.matches[0]!, {
        ...identity,
        queryVersion: 1,
      }),
    ).toBe(true)
  })

  it('kills DOM search, normalized offsets, neighbor fallback, and epoch reuse', () => {
    const report = evaluateMarkdownSearchModelMutations('cafe\u0301 and café')
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
    }
    expect(report.mutations.some((mutation) => mutation.kind === 'epoch-reuse')).toBe(
      true,
    )
  })
})
