import { createMarkdownSourceCoordinateMap } from '../../../wasm/markdown-runtime'

export interface MarkdownEditorMetricsOptions {
  readonly locale?: string
  readonly includeBytes?: boolean
  readonly segmenter?: 'intl' | 'fallback'
}

export interface MarkdownEditorMetricsSelection {
  readonly start: number
  readonly end: number
  readonly direction?: 'forward' | 'backward' | 'none'
}

export interface MarkdownEditorMetrics {
  readonly codeUnitLength: number
  readonly graphemeCount: number
  readonly wordCount: number
  readonly tokenCount: number
  readonly lineCount: number
  readonly caretLine: number
  readonly caretColumn: number
  readonly selectionLength: number
  readonly graphemeSelectionLength: number
  readonly byteCount?: number
  readonly segmenter: 'intl' | 'fallback'
  readonly scannedCodeUnits: number
}

export interface MarkdownEditorMetricsChange {
  readonly from: number
  readonly to: number
  readonly insert: string
}

const hasIntlSegmenter = () => typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'

const graphemeParts = (text: string, locale: string | undefined, mode: 'intl' | 'fallback') => {
  if (mode === 'intl' && hasIntlSegmenter()) {
    return [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text)].map(
      (part) => part.segment,
    )
  }
  return Array.from(text)
}

const wordParts = (text: string, locale: string | undefined, mode: 'intl' | 'fallback') => {
  if (mode === 'intl' && hasIntlSegmenter()) {
    return [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)]
      .filter((part) => part.isWordLike)
      .map((part) => part.segment)
  }
  const runs = text.match(/[\p{L}\p{N}]+/gu) ?? []
  if (runs.length <= 1 && text.length > 0 && !/\s/u.test(text)) {
    return graphemeParts(text, locale, 'fallback')
  }
  return runs
}

const caretOffset = (source: string, selection?: MarkdownEditorMetricsSelection) => {
  if (!selection) return source.length
  const start = Math.max(0, Math.min(source.length, selection.start))
  const end = Math.max(0, Math.min(source.length, selection.end))
  if (start === end) return start
  return selection.direction === 'backward' ? start : end
}

const lineStartsInRaw = (raw: string) => {
  const starts = [0]
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] === '\n') {
      starts.push(index + 1)
      continue
    }
    if (raw[index] === '\r') {
      const next = raw[index + 1] === '\n' ? index + 2 : index + 1
      starts.push(next)
      if (raw[index + 1] === '\n') index += 1
    }
  }
  return starts
}

const lineColumnAt = (starts: readonly number[], offset: number) => {
  let line = 1
  let start = 0
  for (let index = 1; index < starts.length; index += 1) {
    const nextStart = starts[index]!
    if (nextStart <= offset) {
      line = index + 1
      start = nextStart
      continue
    }
    break
  }
  return { line, column: offset - start }
}

const segmenterMode = (options: MarkdownEditorMetricsOptions): 'intl' | 'fallback' => {
  if (options.segmenter === 'fallback') return 'fallback'
  if (options.segmenter === 'intl') return hasIntlSegmenter() ? 'intl' : 'fallback'
  return hasIntlSegmenter() ? 'intl' : 'fallback'
}

const finish = (
  source: string,
  options: MarkdownEditorMetricsOptions & { readonly selection?: MarkdownEditorMetricsSelection },
  counts: {
    readonly graphemeCount: number
    readonly wordCount: number
    readonly scannedCodeUnits: number
    readonly lineStarts: readonly number[]
  },
): MarkdownEditorMetrics => {
  const mode = segmenterMode(options)
  const caret = caretOffset(source, options.selection)
  const point = lineColumnAt(counts.lineStarts, caret)
  const selectionLength = options.selection
    ? Math.abs(options.selection.end - options.selection.start)
    : 0
  const selected = options.selection
    ? source.slice(
        Math.min(options.selection.start, options.selection.end),
        Math.max(options.selection.start, options.selection.end),
      )
    : ''
  const spaceless = source.length > 0 && !/\s/u.test(source)
  const tokenCount =
    spaceless && counts.wordCount <= 1 && counts.graphemeCount > 1
      ? counts.graphemeCount
      : counts.wordCount
  return Object.freeze({
    codeUnitLength: source.length,
    graphemeCount: counts.graphemeCount,
    wordCount: counts.wordCount,
    tokenCount,
    lineCount: source.length === 0 ? 1 : counts.lineStarts.length,
    caretLine: point.line,
    caretColumn: point.column,
    selectionLength,
    graphemeSelectionLength: selected ? graphemeParts(selected, options.locale, mode).length : 0,
    segmenter: mode,
    scannedCodeUnits: counts.scannedCodeUnits,
    ...(options.includeBytes ? { byteCount: new TextEncoder().encode(source).length } : {}),
  })
}

