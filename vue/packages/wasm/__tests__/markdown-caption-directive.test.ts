import { describe, expect, it } from 'vitest'

import {
  collectMarkdownCaptionNodes,
  createMarkdownEditorProjection,
  evaluateMarkdownCaptionMutations,
  parseMarkdownCaptionLine,
} from '../markdown-runtime'

describe('markdown caption directive grammar', () => {
  it('owns a caption only when it immediately follows an image', () => {
    const parsed = parseMarkdownCaptionLine('::caption[Figure one]')
    expect(parsed?.ok).toBe(true)
    if (parsed?.ok) {
      expect(parsed.text).toBe('Figure one')
      expect(parsed.ranges.full).toEqual({
        start: 0,
        end: '::caption[Figure one]'.length,
      })
    }
    const source = '![alt](img.png)\n::caption[Figure one]\n'
    const nodes = collectMarkdownCaptionNodes(source)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.ok).toBe(true)
    if (!nodes[0]?.ok) return
    expect(nodes[0].text).toBe('Figure one')
    expect(source.slice(nodes[0].mediaRange.start, nodes[0].mediaRange.end)).toBe(
      '![alt](img.png)',
    )
    const projection = createMarkdownEditorProjection(source)
    expect(projection.nodes.some((node) => node.kind === 'caption')).toBe(true)
  })

  it('rejects orphan, duplicate, cross-gap, non-media, and markup captions', () => {
    expect(collectMarkdownCaptionNodes('::caption[lonely]\n')[0]?.ok).toBe(false)
    expect(collectMarkdownCaptionNodes('hello\n::caption[no]\n')[0]?.code).toBe(
      'caption-non-media',
    )
    expect(
      collectMarkdownCaptionNodes('![a](a.png)\n\n::caption[gap]\n')[0]?.code,
    ).toBe('caption-cross-gap')
    expect(
      collectMarkdownCaptionNodes(
        '![a](a.png)\n::caption[one]\n::caption[two]\n',
      )[1]?.code,
    ).toBe('caption-duplicate')
    expect(collectMarkdownCaptionNodes('![a](a.png)\n::caption[]\n')[0]?.code).toBe(
      'caption-empty',
    )
    expect(
      collectMarkdownCaptionNodes('![a](a.png)\n::caption[**bold**]\n')[0]?.code,
    ).toBe('caption-markdown')
    expect(
      collectMarkdownCaptionNodes('![a](a.png)\n  ::caption[indented]\n')[0]?.code,
    ).toBe('caption-indent')
  })

  it('unescapes only backslash and closing bracket', () => {
    const nodes = collectMarkdownCaptionNodes(
      '![a](a.png)\n::caption[1\\] 2\\\\ 3]\n',
    )
    expect(nodes[0]?.ok && nodes[0].text).toBe('1] 2\\ 3')
  })

  it('keeps alt text independent from caption text', () => {
    const nodes = collectMarkdownCaptionNodes(
      '![alt text](img.png)\n::caption[visible caption]\n',
    )
    expect(nodes[0]?.ok && nodes[0].text).toBe('visible caption')
    expect(nodes[0]?.ok && nodes[0].text).not.toBe('alt text')
  })
})

describe('markdown caption mutations', () => {
  it('kills title-caption, alias, html, regroup, and cross-gap ownership', () => {
    const source = [
      '![alt](img.png "title")',
      '::figcaption[alias]',
      '<figcaption>html</figcaption>',
      '![ok](ok.png)',
      '',
      '::caption[skipped]',
    ].join('\n')
    const report = evaluateMarkdownCaptionMutations(source)
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
