import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS,
  collectMarkdownEmbedNodes,
  createMarkdownEditorProjection,
  createMarkdownSourceCoordinateMap,
  evaluateMarkdownEmbedMutations,
  formatMarkdownEmbedDirective,
  parseMarkdownEmbedLine,
  planMarkdownEmbedEdit,
  planMarkdownEmbedInsert,
  planMarkdownEmbedRemove,
  presentationForSyntaxKind,
} from '../markdown-runtime'

describe('markdown embed directive grammar', () => {
  it('accepts only the public target-then-mode grammar', () => {
    const line = '::embed[target="note/a" mode="heading"]'
    const parsed = parseMarkdownEmbedLine(line)
    expect(parsed?.ok).toBe(true)
    if (!parsed?.ok) return
    expect(parsed.target).toBe('note/a')
    expect(parsed.mode).toBe('heading')
    expect(parsed.ranges.marker).toEqual({ start: 0, end: 7 })
    expect(line.slice(parsed.ranges.target.start, parsed.ranges.target.end)).toBe(
      'note/a',
    )
    expect(line.slice(parsed.ranges.mode.start, parsed.ranges.mode.end)).toBe(
      'heading',
    )
    expect(parseMarkdownEmbedLine('[[note/a]]')).toBeNull()
    expect(parseMarkdownEmbedLine('::include[target="note/a" mode="heading"]')).toBeNull()
  })

  it('rejects indent, trailing content, extra attributes, and inferred modes', () => {
    expect(parseMarkdownEmbedLine('  ::embed[target="a" mode="article"]')?.ok).toBe(
      false,
    )
    expect(parseMarkdownEmbedLine('  ::embed[target="a" mode="article"]')?.code).toBe(
      'embed-indent',
    )
    expect(
      parseMarkdownEmbedLine('::embed[target="a" mode="article"] trailing')?.code,
    ).toBe('embed-trailing-content')
    expect(
      parseMarkdownEmbedLine(
        '::embed[target="a" mode="article" style="card"]',
      )?.code,
    ).toBe('embed-unknown-attribute')
    expect(parseMarkdownEmbedLine('::embed[mode="article" target="a"]')?.code).toBe(
      'embed-attribute-order',
    )
    expect(parseMarkdownEmbedLine('::embed[target="a"]')?.code).toBe(
      'embed-missing-mode',
    )
    expect(parseMarkdownEmbedLine('::embed[target="a" mode="Article"]')?.code).toBe(
      'embed-inferred-mode',
    )
    expect(parseMarkdownEmbedLine('::embed[target="a" mode="card"]')?.code).toBe(
      'embed-invalid-mode',
    )
    expect(parseMarkdownEmbedLine('::embed[target="" mode="article"]')?.code).toBe(
      'embed-empty-target',
    )
    expect(
      parseMarkdownEmbedLine('::embed[target="a\\nb" mode="article"]')?.code,
    ).toBe('embed-unknown-escape')
    expect(
      parseMarkdownEmbedLine('::embed[target="a\\x" mode="article"]')?.code,
    ).toBe('embed-unknown-escape')
    expect(
      parseMarkdownEmbedLine('::embed[target="a\u202E" mode="article"]')?.code,
    ).toBe('embed-bidi-char')
  })

  it('unescapes only backslash and quote in target', () => {
    const parsed = parseMarkdownEmbedLine(
      '::embed[target="path\\\\to\\"x" mode="block"]',
    )
    expect(parsed?.ok).toBe(true)
    if (!parsed?.ok) return
    expect(parsed.target).toBe('path\\to"x')
    expect(formatMarkdownEmbedDirective(parsed.target, parsed.mode)).toBe(
      '::embed[target="path\\\\to\\"x" mode="block"]',
    )
  })

  it('projects embed nodes through the unique parser with CRLF and BOM ranges', () => {
    const raw =
      '\uFEFFintro\r\n::embed[target="doc" mode="article"]\r\nmore\n'
    const projection = createMarkdownEditorProjection(raw)
    const coordinates = createMarkdownSourceCoordinateMap(raw)
    const embed = projection.nodes.find((node) => node.kind === 'embed')
    expect(embed).toBeTruthy()
    expect(embed?.presentation).toBe(presentationForSyntaxKind('embed'))
    expect(raw.slice(embed!.rawRange.start, embed!.rawRange.end)).toContain(
      '::embed[target="doc" mode="article"]',
    )
    expect(coordinates.toRawRange(embed!.normalizedRange)).toEqual(embed!.rawRange)
    expect(MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS).toContain('embed')
    expect(projection.syntaxCoverage.kinds).toContain('embed')
    expect(projection.nodes.filter((node) => node.kind === 'embed')).toHaveLength(1)
  })

  it('keeps malformed embed diagnostics without inventing a valid node', () => {
    const raw = '::embed[target="doc" mode="Article"]\n'
    const projection = createMarkdownEditorProjection(raw)
    expect(projection.nodes.some((node) => node.kind === 'embed')).toBe(false)
    expect(projection.nodes.some((node) => node.kind === 'malformed')).toBe(true)
    expect(projection.diagnostics.some((item) => item.code === 'embed-inferred-mode')).toBe(
      true,
    )
  })

  it('plans insert/edit/remove as source transactions without provider calls', () => {
    const source = 'hello\n'
    const insert = planMarkdownEmbedInsert(
      source,
      { start: source.length, end: source.length },
      'doc',
      'block',
    )
    const next = `${source.slice(0, insert.from)}${insert.insert}${source.slice(insert.to)}`
    const nodes = collectMarkdownEmbedNodes(next)
    const valid = nodes.find((node) => node.ok)
    expect(valid?.ok).toBe(true)
    if (!valid?.ok) return
    const edited = planMarkdownEmbedEdit(valid, 'other', 'heading')
    const editedSource = `${next.slice(0, edited.from)}${edited.insert}${next.slice(edited.to)}`
    const editedNode = collectMarkdownEmbedNodes(editedSource).find((node) => node.ok)
    expect(editedNode?.ok && editedNode.target).toBe('other')
    expect(editedNode?.ok && editedNode.mode).toBe('heading')
    if (!editedNode?.ok) return
    const removed = planMarkdownEmbedRemove(editedNode, editedSource)
    const cleared = `${editedSource.slice(0, removed.from)}${removed.insert}${editedSource.slice(removed.to)}`
    expect(collectMarkdownEmbedNodes(cleared).some((node) => node.ok)).toBe(false)
  })
})

describe('markdown embed directive mutations', () => {
  it('kills wikilink, inferred mode, extra style attributes, and consumer regex', () => {
    const source = [
      'See [[wiki-page]] for context.',
      '::embed[target="doc" mode="Article"]',
      '::embed[target="doc" mode="article" style="card"]',
      '::embed[target="doc" mode="article"]',
    ].join('\n')
    const report = evaluateMarkdownEmbedMutations(source)
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.some((node) => node.ok && node.target === 'doc')).toBe(
      true,
    )
    expect(report.authority.some((node) => node.ok && node.target.includes('wiki'))).toBe(
      false,
    )
    expect(byKind.wikilink?.equivalent).toBe(false)
    expect(byKind.wikilink?.accepted).toBe(false)
    expect(byKind['inferred-mode']?.equivalent).toBe(false)
    expect(byKind['inferred-mode']?.accepted).toBe(false)
    expect(byKind['extra-style-attr']?.equivalent).toBe(false)
    expect(byKind['extra-style-attr']?.accepted).toBe(false)
    expect(byKind['consumer-regex']?.equivalent).toBe(false)
    expect(byKind['consumer-regex']?.accepted).toBe(false)
  })
})
