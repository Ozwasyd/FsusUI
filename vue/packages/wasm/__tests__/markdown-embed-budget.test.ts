import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_EMBED_BUDGET,
  commitMarkdownEmbedWalk,
  createMarkdownEmbedBudgetSession,
  detectMarkdownEmbedCycle,
  evaluateMarkdownEmbedBudget,
  evaluateMarkdownEmbedBudgetMutations,
  markdownEmbedCacheKey,
  pathContainsMarkdownEmbedCycle,
  type MarkdownEmbedWalkNode,
} from '../markdown-embed-budget'

const node = (
  targetId: string,
  extras: Partial<MarkdownEmbedWalkNode> = {},
): MarkdownEmbedWalkNode => ({
  targetId,
  targetVersion: extras.targetVersion ?? 1,
  targetToken: extras.targetToken ?? targetId,
  mode: extras.mode ?? 'article',
  bytes: extras.bytes ?? 16,
  children: extras.children,
})

describe('markdown embed budgets, cycle identity, and versioned cache', () => {
  it('fails direct and indirect cycles, depth, size, and time without stack overflow', () => {
    expect(detectMarkdownEmbedCycle({ a: ['b'], b: ['a'] }, 'a')).toBe(true)
    expect(detectMarkdownEmbedCycle({ a: ['b'], b: [] }, 'a')).toBe(false)
    expect(pathContainsMarkdownEmbedCycle(['note-a@1'], 'note-a@1')).toBe(true)
    expect(pathContainsMarkdownEmbedCycle(['note-a@1'], 'note-a@2')).toBe(false)

    const session = createMarkdownEmbedBudgetSession()
    const direct = session.walk({
      root: node('a', { children: [node('a')] }),
      providerVersion: 1,
    })
    expect(direct.ok).toBe(false)
    if (!direct.ok) expect(direct.failure).toBe('cycle')

    const indirect = session.walk({
      root: node('a', { children: [node('b', { children: [node('a')] })] }),
      providerVersion: 1,
    })
    expect(indirect.ok).toBe(false)
    if (!indirect.ok) expect(indirect.failure).toBe('cycle')

    const sameTokenDifferentIdentity = session.walk({
      root: node('a', {
        targetToken: 'note',
        children: [node('b', { targetToken: 'note' })],
      }),
      providerVersion: 1,
    })
    expect(sameTokenDifferentIdentity.ok).toBe(true)

    expect(evaluateMarkdownEmbedBudget({ depth: 2, nodes: 10, bytes: 100, ms: 4 }).ok).toBe(true)
    expect(evaluateMarkdownEmbedBudget({ depth: 9, nodes: 10, bytes: 100, ms: 4 }).failure).toBe(
      'depth-exceeded',
    )
    expect(evaluateMarkdownEmbedBudget({ depth: 1, nodes: 10, bytes: 9_999_999, ms: 1 }).failure).toBe(
      'size-exceeded',
    )
    expect(evaluateMarkdownEmbedBudget({ depth: 1, nodes: 10, bytes: 10, ms: 400 }).failure).toBe(
      'time-exceeded',
    )

    const deep = session.walk({
      root: node('d1', {
        children: [
          node('d2', {
            children: [
              node('d3', {
                children: [node('d4', { children: [node('d5')] })],
              }),
            ],
          }),
        ],
      }),
      providerVersion: 1,
    })
    expect(deep.ok).toBe(false)
    if (!deep.ok) expect(deep.failure).toBe('depth-exceeded')
  })

  it('isolates cache by identity, version, mode, provider, theme, and locale', () => {
    const session = createMarkdownEmbedBudgetSession()
    const key = {
      targetId: 'note-a',
      targetVersion: 1,
      mode: 'article' as const,
      providerVersion: 2,
      theme: 'light',
      locale: 'zh-CN',
    }
    session.setCached(key)
    expect(session.getCached(key)).toBe('note-a@1')
    expect(session.getCached({ ...key, targetVersion: 2 })).toBeUndefined()
    expect(session.getCached({ ...key, mode: 'heading' })).toBeUndefined()
    expect(session.getCached({ ...key, providerVersion: 3 })).toBeUndefined()
    expect(session.getCached({ ...key, theme: 'dark' })).toBeUndefined()
    expect(session.getCached({ ...key, locale: 'en' })).toBeUndefined()
    expect(markdownEmbedCacheKey(key)).not.toBe('note-a')
    expect(markdownEmbedCacheKey(key)).not.toBe(key.targetId)
  })

  it('cancels stale recursion trees and stays bounded at 1000 embeds', () => {
    const session = createMarkdownEmbedBudgetSession()
    const task = session.createTask('doc', 1)
    session.abortDocument('doc', 1)
    const cancelled = session.walk({
      root: node('a'),
      providerVersion: 1,
      task,
    })
    expect(cancelled.ok).toBe(false)
    if (!cancelled.ok) expect(cancelled.failure).toBe('cancelled')

    const stale = commitMarkdownEmbedWalk(
      { documentId: 'doc', documentEpoch: 2 },
      {
        ok: true,
        nodes: 1,
        bytes: 8,
        ms: 0,
        depth: 1,
        identities: ['a@1'],
        documentId: 'doc',
        documentEpoch: 1,
      },
    )
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.failure).toBe('stale')

    const children = Array.from({ length: 1000 }, (_, index) => node(`n${index}`, { bytes: 4 }))
    const thousand = session.walk({
      root: node('root', { children }),
      providerVersion: 1,
    })
    expect(thousand.ok).toBe(false)
    if (!thousand.ok) expect(thousand.failure).toBe('node-exceeded')

    const within = session.walk({
      root: node('root', {
        children: Array.from({ length: MARKDOWN_EMBED_BUDGET.maxNodes - 1 }, (_, index) =>
          node(`ok${index}`, { bytes: 1 }),
        ),
      }),
      providerVersion: 1,
    })
    expect(within.ok).toBe(true)
  })

  it('kills token-only cache, missing cycle detection, unbounded recursion, and stale tree commit', () => {
    const report = evaluateMarkdownEmbedBudgetMutations()
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'token-only-cache',
      'no-cycle-detection',
      'unbounded-recursion',
      'stale-tree-commit',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
