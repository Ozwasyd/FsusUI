import { describe, expect, it } from 'vitest'

import {
  detectMarkdownEmbedCycle,
  evaluateMarkdownEmbedBudget,
  evaluateMarkdownEmbedBudgetMutations,
} from '../markdown-embed-budget'

describe('markdown embed budgets', () => {
  it('detects cycles and enforces depth/node/time budgets', () => {
    expect(detectMarkdownEmbedCycle({ a: ['b'], b: ['a'] }, 'a')).toBe(true)
    expect(detectMarkdownEmbedCycle({ a: ['b'], b: [] }, 'a')).toBe(false)
    expect(
      evaluateMarkdownEmbedBudget({ depth: 2, nodes: 10, bytes: 100, ms: 4 }).ok,
    ).toBe(true)
    expect(
      evaluateMarkdownEmbedBudget({ depth: 9, nodes: 10, bytes: 100, ms: 4 }).ok,
    ).toBe(false)
    expect(
      evaluateMarkdownEmbedBudgetMutations().mutations.every((mutation) => !mutation.accepted),
    ).toBe(true)
  })
})
