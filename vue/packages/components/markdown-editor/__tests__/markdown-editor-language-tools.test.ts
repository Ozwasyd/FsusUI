import { describe, expect, it } from 'vitest'

import {
  evaluateMarkdownLanguageToolMutations,
  planMarkdownLanguageToolReplacement,
  resolveMarkdownLanguageToolCapability,
} from '../src/markdown-editor-language-tools'

describe('markdown language tool adapter', () => {
  it('emits a #268 transaction rather than a second input pipeline', () => {
    const capability = resolveMarkdownLanguageToolCapability({ spellcheck: true })
    expect(capability.spellcheck).toBe(true)
    const transaction = planMarkdownLanguageToolReplacement(0, 3, 'the')
    expect(transaction.origin).toBe('input')
    expect(transaction.changes[0]).toEqual({ from: 0, to: 3, insert: 'the' })
    const report = evaluateMarkdownLanguageToolMutations()
    expect(report.mutations.every((mutation) => mutation.accepted === false)).toBe(true)
  })
})
