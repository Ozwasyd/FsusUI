import { describe, expect, it } from 'vitest'

import {
  calculateMarkdownEditorMetrics,
  defaultMarkdownEditorLocaleText,
  resolveMarkdownEditorLocaleText,
} from '../src/markdown-editor'

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
    const caret = calculateMarkdownEditorMetrics('ab\r\ncd', {
      selection: { start: 5, end: 5 },
    })
    expect(caret.caretLine).toBe(2)
    expect(caret.caretColumn).toBe(1)
    expect(caret.segmenter).toMatch(/intl|fallback/)
  })

  it('merges leftover localeText onto the default copy authority', () => {
    const resolved = resolveMarkdownEditorLocaleText({
      modes: { ...defaultMarkdownEditorLocaleText.modes, live: 'Live mode' },
      overflow: 'More',
    })
    expect(resolved.modes.live).toBe('Live mode')
    expect(resolved.modes.source).toBe(defaultMarkdownEditorLocaleText.modes.source)
    expect(resolved.overflow).toBe('More')
    expect(resolved.actions.image).toBe(defaultMarkdownEditorLocaleText.actions.image)
    expect(resolved.overflowAria(3)).toBe(defaultMarkdownEditorLocaleText.overflowAria(3))
    expect(resolved.editorAria).toBe(defaultMarkdownEditorLocaleText.editorAria)
  })
})
