import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_EDITOR_PROJECTION_PARSER,
  MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS,
  MARKDOWN_RENDERER_VERSION,
  createMarkdownEditorProjection,
  createMarkdownSourceCoordinateMap,
  markdownRenderIdentitiesEqual,
  presentationForSyntaxKind,
  readMarkdownRenderIdentity,
  renderMarkdownChunksWithRuntime,
  renderMarkdownFallbackWithRuntime,
  renderMarkdownHtmlWithRuntime,
  renderMarkdownResultWithRuntime,
  renderMarkdownSummaryWithRuntime,
  validateMarkdownEditorSyntaxCoverage,
} from '../markdown-runtime'
import { resolveMarkdownSourceIdentity } from '../markdown'

describe('markdown editor projection contract', () => {
  it('requires projection nodes, ranges, diagnostics, and syntax coverage from the sole parser', () => {
    const raw = '\uFEFF# Title\r\n\nparagraph'
    const projection = createMarkdownEditorProjection(raw)
    const coordinates = createMarkdownSourceCoordinateMap(raw)
    const rendered = renderMarkdownFallbackWithRuntime(raw)

    expect(projection.identity.parser).toBe(MARKDOWN_EDITOR_PROJECTION_PARSER)
    expect(projection.identity.rawSource).toBe(raw)
    expect(projection.identity.normalizedSource).toBe(coordinates.normalizedSource)
    expect(projection.identity.version).toBe(MARKDOWN_RENDERER_VERSION)
    expect(projection.identity.sourceIdentity).toBe(resolveMarkdownSourceIdentity(raw))
    expect(projection.identity.sourceIdentity).toBe(rendered.sourceIdentity)
    expect(projection.identity.version).toBe(rendered.rendererVersion)
    expect(markdownRenderIdentitiesEqual(projection, rendered)).toBe(true)
    expect(Array.isArray(projection.nodes)).toBe(true)
    expect(Array.isArray(projection.diagnostics)).toBe(true)
    expect(projection.syntaxCoverage.parser).toBe(projection.identity.parser)
    expect(projection.syntaxCoverage.version).toBe(projection.identity.version)
    expect(projection.syntaxCoverage.kinds).toEqual(MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS)
    expect(projection.nodes.map((node) => node.kind)).toEqual(['heading', 'paragraph'])
    expect(new Set(projection.nodes.map((node) => node.blockIdentity)).size).toBe(
      projection.nodes.length,
    )
    expect(
      projection.nodes.every(
        (node) =>
          node.rawContentRanges.length > 0 &&
          node.rawMarkerRanges.every(
            (range) =>
              range.start >= node.rawRange.start && range.end <= node.rawRange.end,
          ),
      ),
    ).toBe(true)
  })

  it('projects heading, paragraph, list, and table nodes from the C++ parse pass', () => {
    const raw = '\uFEFF# Title\r\n\nA paragraph.\r\n\n- one\r\n- two\r\n\n| h |\r\n| --- |\r\n| c |\n'
    const projection = createMarkdownEditorProjection(raw)
    const kinds = projection.nodes.map((node) => node.kind)
    expect(kinds).toEqual(['heading', 'paragraph', 'list', 'table'])

    const heading = projection.nodes[0]
    expect(raw.slice(heading.rawRange.start, heading.rawRange.end)).toContain('# Title')
    const paragraph = projection.nodes[1]
    expect(raw.slice(paragraph.rawRange.start, paragraph.rawRange.end)).toContain('A paragraph.')
    const list = projection.nodes[2]
    expect(raw.slice(list.rawRange.start, list.rawRange.end)).toContain('- one')
    const table = projection.nodes[3]
    expect(raw.slice(table.rawRange.start, table.rawRange.end)).toContain('| h |')
  })

  it('maps mermaid/latex blocks through the #321 coordinate map', () => {
    const raw = '\uFEFF```mermaid\r\nflowchart LR\r\n```\n\n$$\na^2\n$$'
    const projection = createMarkdownEditorProjection(raw)
    const kinds = projection.nodes.map((node) => node.kind)
    expect(kinds).toContain('mermaid')
    expect(kinds).toContain('latex')
    for (const node of projection.nodes) {
      expect(raw.slice(node.rawRange.start, node.rawRange.end).length).toBeGreaterThan(0)
      expect(node.presentation).toBe(presentationForSyntaxKind(node.kind))
    }
  })

  it('projects link, image, footnote, and malformed nodes from the C++ parse pass', () => {
    const raw =
      '\uFEFFSee [docs](https://x.test) and ![alt](img.png) and a note.[^n]\r\n\n[^n]: footnote body\n\n[broken](http://x\n'
    const projection = createMarkdownEditorProjection(raw)
    const kinds = projection.nodes.map((node) => node.kind)
    expect(kinds).toContain('paragraph')
    expect(kinds).toContain('link')
    expect(kinds).toContain('image')
    expect(kinds).toContain('footnote')
    expect(kinds).toContain('malformed')

    const link = projection.nodes.find((node) => node.kind === 'link')
    const image = projection.nodes.find((node) => node.kind === 'image')
    const footnoteRef = projection.nodes.find(
      (node) =>
        node.kind === 'footnote' &&
        raw.slice(node.rawRange.start, node.rawRange.end) === '[^n]',
    )
    const footnoteDef = projection.nodes.find(
      (node) =>
        node.kind === 'footnote' &&
        raw.slice(node.rawRange.start, node.rawRange.end).includes('[^n]:'),
    )
    const malformed = projection.nodes.find((node) => node.kind === 'malformed')
    expect(link).toBeDefined()
    expect(image).toBeDefined()
    expect(footnoteRef).toBeDefined()
    expect(footnoteDef).toBeDefined()
    expect(malformed).toBeDefined()
    expect(raw.slice(link!.rawRange.start, link!.rawRange.end)).toBe(
      '[docs](https://x.test)',
    )
    expect(raw.slice(image!.rawRange.start, image!.rawRange.end)).toBe(
      '![alt](img.png)',
    )
    expect(raw.slice(malformed!.rawRange.start, malformed!.rawRange.end)).toContain(
      '[broken](http://x',
    )
    expect(link!.presentation).toBe('live-decorated')
    expect(image!.presentation).toBe('live-atomic')
    expect(footnoteRef!.presentation).toBe('live-decorated')
    expect(malformed!.presentation).toBe('unsupported-error')

    const paragraph = projection.nodes.find(
      (node) =>
        node.kind === 'paragraph' &&
        raw.slice(node.rawRange.start, node.rawRange.end).includes('[docs]'),
    )
    expect(paragraph).toBeDefined()
    expect(link!.parentRawRange).toEqual(paragraph!.rawRange)
    expect(link!.parentNormalizedRange).toEqual(paragraph!.normalizedRange)
    expect(image!.parentRawRange).toEqual(paragraph!.rawRange)
    expect(footnoteRef!.parentRawRange).toEqual(paragraph!.rawRange)
    expect(paragraph!.childRawRanges).toEqual(
      expect.arrayContaining([link!.rawRange, image!.rawRange, footnoteRef!.rawRange]),
    )
    expect(footnoteDef!.parentRawRange).toBeNull()
    expect(footnoteDef!.childRawRanges).toEqual([])
  })

  it('keeps parent/child ranges on the parser projection, not HTML nesting', () => {
    const raw = '\uFEFF# See [docs](https://x.test)\r\n\n![alt](img.png)\n'
    const projection = createMarkdownEditorProjection(raw)
    const heading = projection.nodes.find((node) => node.kind === 'heading')
    const link = projection.nodes.find((node) => node.kind === 'link')
    const image = projection.nodes.find((node) => node.kind === 'image')
    const paragraph = projection.nodes.find((node) => node.kind === 'paragraph')
    expect(heading).toBeDefined()
    expect(link).toBeDefined()
    expect(image).toBeDefined()
    expect(paragraph).toBeDefined()
    expect(heading!.parentRawRange).toBeNull()
    expect(paragraph!.parentRawRange).toBeNull()
    expect(link!.parentRawRange).toEqual(heading!.rawRange)
    expect(image!.parentRawRange).toEqual(paragraph!.rawRange)
    expect(heading!.childRawRanges).toEqual([link!.rawRange])
    expect(paragraph!.childRawRanges).toEqual([image!.rawRange])
    expect(raw.slice(heading!.rawRange.start, heading!.rawRange.end)).toContain('# See')
    expect(raw.slice(link!.parentRawRange!.start, link!.parentRawRange!.end)).not.toMatch(
      /<h1|<p|<a /i,
    )
  })

  it('does not invent links from escaped text, code spans, or HTML indexOf', () => {
    const raw = 'Not \\[escaped](no) and `[code](no)` then [same](a) and [same](b)\n'
    const projection = createMarkdownEditorProjection(raw)
    const links = projection.nodes.filter((node) => node.kind === 'link')
    expect(links).toHaveLength(2)
    expect(raw.slice(links[0]!.rawRange.start, links[0]!.rawRange.end)).toBe(
      '[same](a)',
    )
    expect(raw.slice(links[1]!.rawRange.start, links[1]!.rawRange.end)).toBe(
      '[same](b)',
    )
    expect(links[1]!.rawRange.start).not.toBe(raw.indexOf('[same]'))
    expect(projection.nodes.some((node) => node.kind === 'link' && raw.slice(node.rawRange.start, node.rawRange.end).includes('escaped'))).toBe(
      false,
    )
    expect(projection.nodes.some((node) => node.kind === 'link' && raw.slice(node.rawRange.start, node.rawRange.end).includes('[code]'))).toBe(
      false,
    )
  })

  it('fails closed when a required syntax kind is not registered', () => {
    expect(() => presentationForSyntaxKind('html-dom-inferred')).toThrow(
      /unregistered markdown editor projection kind/i,
    )
    expect(MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS).toContain('heading')
    expect(presentationForSyntaxKind('heading')).toBe('live-decorated')
    expect(() =>
      validateMarkdownEditorSyntaxCoverage([
        ...MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS,
        'new-parser-syntax',
      ]),
    ).toThrow(/unregistered=new-parser-syntax/)
    expect(() =>
      validateMarkdownEditorSyntaxCoverage(
        MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS.filter(
          (kind) => kind !== 'malformed',
        ),
      ),
    ).toThrow(/missing=malformed/)
    expect(() =>
      validateMarkdownEditorSyntaxCoverage([
        ...MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS,
        'heading',
      ]),
    ).toThrow(/duplicate=heading/)
  })

  it('keeps complete parser-owned source, content, and marker ranges', () => {
    const raw = [
      '# Heading',
      '',
      '- [ ] task',
      '',
      '> quote',
      '',
      '[label](https://example.test)',
      '',
      '```ts',
      'const value = 1',
      '```',
      '',
      '$$',
      'x^2',
      '$$',
      '',
      '::p',
      'explicit',
      '::',
    ].join('\r\n')
    const projection = createMarkdownEditorProjection(raw)
    for (const kind of [
      'heading',
      'task',
      'quote',
      'link',
      'code',
      'latex',
      'explicit-paragraph',
    ]) {
      const node = projection.nodes.find((candidate) => candidate.kind === kind)
      expect(node, kind).toBeDefined()
      expect(node!.status).toBe('valid')
      expect(node!.rawContentRanges.length, `${kind} content`).toBeGreaterThan(0)
      expect(node!.rawMarkerRanges.length, `${kind} markers`).toBeGreaterThan(0)
      for (const range of [
        ...node!.rawContentRanges,
        ...node!.rawMarkerRanges,
      ]) {
        expect(range.start).toBeGreaterThanOrEqual(node!.rawRange.start)
        expect(range.end).toBeLessThanOrEqual(node!.rawRange.end)
        expect(raw.slice(range.start, range.end).length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps exact ranges for indented headings and inline LaTeX', () => {
    const raw = '  ### Heading ###\n\nInline \\(x + 1\\).\n'
    const projection = createMarkdownEditorProjection(raw)
    const heading = projection.nodes.find((node) => node.kind === 'heading')
    const latex = projection.nodes.find((node) => node.kind === 'latex')

    expect(heading).toBeDefined()
    expect(
      heading!.rawContentRanges.map((range) =>
        raw.slice(range.start, range.end),
      ),
    ).toEqual(['Heading'])
    expect(
      heading!.rawMarkerRanges.map((range) => raw.slice(range.start, range.end)),
    ).toEqual(['### ', ' ###'])

    expect(latex).toBeDefined()
    expect(
      latex!.rawContentRanges.map((range) => raw.slice(range.start, range.end)),
    ).toEqual(['x + 1'])
    expect(
      latex!.rawMarkerRanges.map((range) => raw.slice(range.start, range.end)),
    ).toEqual(['\\(', '\\)'])
  })

  it('classifies unclosed structures as malformed with exact raw ranges and reasons', () => {
    const fixtures = [
      { raw: '```ts\ncode', code: 'unclosed-code-fence' },
      { raw: ':::mermaid\nflowchart LR', code: 'unclosed-mermaid' },
      { raw: '$$\nx^2', code: 'unclosed-latex' },
      { raw: '::p\nparagraph', code: 'unclosed-explicit-paragraph' },
    ] as const
    for (const fixture of fixtures) {
      const projection = createMarkdownEditorProjection(fixture.raw)
      const node = projection.nodes.find((candidate) => candidate.status === 'malformed')
      expect(node, fixture.code).toBeDefined()
      expect(node!.kind).toBe('malformed')
      expect(node!.diagnosticCode).toBe(fixture.code)
      expect(node!.presentation).toBe('unsupported-error')
      expect(node!.rawRange).toEqual({ start: 0, end: fixture.raw.length })
      expect(node!.rawMarkerRanges.length).toBeGreaterThan(0)
      expect(node!.rawContentRanges.length).toBeGreaterThan(0)
      expect(projection.diagnostics).toContainEqual(
        expect.objectContaining({
          blockIdentity: node!.blockIdentity,
          code: fixture.code,
          rawRange: node!.rawRange,
        }),
      )
    }
  })

  it('matches projection identity to full WASM render payloads, not HTML', async () => {
    const raw = '\uFEFF# Title\r\n\nA paragraph with [docs](https://x.test).\n'
    const projection = createMarkdownEditorProjection(raw)
    const fallback = renderMarkdownFallbackWithRuntime(raw)
    const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }) => {
      if ('error' in result) {
        throw new Error(result.error.message)
      }
      return result.value
    }

    const html = unwrap(await renderMarkdownHtmlWithRuntime(raw))
    const summary = unwrap(await renderMarkdownSummaryWithRuntime(raw))
    const full = unwrap(await renderMarkdownResultWithRuntime(raw))
    const chunks = unwrap(await renderMarkdownChunksWithRuntime(raw))

    expect(markdownRenderIdentitiesEqual(projection, fallback)).toBe(true)
    expect(markdownRenderIdentitiesEqual(projection, html)).toBe(true)
    expect(markdownRenderIdentitiesEqual(projection, summary)).toBe(true)
    expect(markdownRenderIdentitiesEqual(projection, full)).toBe(true)
    expect(markdownRenderIdentitiesEqual(projection, chunks)).toBe(true)

    const identity = readMarkdownRenderIdentity(html)
    expect(identity.parser).toBe(MARKDOWN_EDITOR_PROJECTION_PARSER)
    expect(identity.rawSource).toBe(raw)
    expect(identity.normalizedSource).toBe(projection.identity.normalizedSource)
    expect(identity.version).toBe(MARKDOWN_RENDERER_VERSION)
    expect(identity.sourceIdentity).toBe(projection.identity.sourceIdentity)
    expect(identity.sourceIdentity).not.toBe(html.html)
    expect(markdownRenderIdentitiesEqual(html, { ...html, rawSource: 'other' })).toBe(
      false,
    )
  })
})
