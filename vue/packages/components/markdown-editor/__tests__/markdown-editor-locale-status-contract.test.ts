import { describe, expect, it } from 'vitest'

import { calculateMarkdownEditorMetrics } from '../src/markdown-editor'

describe('markdown editor leftover locale/status metrics', () => {
  it('counts graphemes and locale words through Intl.Segmenter, not whitespace split', () => {
    const metrics = calculateMarkdownEditorMetrics('你好 world', { includeBytes: true })

    expect(metrics.codeUnitLength).toBe('你好 world'.length)
    expect(metrics.graphemeCount).toBeGreaterThanOrEqual(4)
    expect(metrics.wordCount).toBeGreaterThanOrEqual(2)
    expect(metrics.lineCount).toBe(1)
    expect(metrics.byteCount).toBe(new TextEncoder().encode('你好 world').length)
    expect(calculateMarkdownEditorMetrics('').lineCount).toBe(1)
    expect(calculateMarkdownEditorMetrics('a\nb\nc').lineCount).toBe(3)
  })
})
