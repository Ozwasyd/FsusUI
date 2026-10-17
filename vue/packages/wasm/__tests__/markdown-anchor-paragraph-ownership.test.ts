import { describe, expect, it } from 'vitest'

import { currentMarkdownAnchors } from '../../components/markdown-editor/src/markdown-editor-anchor-commands'
import {
  collectMarkdownAnchorNodes,
  createMarkdownEditorProjection,
} from '../markdown-runtime'

// Ownership comes from the canonical parser, including its block boundaries.
describe('markdown anchor paragraph final-line ownership', () => {
  it.each([
    'text ^intro\ncontinues',
    'text ^intro\r\ncontinues',
    '\uFEFFtext ^intro\r\ncontinues',
    '\uFEFF章节🙂 ^intro\r\ncontinues',
    'text ^intro\ncontinues\n',
  ])('refuses a non-final source line in %j', (source) => {
    const start = source.indexOf('^intro')
    const range = { start, end: start + '^intro'.length }
    expect(collectMarkdownAnchorNodes(source)).toEqual([
      {
        ok: false,
        kind: 'anchor',
        code: 'anchor-placement',
        message:
          'line-end anchors must be on the final source line of their owning paragraph',
        range,
      },
    ])
    expect(currentMarkdownAnchors(source)).toEqual([])
    const projection = createMarkdownEditorProjection(source)
    expect(
      projection.nodes.filter(
        (node) => node.kind === 'anchor' && node.status === 'valid',
      ),
    ).toEqual([])
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'anchor-placement' &&
          diagnostic.rawRange.start === range.start &&
          diagnostic.rawRange.end === range.end,
      ),
    ).toBe(true)
  })

  it.each([
    'text\ncontinues ^intro',
    'text\ncontinues ^intro\n',
    '\uFEFFtext\r\ncontinues ^intro\r\n',
    '\uFEFF章节🙂\r\ncontinues ^intro\r\n',
    'text ^intro\n\ncontinues',
    'text ^intro\n# Next heading',
    'text ^intro\n- Next item',
    '- First ^intro\n- Next item',
  ])('preserves final-line and distinct-block placement in %j', (source) => {
    const start = source.indexOf('^intro')
    expect(collectMarkdownAnchorNodes(source)).toEqual([
      {
        ok: true,
        kind: 'anchor',
        id: 'intro',
        fragment: '#intro',
        placement: 'line-end',
        ranges: {
          full: { start, end: start + 6 },
          marker: { start, end: start + 6 },
          id: { start: start + 1, end: start + 6 },
        },
      },
    ])
    expect(currentMarkdownAnchors(source)).toHaveLength(1)
  })

  it('retains duplicate refusal between distinct owning paragraphs', () => {
    const nodes = collectMarkdownAnchorNodes(
      'first\nlast ^intro\r\n\r\nsecond\nlast ^intro',
    )
    expect(nodes[0]).toMatchObject({
      ok: true,
      id: 'intro',
      fragment: '#intro',
    })
    expect(nodes[1]).toMatchObject({ ok: false, code: 'anchor-duplicate' })
  })
})
