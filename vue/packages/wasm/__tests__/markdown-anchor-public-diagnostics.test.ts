import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_ANCHOR_ID,
  collectMarkdownAnchorNodes,
  parseMarkdownAnchorMarker,
} from '../markdown-anchor-grammar'

describe('markdown anchor candidate diagnostics', () => {
  it.each([
    'bad_name',
    '章节',
    'a'.repeat(65),
    '__proto__',
    'ab\u0000cd',
    'ab\u202ecd',
  ])('retains invalid %j with exact BOM/CRLF marker ranges', (id) => {
    const source = `\uFEFFParagraph ^${id}\r\n`
    expect(collectMarkdownAnchorNodes(source)).toEqual([
      {
        ok: false,
        kind: 'anchor',
        code: 'anchor-invalid-id',
        message: 'anchor id must match [a-z][a-z0-9-]{0,63}',
        range: { start: source.indexOf('^'), end: source.indexOf('\r') },
      },
    ])
    expect(
      collectMarkdownAnchorNodes('```\r\ncode\r\n```\r\n^' + id + '\r\n')[0],
    ).toMatchObject({
      ok: false,
      code: 'anchor-invalid-id',
    })
  })

  it.each(['a', 'a-0', 'a'.repeat(64)])(
    'preserves valid %j grammar and raw ranges',
    (id) => {
      expect(MARKDOWN_ANCHOR_ID.test(id)).toBe(true)
      expect(parseMarkdownAnchorMarker(`Text ^${id}`, 7)).toMatchObject({
        ok: true,
        id,
        fragment: `#${id}`,
        ranges: {
          full: { start: 12, end: 13 + id.length },
          marker: { start: 12, end: 13 + id.length },
          id: { start: 13, end: 13 + id.length },
        },
      })
    },
  )

  it.each(['intro\n', 'intro\r\n', '', 'A', '1a', '-a'])(
    'denies %j without normalization',
    (id) => {
      expect(MARKDOWN_ANCHOR_ID.test(id)).toBe(false)
    },
  )

  it.each([
    'Ordinary prose with no marker',
    'Text ^bad_name continues',
    'Text^bad_name',
    'Text \t^bad_name',
    'Text \\^bad_name',
    'Text `literal ^bad_name`',
    'Text {#bad_name}',
    'Text #^bad_name',
    'Text [[bad_name]]',
    '```\ntext ^bad_name\n```',
    '$$\ntext ^bad_name\n$$',
    ':::note\ntext ^bad_name\n:::',
  ])(
    'does not turn prose, aliases, or atomic literal source into anchors: %j',
    (source) => {
      expect(collectMarkdownAnchorNodes(source)).toEqual([])
    },
  )

  it('preserves one trailing marker, duplicate, orphan, and cross-gap refusals', () => {
    expect(collectMarkdownAnchorNodes('Text ^first ^second')).toHaveLength(1)
    expect(
      collectMarkdownAnchorNodes('First ^intro\r\n\r\nSecond ^intro')[1],
    ).toMatchObject({
      ok: false,
      code: 'anchor-duplicate',
    })
    expect(collectMarkdownAnchorNodes('^intro')[0]).toMatchObject({
      ok: false,
      code: 'anchor-orphan',
    })
    expect(
      collectMarkdownAnchorNodes('```\ncode\n```\n\n^intro')[0],
    ).toMatchObject({
      ok: false,
      code: 'anchor-cross-gap',
    })
  })
})
