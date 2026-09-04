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
  let low = 0
  let high = starts.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (starts[middle]! <= offset) low = middle + 1
    else high = middle
  }
  const index = Math.max(0, low - 1)
  return { line: index + 1, column: offset - starts[index]! }
}

const whitespaceCount = (value: string) => value.match(/\s/gu)?.length ?? 0

const segmentWindow = (
  source: string,
  from: number,
  to: number,
) => {
  let start = from
  while (start > 0 && !/\s/u.test(source[start - 1]!)) start -= 1
  while (start > 0 && /\s/u.test(source[start - 1]!)) start -= 1
  let end = to
  while (end < source.length && !/\s/u.test(source[end]!)) end += 1
  while (end < source.length && /\s/u.test(source[end]!)) end += 1
  return { start, end }
}

const newlineEndsInRaw = (raw: string, base: number, source: string) => {
  const starts: number[] = []
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] === '\n') {
      starts.push(base + index + 1)
      continue
    }
    if (raw[index] === '\r') {
      if (
        index + 1 === raw.length &&
        source[base + index + 1] === '\n'
      ) continue
      const next = raw[index + 1] === '\n' ? index + 2 : index + 1
      starts.push(base + next)
      if (raw[index + 1] === '\n') index += 1
    }
  }
  return starts
}

const updateLineStarts = (
  previous: readonly number[],
  oldSource: string,
  nextSource: string,
  change: MarkdownEditorMetricsChange,
) => {
  const delta = change.insert.length - (change.to - change.from)
  const scanStart = Math.max(0, change.from - 1)
  const oldScanEnd = Math.min(oldSource.length, change.to + 2)
  const newScanEnd = Math.max(
    scanStart,
    Math.min(nextSource.length, oldScanEnd + delta),
  )
  const starts = [
    ...previous.filter((start) => start <= scanStart),
    ...newlineEndsInRaw(
      nextSource.slice(scanStart, newScanEnd),
      scanStart,
      nextSource,
    ),
    ...previous
      .filter((start) => start > oldScanEnd)
      .map((start) => start + delta),
  ]
  return {
    starts: starts.filter(
      (start, index) => index === 0 || start !== starts[index - 1],
    ),
    scannedCodeUnits: newScanEnd - scanStart,
  }
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
    readonly whitespaceCount: number
    readonly byteCount?: number
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
  const spaceless = source.length > 0 && counts.whitespaceCount === 0
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
    ...(options.includeBytes
      ? { byteCount: counts.byteCount ?? new TextEncoder().encode(source).length }
      : {}),
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
    whitespaceCount: whitespaceCount(source),
  })
}

export const createMarkdownEditorMetricsSession = (
  initial: MarkdownEditorMetricsOptions = {},
) => {
  let source = ''
  let metrics = calculateMarkdownEditorMetrics('', initial)
  let lineStarts = lineStartsInRaw('')
  let cachedByteCount = 0
  let cachedWhitespaceCount = 0
  let configuration = `${segmenterMode(initial)}:${initial.locale ?? ''}`

  const calculate = (
    next: string,
    options: MarkdownEditorMetricsOptions & {
      readonly selection?: MarkdownEditorMetricsSelection
      readonly change?: MarkdownEditorMetricsChange
    } = {},
  ) => {
    const merged = { ...initial, ...options }
    const change = options.change
    const nextConfiguration = `${segmenterMode(merged)}:${merged.locale ?? ''}`
    if (
      !change ||
      source.length === 0 ||
      nextConfiguration !== configuration ||
      next !== `${source.slice(0, change.from)}${change.insert}${source.slice(change.to)}`
    ) {
      source = next
      lineStarts = lineStartsInRaw(next)
      metrics = calculateMarkdownEditorMetrics(next, merged)
      cachedByteCount = new TextEncoder().encode(next).length
      cachedWhitespaceCount = whitespaceCount(next)
      configuration = nextConfiguration
      return metrics
    }
    if (next === source) {
      metrics = finish(next, merged, {
        graphemeCount: metrics.graphemeCount,
        wordCount: metrics.wordCount,
        scannedCodeUnits: 0,
        lineStarts,
        whitespaceCount: cachedWhitespaceCount,
        byteCount: cachedByteCount,
      })
      return metrics
    }
    const mode = segmenterMode(merged)
    const oldWindow = segmentWindow(source, change.from, change.to)
    const delta = change.insert.length - (change.to - change.from)
    const newWindow = {
      start: oldWindow.start,
      end: oldWindow.end + delta,
    }
    const removed = source.slice(oldWindow.start, oldWindow.end)
    const inserted = next.slice(newWindow.start, newWindow.end)
    const graphemeCount = Math.max(
      0,
      metrics.graphemeCount -
        graphemeParts(removed, merged.locale, mode).length +
        graphemeParts(inserted, merged.locale, mode).length,
    )
    const wordCount = Math.max(
      0,
        metrics.wordCount -
        wordParts(removed, merged.locale, mode).length +
        wordParts(inserted, merged.locale, mode).length,
    )
    const removedChange = source.slice(change.from, change.to)
    const byteWindowStart = Math.max(0, change.from - 1)
    const oldByteWindowEnd = Math.min(source.length, change.to + 1)
    const newByteWindowEnd = oldByteWindowEnd + delta
    const oldByteWindow = source.slice(byteWindowStart, oldByteWindowEnd)
    const newByteWindow = next.slice(byteWindowStart, newByteWindowEnd)
    cachedByteCount = Math.max(
      0,
      cachedByteCount -
        new TextEncoder().encode(oldByteWindow).length +
        new TextEncoder().encode(newByteWindow).length,
    )
    cachedWhitespaceCount = Math.max(
      0,
      cachedWhitespaceCount -
        whitespaceCount(removedChange) +
        whitespaceCount(change.insert),
    )
    const lineUpdate = updateLineStarts(lineStarts, source, next, change)
    lineStarts = lineUpdate.starts
    source = next
    metrics = finish(next, merged, {
      graphemeCount,
      wordCount,
      scannedCodeUnits:
        removed.length +
        inserted.length +
        oldByteWindow.length +
        newByteWindow.length +
        lineUpdate.scannedCodeUnits,
      lineStarts,
      whitespaceCount: cachedWhitespaceCount,
      byteCount: cachedByteCount,
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
