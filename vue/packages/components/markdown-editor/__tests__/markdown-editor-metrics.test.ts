import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

import { createMarkdownSourceCoordinateMap } from '../../../wasm/markdown-runtime'
import {
  calculateMarkdownEditorMetrics,
  createMarkdownEditorMetricsSession,
  evaluateMarkdownEditorMetricsMutations,
} from '../src/markdown-editor-metrics'

describe('markdown editor locale-aware source metrics', () => {
  it('distinguishes code units, graphemes, tokens, and UTF-8 bytes for Latin, CJK, and emoji', () => {
    const latin = calculateMarkdownEditorMetrics('hello world', { includeBytes: true, locale: 'en' })
    expect(latin.codeUnitLength).toBe(11)
    expect(latin.graphemeCount).toBe(11)
    expect(latin.wordCount).toBe(2)
    expect(latin.byteCount).toBe(11)

    const cjk = calculateMarkdownEditorMetrics('你好世界', { locale: 'zh-CN', segmenter: 'fallback' })
    expect(cjk.graphemeCount).toBe(4)
    expect(cjk.tokenCount).toBe(4)
    expect(cjk.segmenter).toBe('fallback')
    expect(cjk.tokenCount).not.toBe('你好世界'.trim().split(/\s+/).length)

    const family = '👨‍👩‍👧‍👦'
    const emoji = calculateMarkdownEditorMetrics(family)
    expect(emoji.graphemeCount).toBe(1)
    expect(emoji.codeUnitLength).toBeGreaterThan(emoji.graphemeCount)
  })

  it('keeps BOM/CRLF line-column on the raw source map, not a normalized LF offset', () => {
    const source = '\uFEFFab\r\ncd'
    const metrics = calculateMarkdownEditorMetrics(source, {
      selection: { start: 5, end: 5 },
    })
    const mapped = createMarkdownSourceCoordinateMap(source).toRawLineColumn(5)
    expect(metrics.caretLine).toBe(mapped.line)
    expect(metrics.caretColumn).toBe(mapped.column)
    expect(metrics.lineCount).toBe(2)

    const backward = calculateMarkdownEditorMetrics('ab\r\ncd', {
      selection: { start: 0, end: 5, direction: 'backward' },
    })
    const forward = calculateMarkdownEditorMetrics('ab\r\ncd', {
      selection: { start: 0, end: 5, direction: 'forward' },
    })
    expect(backward.selectionLength).toBe(5)
    expect(forward.caretLine).not.toBe(backward.caretLine)
    expect(forward.graphemeSelectionLength).toBeGreaterThan(0)
  })

  it('documents Segmenter fallback and incrementally updates a 100k source', () => {
    const fallback = calculateMarkdownEditorMetrics('สวัสดี', { locale: 'th', segmenter: 'fallback' })
    expect(fallback.segmenter).toBe('fallback')
    expect(fallback.tokenCount).toBeGreaterThan(1)

    const session = createMarkdownEditorMetricsSession({ locale: 'en' })
    const large = `${'word '.repeat(20_000)}end`
    const full = session.calculate(large)
    expect(full.scannedCodeUnits).toBe(large.length)
    const next = `${large}!`
    const incremental = session.calculate(next, {
      change: { from: large.length, to: large.length, insert: '!' },
      selection: { start: next.length, end: next.length },
    })
    expect(incremental.scannedCodeUnits).toBeLessThan(64)
    expect(incremental.codeUnitLength).toBe(next.length)
  })

  it('bounds a middle edit in a 100k no-space CJK source', () => {
    const source = '你'.repeat(100_000)
    const session = createMarkdownEditorMetricsSession({ locale: 'zh-CN' })
    session.calculate(source)
    const next = `${source.slice(0, 50_000)}好${source.slice(50_000)}`
    const incremental = session.calculate(next, {
      change: { from: 50_000, insert: '好', to: 50_000 },
    })
    const full = calculateMarkdownEditorMetrics(next, { locale: 'zh-CN' })

    expect(incremental.scannedCodeUnits).toBeLessThan(1_024)
    expect({ ...incremental, scannedCodeUnits: 0 }).toEqual({
      ...full,
      scannedCodeUnits: 0,
    })
  })

  it('matches a full calculation across word, Unicode, newline, byte, and selection boundaries', () => {
    const options = { includeBytes: true, locale: 'en' }
    const session = createMarkdownEditorMetricsSession(options)
    let source = 'alpha beta\r\nemoji 👨‍👩‍👧‍👦\nlast'
    session.calculate(source, options)
    const changes = [
      { from: 5, to: 6, insert: '' },
      { from: 5, to: 5, insert: ' ' },
      { from: 10, to: 12, insert: '\n' },
      { from: 0, to: 0, insert: '😀 ' },
    ]
    for (const change of changes) {
      const next = `${source.slice(0, change.from)}${change.insert}${source.slice(change.to)}`
      const selection = {
        start: Math.min(2, next.length),
        end: next.length,
        direction: 'backward' as const,
      }
      const incremental = session.calculate(next, { ...options, change, selection })
      const full = calculateMarkdownEditorMetrics(next, { ...options, selection })
      expect({ ...incremental, scannedCodeUnits: 0 }).toEqual({
        ...full,
        scannedCodeUnits: 0,
      })
      source = next
    }

    const unchanged = session.calculate(source, {
      ...options,
      change: { from: 0, to: 0, insert: '' },
      selection: { start: 0, end: 0 },
    })
    expect(unchanged.scannedCodeUnits).toBe(0)
    expect(unchanged.caretLine).toBe(1)
  })

  it('keeps the incremental branch free of whole-source reconstruction or line rescans', () => {
    const implementation = readFileSync(
      'vue/packages/components/markdown-editor/src/markdown-editor-metrics.ts',
      'utf8',
    )
    const incrementalStart = implementation.indexOf(
      'const mode = segmenterMode(merged)',
    )
    const incrementalBranch = implementation.slice(
      incrementalStart,
      implementation.indexOf(
        'return metrics\n  }\n\n  return {',
        incrementalStart,
      ),
    )
    expect(incrementalBranch).not.toContain('lineStartsInRaw(next)')
    expect(incrementalBranch).not.toContain('source.slice(0, change.from)')
    expect(incrementalBranch).not.toContain('source.slice(change.to)')
    expect(incrementalBranch).toContain('updateLineStarts')
  })

  it('kills whitespace-only words, normalized offsets, code-unit characters, and full rescan', () => {
    const report = evaluateMarkdownEditorMetricsMutations('你好世界')
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'whitespace-only-words',
      'normalized-offset',
      'code-unit-character',
      'full-rescan',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
