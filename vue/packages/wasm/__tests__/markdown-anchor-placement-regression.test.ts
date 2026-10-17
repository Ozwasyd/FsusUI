import { describe, expect, it } from 'vitest'

import {
  collectMarkdownAnchorNodes,
  parseMarkdownAnchorMarker,
} from '../markdown-anchor-grammar'

// Historical #446 requires exactly one ASCII space before a line-end marker.
describe('markdown anchor exact separator placement', () => {
  it.each(['Text  ^intro', 'Text\t ^intro', 'Text\u00a0 ^intro', ' ^intro'])(
    'rejects invalid placement %j without admitting a fragment',
    (source) => {
      const markerStart = source.indexOf('^')
      expect(parseMarkdownAnchorMarker(source, 0)).toMatchObject({
        ok: false,
        code: 'anchor-placement',
        range: { start: markerStart, end: source.length },
      })
      expect(
        collectMarkdownAnchorNodes(source).filter((node) => node.ok),
      ).toEqual([])
    },
  )

  it.each([
    'Text ^intro',
    '# Heading ^intro',
    '- Item ^intro',
    '> Quote ^intro',
  ])('preserves one ASCII separator for %j', (source) => {
    expect(collectMarkdownAnchorNodes(source)[0]).toMatchObject({
      ok: true,
      id: 'intro',
      fragment: '#intro',
      placement: 'line-end',
    })
  })

  it('preserves exact BOM/CRLF marker ranges on placement refusal', () => {
    const source = '\uFEFFText  ^intro\r\n'
    expect(collectMarkdownAnchorNodes(source)[0]).toMatchObject({
      ok: false,
      code: 'anchor-placement',
      range: { start: 7, end: 13 },
    })
  })
})