export const calculateMarkdownEditorMetrics = (
  source: string,
  options: MarkdownEditorMetricsOptions & {
    readonly selection?: MarkdownEditorMetricsSelection
  } = {},
): MarkdownEditorMetrics => {
  const mode = segmenterMode(options)
  return finish(source, options, {
    graphemeCount: graphemeParts(source, options.locale, mode).length,
    wordCount: wordParts(source, options.locale, mode).length,
    scannedCodeUnits: source.length,
    lineStarts: lineStartsInRaw(source),
  })
}

export const createMarkdownEditorMetricsSession = (
  initial: MarkdownEditorMetricsOptions = {},
) => {
  let source = ''
  let metrics = calculateMarkdownEditorMetrics('', initial)
  let lineStarts = lineStartsInRaw('')

  const calculate = (
    next: string,
    options: MarkdownEditorMetricsOptions & {
      readonly selection?: MarkdownEditorMetricsSelection
      readonly change?: MarkdownEditorMetricsChange
    } = {},
  ) => {
    const merged = { ...initial, ...options }
    const change = options.change
    if (!change || source.length === 0 || next !== `${source.slice(0, change.from)}${change.insert}${source.slice(change.to)}`) {
      source = next
      lineStarts = lineStartsInRaw(next)
      metrics = calculateMarkdownEditorMetrics(next, merged)
      return metrics
    }
    const mode = segmenterMode(merged)
    const removed = source.slice(change.from, change.to)
    const windowStart = Math.max(0, change.from - 8)
    const windowEnd = Math.min(next.length, change.from + change.insert.length + 8)
    const scanned = next.slice(windowStart, windowEnd)
    const graphemeCount = Math.max(
      0,
      metrics.graphemeCount -
        graphemeParts(removed, merged.locale, mode).length +
        graphemeParts(change.insert, merged.locale, mode).length,
    )
    const wordCount = Math.max(
      0,
      metrics.wordCount -
        wordParts(removed, merged.locale, mode).length +
        wordParts(change.insert, merged.locale, mode).length,
    )
    source = next
    lineStarts = lineStartsInRaw(next)
    metrics = finish(next, merged, {
      graphemeCount,
      wordCount,
      scannedCodeUnits: scanned.length,
      lineStarts,
    })
    return metrics
  }

  return {
    calculate,
    current: () => metrics,
  }
}

export type MarkdownEditorMetricsMutationKind =
  | 'whitespace-only-words'
  | 'normalized-offset'
  | 'code-unit-character'
  | 'full-rescan'

export const evaluateMarkdownEditorMetricsMutations = (source = '你好世界') => {
  const authority = calculateMarkdownEditorMetrics(source, {
    locale: 'zh-CN',
    selection: { start: 0, end: 0 },
  })
  const whitespaceWords = source.trim().split(/\s+/).filter(Boolean).length
  const nfc = source.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '')
  const crlf = `\uFEFF${source.replace(/\n/g, '\r\n')}`
  const raw = calculateMarkdownEditorMetrics(crlf, {
    selection: { start: Math.min(5, crlf.length), end: Math.min(5, crlf.length) },
  })
  const folded = calculateMarkdownEditorMetrics(nfc, {
    selection: { start: Math.min(5, nfc.length), end: Math.min(5, nfc.length) },
  })
  const map = createMarkdownSourceCoordinateMap(crlf)
  const mapped = map.toRawLineColumn(Math.min(5, crlf.length))
  const family = '👨‍👩‍👧‍👦'
  const emoji = calculateMarkdownEditorMetrics(family)
  const session = createMarkdownEditorMetricsSession()
  const large = `${'word '.repeat(20_000)}end`
  session.calculate(large)
  const next = `${large}!`
  const incremental = session.calculate(next, {
    change: { from: large.length, to: large.length, insert: '!' },
  })
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'whitespace-only-words' as const,
        equivalent: authority.tokenCount === whitespaceWords && source === '你好世界',
        accepted: false,
      }),
      Object.freeze({
        kind: 'normalized-offset' as const,
        equivalent:
          raw.caretLine === folded.caretLine &&
          raw.caretColumn === folded.caretColumn &&
          (raw.caretLine !== mapped.line || raw.caretColumn !== mapped.column),
        accepted: false,
      }),
      Object.freeze({
        kind: 'code-unit-character' as const,
        equivalent: emoji.graphemeCount === family.length && family.length > 1,
        accepted: false,
      }),
      Object.freeze({
        kind: 'full-rescan' as const,
        equivalent: incremental.scannedCodeUnits === next.length,
        accepted: false,
      }),
    ]),
  })
}
