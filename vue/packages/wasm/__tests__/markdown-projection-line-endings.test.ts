import { describe, expect, it } from 'vitest'
import {
  compareMarkdownEditorProjectionThreads,
  createMarkdownEditorProjection,
} from '../markdown-runtime'
import { normalizeMarkdownSource } from '../markdown'

describe('Markdown projection line-ending coordinates', () => {
  it.each([
    '# Alpha\rParagraph',
    '# A\r🐈',
    '\uFEFF# Alpha\r\n\rParagraph🐈\r\n',
    '# Title\r\n\r- one\r- two\n',
  ])(
    'parses the same normalized source while preserving raw coordinates: %j',
    (raw) => {
      const projection = createMarkdownEditorProjection(raw)
      const normalized = createMarkdownEditorProjection(
        normalizeMarkdownSource(raw),
      )
      const semanticNodes = (result: typeof projection) =>
        result.nodes.map((node) => ({
          kind: node.kind,
          range: node.normalizedRange,
          content: node.normalizedContentRanges,
          markers: node.normalizedMarkerRanges,
          parent: node.parentNormalizedRange,
          children: node.childNormalizedRanges,
          status: node.status,
          diagnostic: node.diagnosticCode,
        }))
      expect(semanticNodes(projection)).toEqual(semanticNodes(normalized))
      expect(projection.identity.rawSource).toBe(raw)
      expect(projection.identity.normalizedSource).toBe(
        normalizeMarkdownSource(raw),
      )
      for (const node of projection.nodes) {
        for (const range of [
          node.rawRange,
          ...node.rawContentRanges,
          ...node.rawMarkerRanges,
        ]) {
          expect(range.start).toBeGreaterThanOrEqual(0)
          expect(range.end).toBeLessThanOrEqual(raw.length)
          expect(range.end).toBeGreaterThanOrEqual(range.start)
        }
        expect(
          node.rawContentRanges.map((range) =>
            normalizeMarkdownSource(raw.slice(range.start, range.end)),
          ),
        ).toEqual(
          node.normalizedContentRanges.map((range) =>
            projection.identity.normalizedSource.slice(range.start, range.end),
          ),
        )
      }
      expect(compareMarkdownEditorProjectionThreads(raw).equivalent).toBe(true)
    },
  )

  it('keeps a lone CR outside the heading content and starts the following paragraph', () => {
    const projection = createMarkdownEditorProjection('# Alpha\rParagraph')
    expect(projection.nodes.map((node) => node.kind)).toEqual([
      'heading',
      'paragraph',
    ])
    expect(projection.nodes[0].rawContentRanges).toEqual([{ start: 2, end: 7 }])
    expect(projection.nodes[1].rawContentRanges).toEqual([
      { start: 8, end: 17 },
    ])
  })
})
