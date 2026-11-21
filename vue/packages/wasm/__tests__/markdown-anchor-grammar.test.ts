import { describe, expect, it, vi } from 'vitest'

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
    expect(fenced.some((node) => node.ok && node.id === 'code-block')).toBe(
      true,
    )

    const projection = createMarkdownEditorProjection(
      'Heading text ^heading-a\n',
    )
    const anchor = projection.nodes.find((node) => node.kind === 'anchor')
    expect(anchor).toBeTruthy()
    expect(
      projection.identity.rawSource.slice(
        anchor!.rawRange.start,
        anchor!.rawRange.end,
      ),
    ).toBe('^heading-a')
  })

  it.each([
    ['LF', '\n'],
    ['CRLF', '\r\n'],
    ['CR', '\r'],
  ])(
    'keeps raw UTF-16 anchor ranges with %s and no WebAssembly',
    (_, newline) => {
      const source = [
        '\uFEFF# Alpha 😀 ^one',
        '',
        '# Beta 👩‍💻 ^two',
        '',
        '```',
        'body ^literal',
        '```',
        '^atomic',
      ].join(newline)
      vi.stubGlobal('WebAssembly', undefined)
      try {
        const anchors = collectMarkdownAnchorNodes(source).map((node) =>
          node.ok === true
            ? { fragment: node.fragment, marker: node.ranges.marker }
            : node.code,
        )
        expect(anchors).toEqual(
          ['one', 'two', 'atomic'].map((id) => {
            const start = source.indexOf(`^${id}`)
            return {
              fragment: `#${id}`,
              marker: { start, end: start + id.length + 1 },
            }
          }),
        )
      } finally {
        vi.unstubAllGlobals()
      }
    },
  )

  it.each(['Text  ^twin', 'Text\t ^mixed', ' ^bare'])(
    'requires exactly one ASCII separator and actual source content: %s',
    (source) => {
      const result = collectMarkdownAnchorNodes(source)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        ok: false,
        code: 'anchor-placement',
        range: { start: source.indexOf('^'), end: source.length },
      })
    },
  )

  it('does not let pipe prose claim a real anchor elsewhere in the document', () => {
    const source = 'Heading ^kept\n\n| ordinary prose\n^kept'
    const result = collectMarkdownAnchorNodes(source)
    expect(
      result.map((node) => (node.ok === true ? node.fragment : node.code)),
    ).toEqual(['#kept', 'anchor-placement'])
  })

  it.each([
    '| left | right |\n| --- | --- |\n| a | b |',
    'left | right\n--- | ---\na | b',
    '| left | right |\n| --- | --- |\n| a | b |\n\n| c | d |',
  ])('accepts a marker only after the actual final table row: %s', (table) => {
    const nodes = collectMarkdownAnchorNodes(`${table}\n^table`)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      ok: true,
      fragment: '#table',
      placement: 'following-line',
    })
    const crossed = collectMarkdownAnchorNodes(`${table}\n\n^table`)
    expect(crossed).toHaveLength(1)
    expect(crossed[0]).toMatchObject({ ok: false, code: 'anchor-cross-gap' })
  })

  it('keeps only the final quote anchor and preserves an independent owner', () => {
    const source = '> First ^still-unique\n> Last ^quote\n\nOther ^still-unique'
    const nodes = collectMarkdownAnchorNodes(source)
    expect(
      nodes.map((node) => (node.ok === true ? node.fragment : node.code)),
    ).toEqual(['#quote', '#still-unique'])
  })

  it('preserves an unclosed quoted fence as code to the quote boundary', () => {
    const quoted = '> ```\n> quote code ^inside'
    expect(collectMarkdownAnchorNodes(quoted)).toEqual([])
    expect(
      collectMarkdownAnchorNodes(`${quoted}\n\nOther ^inside`).map((node) =>
        node.ok === true ? node.fragment : node.code,
      ),
    ).toEqual(['#inside'])
    expect(
      collectMarkdownAnchorNodes(`${quoted}\n> \`\`\`\n> Prose ^outside`).map(
        (node) => (node.ok === true ? node.fragment : node.code),
      ),
    ).toEqual(['#outside'])
  })

  it('does not accept a copied list continuation that renders as code', () => {
    const source = '- parent\n      - literal ^ignored\n\nOther ^ignored'
    expect(
      collectMarkdownAnchorNodes(source).map((node) =>
        node.ok === true ? node.fragment : node.code,
      ),
    ).toEqual(['anchor-placement', '#ignored'])
  })

  it('rejects invalid ids, duplicates, orphans, and aliases', () => {
    expect(collectMarkdownAnchorNodes('text ^BAD\n')[0]?.ok).toBe(false)
    expect(
      (
        collectMarkdownAnchorNodes('text ^1bad\n')[0] as
          | { code?: string }
          | undefined
      )?.code,
    ).toBe('anchor-invalid-id')
    const duplicates = collectMarkdownAnchorNodes('one ^same\n\ntwo ^same\n')
    expect(duplicates.filter((node) => node.ok)).toHaveLength(0)
    expect(
      duplicates.filter(
        (node) => 'code' in node && node.code === 'anchor-duplicate',
      ),
    ).toHaveLength(2)
    expect(
      (
        collectMarkdownAnchorNodes('^orphan\n')[0] as
          | { code?: string }
          | undefined
      )?.code,
    ).toBe('anchor-orphan')
    expect(
      collectMarkdownAnchorNodes('paragraph {#custom}\n').some(
        (node) => node.ok,
      ),
    ).toBe(false)
  })
})

describe('markdown anchor mutations', () => {
  it('kills alias, auto id, DOM post-process, first-wins, and cross-gap ownership', () => {
    const source =
      'one ^same\n\ntwo ^same\n\n{#alias}\n\n```\ncode\n```\n\n^skipped\n'
    const report = evaluateMarkdownBlockAnchorMutations(source)
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
