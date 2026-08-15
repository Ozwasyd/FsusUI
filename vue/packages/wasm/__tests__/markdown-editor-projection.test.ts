import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_EDITOR_PROJECTION_PARSER,
  MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS,
  MARKDOWN_RENDERER_VERSION,
  createMarkdownEditorProjection,
  createMarkdownSourceCoordinateMap,
  presentationForSyntaxKind,
  renderMarkdownFallbackWithRuntime,
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
    expect(Array.isArray(projection.nodes)).toBe(true)
    expect(Array.isArray(projection.diagnostics)).toBe(true)
    expect(projection.syntaxCoverage.parser).toBe(projection.identity.parser)
    expect(projection.syntaxCoverage.version).toBe(projection.identity.version)
    expect(projection.syntaxCoverage.kinds).toEqual(MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS)
  })

  it('maps mermaid/latex placeholders through the #321 coordinate map', () => {
    const raw = '\uFEFF```mermaid\r\nflowchart LR\r\n```\n\n\\(a^2\\)'
    const projection = createMarkdownEditorProjection(raw)
    const kinds = projection.nodes.map((node) => node.kind)
    expect(kinds).toContain('mermaid')
    expect(kinds).toContain('latex')
    for (const node of projection.nodes) {
      expect(raw.slice(node.rawRange.start, node.rawRange.end).length).toBeGreaterThan(0)
      expect(node.presentation).toBe(presentationForSyntaxKind(node.kind))
    }
  })

  it('fails closed when a required syntax kind is not registered', () => {
    expect(() => presentationForSyntaxKind('html-dom-inferred')).toThrow(
      /unregistered markdown editor projection kind/i,
    )
    expect(MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS).toContain('heading')
    expect(presentationForSyntaxKind('heading')).toBe('live-decorated')
  })
})
