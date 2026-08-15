import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_EDITOR_PROJECTION_PARSER,
  MARKDOWN_RENDERER_VERSION,
  createMarkdownEditorProjection,
  createMarkdownSourceCoordinateMap,
} from '../markdown-runtime'

describe('markdown editor projection contract', () => {
  it('requires projection nodes, ranges, diagnostics, and syntax coverage from the sole parser', () => {
    const raw = '\uFEFF# Title\r\n\nparagraph'
    const projection = createMarkdownEditorProjection(raw)
    const coordinates = createMarkdownSourceCoordinateMap(raw)

    expect(projection.identity.parser).toBe(MARKDOWN_EDITOR_PROJECTION_PARSER)
    expect(projection.identity.rawSource).toBe(raw)
    expect(projection.identity.normalizedSource).toBe(coordinates.normalizedSource)
    expect(projection.identity.version).toBe(MARKDOWN_RENDERER_VERSION)
    expect(Array.isArray(projection.nodes)).toBe(true)
    expect(Array.isArray(projection.diagnostics)).toBe(true)
    expect(projection.syntaxCoverage.parser).toBe(projection.identity.parser)
    expect(projection.syntaxCoverage.version).toBe(projection.identity.version)
    expect(Array.isArray(projection.syntaxCoverage.kinds)).toBe(true)
  })
})
