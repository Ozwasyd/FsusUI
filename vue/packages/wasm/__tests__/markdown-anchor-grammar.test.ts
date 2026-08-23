import { describe, expect, it } from 'vitest'

import {
  collectMarkdownAnchorNodes,
  createMarkdownEditorProjection,
  evaluateMarkdownBlockAnchorMutations,
} from '../markdown-runtime'

describe('markdown block anchor grammar', () => {
  it('maps ^id line-end and following-line placements to #id fragments', () => {
    const paragraph = collectMarkdownAnchorNodes('A paragraph ^intro\n')
    expect(paragraph[0]?.ok).toBe(true)
    if (!paragraph[0]?.ok) return
    expect(paragraph[0].id).toBe('intro')
    expect(paragraph[0].fragment).toBe('#intro')
    expect(paragraph[0].placement).toBe('line-end')

    const fenced = collectMarkdownAnchorNodes('```\ncode\n```\n^code-block\n')
    expect(fenced.some((node) => node.ok && node.id === 'code-block')).toBe(true)

    const projection = createMarkdownEditorProjection('Heading text ^heading-a\n')
    const anchor = projection.nodes.find((node) => node.kind === 'anchor')
    expect(anchor).toBeTruthy()
    expect(projection.identity.rawSource.slice(anchor!.rawRange.start, anchor!.rawRange.end)).toBe(
      '^heading-a',
    )
  })

  it('rejects invalid ids, duplicates, orphans, and aliases', () => {
    expect(collectMarkdownAnchorNodes('text ^BAD\n')[0]?.ok).toBe(false)
    expect(
      (collectMarkdownAnchorNodes('text ^1bad\n')[0] as { code?: string } | undefined)?.code,
    ).toBe('anchor-invalid-id')
    const duplicates = collectMarkdownAnchorNodes('one ^same\n\ntwo ^same\n')
    expect(duplicates.filter((node) => node.ok)).toHaveLength(1)
    expect(
      duplicates.some((node) => 'code' in node && node.code === 'anchor-duplicate'),
    ).toBe(true)
    expect(
      (collectMarkdownAnchorNodes('^orphan\n')[0] as { code?: string } | undefined)?.code,
    ).toBe('anchor-orphan')
    expect(collectMarkdownAnchorNodes('paragraph {#custom}\n').some((node) => node.ok)).toBe(
      false,
    )
  })
})

describe('markdown anchor mutations', () => {
  it('kills alias, auto id, DOM post-process, first-wins, and cross-gap ownership', () => {
    const source = 'one ^same\n\ntwo ^same\n\n{#alias}\n\n```\ncode\n```\n\n^skipped\n'
    const report = evaluateMarkdownBlockAnchorMutations(source)
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
