import { describe, expect, it } from 'vitest'

import {
  applyMarkdownUrlValidation,
  classifyMarkdownUrl,
  evaluateMarkdownUrlMutations,
  validateMarkdownUrl,
} from '../markdown-runtime'

const identity = {
  documentEpoch: 1,
  revision: 4,
  nodeId: 'syn:link:1',
  value: '',
  version: 1,
}

describe('markdown URL validation authority', () => {
  it('classifies relative, hash, internal, external, and blocked schemes the same for editor and renderer', () => {
    const cases = [
      ['/docs', 'valid-relative'],
      ['./a.md', 'valid-relative'],
      ['#intro', 'valid-hash'],
      ['note-id', 'valid-internal'],
      ['https://example.com', 'valid-external'],
      ['mailto:a@b.test', 'valid-external'],
      ['javascript:alert(1)', 'blocked-scheme'],
      ['data:text/html,hi', 'blocked-scheme'],
      ['file:///tmp/x', 'blocked-scheme'],
      ['ftp://x', 'unsupported'],
      ['https://exa mple.com', 'invalid-syntax'],
      ['javascript\u0000:alert(1)', 'invalid-syntax'],
    ] as const
    for (const [value, state] of cases) {
      expect(classifyMarkdownUrl(value)).toBe(state)
      const result = validateMarkdownUrl(value, { ...identity, value })
      expect(result.state).toBe(state)
      expect(result.authorityVersion).toContain('markdown-url')
      if (state === 'valid-external') {
        expect(result.open.allowed).toBe(true)
        if (result.open.allowed) {
          expect(result.open.rel).toBe('noopener noreferrer')
          expect(result.open.target).toBe('_blank')
        }
      }
      if (state === 'blocked-scheme') {
        expect(result.open.allowed).toBe(false)
      }
    }
  })

  it('drops stale results when node, document, or value changes', () => {
    const value = 'https://example.com'
    const current = { ...identity, value }
    const result = validateMarkdownUrl(value, current)
    expect(applyMarkdownUrlValidation(result, current)?.state).toBe('valid-external')
    expect(
      applyMarkdownUrlValidation(result, { ...current, revision: 9 }),
    ).toBeNull()
    expect(
      applyMarkdownUrlValidation(result, { ...current, value: '/other' }),
    ).toBeNull()
  })

  it('kills https-only, unsafe open, stale commit, regex drift, and policy forks', () => {
    const value = '/docs'
    const report = evaluateMarkdownUrlMutations(value, { ...identity, value })
    expect(report.authority.state).toBe('valid-relative')
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
