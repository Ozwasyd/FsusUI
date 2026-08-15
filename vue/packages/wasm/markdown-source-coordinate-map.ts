import { MarkdownRuntimeError } from './markdown-runtime-error'
import { normalizeMarkdownSource } from './markdown'

export type MarkdownSourceOffset = number

export interface MarkdownSourceRange {
  readonly start: MarkdownSourceOffset
  readonly end: MarkdownSourceOffset
}

export type MarkdownSourceAffinity = 'forward' | 'backward'

export interface MarkdownSourceLineColumn {
  readonly line: number
  readonly column: number
}

export type MarkdownSourceUtf8Offset = number

export interface MarkdownSourceGraphemeBoundary {
  readonly start: MarkdownSourceOffset
  readonly end: MarkdownSourceOffset
}

export interface MarkdownSourceCoordinateMap {
  readonly rawSource: string
  readonly normalizedSource: string
  toNormalizedOffset(rawOffset: MarkdownSourceOffset): MarkdownSourceOffset
  toRawOffset(
    normalizedOffset: MarkdownSourceOffset,
    options?: { readonly affinity?: MarkdownSourceAffinity },
  ): MarkdownSourceOffset
  toNormalizedRange(rawRange: MarkdownSourceRange): MarkdownSourceRange
  toRawRange(
    normalizedRange: MarkdownSourceRange,
    options?: { readonly affinity?: MarkdownSourceAffinity },
  ): MarkdownSourceRange
  toRawLineColumn(rawOffset: MarkdownSourceOffset): MarkdownSourceLineColumn
  toRawOffsetFromLineColumn(
    lineColumn: MarkdownSourceLineColumn,
  ): MarkdownSourceOffset
  toRawUtf8Offset(rawOffset: MarkdownSourceOffset): MarkdownSourceUtf8Offset
  toRawOffsetFromUtf8(utf8Offset: MarkdownSourceUtf8Offset): MarkdownSourceOffset
  graphemeBoundaryAt(rawOffset: MarkdownSourceOffset): MarkdownSourceGraphemeBoundary
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff

const assertWellFormedUtf16 = (source: string) => {
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index)
    if (isHighSurrogate(code)) {
      const next = source.charCodeAt(index + 1)
      if (!isLowSurrogate(next)) {
        throw new MarkdownRuntimeError(
          'protocol',
          `invalid unpaired UTF-16 surrogate at offset ${index}`,
        )
      }
      index += 1
      continue
    }
    if (isLowSurrogate(code)) {
      throw new MarkdownRuntimeError(
        'protocol',
        `invalid unpaired UTF-16 surrogate at offset ${index}`,
      )
    }
  }
}

const assertIntegerOffset = (value: number, label: string, max: number) => {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new MarkdownRuntimeError(
      'protocol',
      `${label} ${String(value)} is outside the map`,
    )
  }
}

const utf8WidthAt = (source: string, index: number): number => {
  const code = source.charCodeAt(index)
  if (isHighSurrogate(code)) {
    return 4
  }
  if (code <= 0x7f) {
    return 1
  }
  if (code <= 0x7ff) {
    return 2
  }
  return 3
}

const resolveRawToNormalized = (raw: string) => {
  const rawToNormalized = new Array<number>(raw.length + 1)
  const pieces: string[] = []
  let normalizedOffset = 0
  let index = 0

  if (raw.startsWith('\uFEFF')) {
    rawToNormalized[0] = 0
    index = 1
  }

  while (index < raw.length) {
    rawToNormalized[index] = normalizedOffset
    if (raw[index] === '\r') {
      pieces.push('\n')
      if (raw[index + 1] === '\n') {
        rawToNormalized[index + 1] = normalizedOffset
        index += 2
      } else {
        index += 1
      }
      normalizedOffset += 1
      continue
    }
    pieces.push(raw[index] as string)
    index += 1
    normalizedOffset += 1
  }

  rawToNormalized[raw.length] = normalizedOffset
  return {
    rawToNormalized,
    walkedNormalized: pieces.join(''),
  }
}

const invertRawCarets = (rawToNormalized: readonly number[]) => {
  let maxNormalized = 0
  for (const offset of rawToNormalized) {
    if (offset > maxNormalized) {
      maxNormalized = offset
    }
  }
  const rawCaretsByNormalized: number[][] = Array.from(
    { length: maxNormalized + 1 },
    () => [],
  )
  for (let rawOffset = 0; rawOffset < rawToNormalized.length; rawOffset += 1) {
    rawCaretsByNormalized[rawToNormalized[rawOffset] as number]?.push(rawOffset)
  }
  return rawCaretsByNormalized
}

const buildUtf16ToUtf8 = (raw: string) => {
  const utf8AtRaw = new Array<number>(raw.length + 1)
  let utf8Offset = 0
  let index = 0
  while (index <= raw.length) {
    utf8AtRaw[index] = utf8Offset
    if (index === raw.length) {
      break
    }
    const width = utf8WidthAt(raw, index)
    utf8Offset += width
    index += isHighSurrogate(raw.charCodeAt(index)) ? 2 : 1
  }
  return utf8AtRaw
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
      if (raw[index + 1] === '\n') {
        index += 1
      }
    }
  }
  return starts
}

const graphemeSegments = (raw: string) => {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
    return [{ start: 0, end: raw.length }]
  }
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return [...segmenter.segment(raw)].map((segment) => ({
    start: segment.index,
    end: segment.index + segment.segment.length,
  }))
}

export const createMarkdownSourceCoordinateMap = (
  rawSource: string,
): MarkdownSourceCoordinateMap => {
  if (typeof rawSource !== 'string') {
    throw new MarkdownRuntimeError('protocol', 'raw source must be a string')
  }

  assertWellFormedUtf16(rawSource)

  const normalizedSource = normalizeMarkdownSource(rawSource)
  const { rawToNormalized, walkedNormalized } = resolveRawToNormalized(rawSource)
  if (walkedNormalized !== normalizedSource) {
    throw new MarkdownRuntimeError(
      'invariant',
      'coordinate map drifted from normalizeMarkdownSource',
    )
  }

  const rawCaretsByNormalized = invertRawCarets(rawToNormalized)
  const utf8AtRaw = buildUtf16ToUtf8(rawSource)
  const rawLineStarts = lineStartsInRaw(rawSource)
  const graphemes = graphemeSegments(rawSource)

  const toNormalizedOffset = (rawOffset: MarkdownSourceOffset) => {
    assertIntegerOffset(rawOffset, 'raw offset', rawSource.length)
    return rawToNormalized[rawOffset] as number
  }

  const toRawOffset = (
    normalizedOffset: MarkdownSourceOffset,
    options?: { readonly affinity?: MarkdownSourceAffinity },
  ) => {
    assertIntegerOffset(normalizedOffset, 'normalized offset', normalizedSource.length)
    const carets = rawCaretsByNormalized[normalizedOffset]
    if (!carets || carets.length === 0) {
      throw new MarkdownRuntimeError(
        'invariant',
        `normalized offset ${normalizedOffset} has no raw caret`,
      )
    }
    return options?.affinity === 'forward' ? carets[carets.length - 1]! : carets[0]!
  }

  const toNormalizedRange = (rawRange: MarkdownSourceRange): MarkdownSourceRange => {
    const start = toNormalizedOffset(rawRange.start)
    const end = toNormalizedOffset(rawRange.end)
    return start <= end ? { start, end } : { start: end, end: start }
  }

  const toRawRange = (
    normalizedRange: MarkdownSourceRange,
    options?: { readonly affinity?: MarkdownSourceAffinity },
  ): MarkdownSourceRange => {
    const start = toRawOffset(normalizedRange.start, options)
    const end = toRawOffset(normalizedRange.end, options)
    return start <= end ? { start, end } : { start: end, end: start }
  }

  const toRawLineColumn = (rawOffset: MarkdownSourceOffset): MarkdownSourceLineColumn => {
    assertIntegerOffset(rawOffset, 'raw offset', rawSource.length)
    let line = 1
    let start = 0
    for (let index = 1; index < rawLineStarts.length; index += 1) {
      const nextStart = rawLineStarts[index] as number
      if (nextStart <= rawOffset) {
        line = index + 1
        start = nextStart
        continue
      }
      break
    }
    return { line, column: rawOffset - start }
  }

  const toRawOffsetFromLineColumn = (lineColumn: MarkdownSourceLineColumn) => {
    if (!Number.isInteger(lineColumn.line) || lineColumn.line < 1) {
      throw new MarkdownRuntimeError(
        'protocol',
        `line ${String(lineColumn.line)} is outside the map`,
      )
    }
    if (!Number.isInteger(lineColumn.column) || lineColumn.column < 0) {
      throw new MarkdownRuntimeError(
        'protocol',
        `column ${String(lineColumn.column)} is outside the map`,
      )
    }
    const start = rawLineStarts[lineColumn.line - 1]
    if (start === undefined) {
      throw new MarkdownRuntimeError(
        'protocol',
        `line ${String(lineColumn.line)} is outside the map`,
      )
    }
    const next = rawLineStarts[lineColumn.line] ?? rawSource.length + 1
    const offset = start + lineColumn.column
    if (offset > rawSource.length || offset >= next) {
      throw new MarkdownRuntimeError(
        'protocol',
        `line ${lineColumn.line} column ${lineColumn.column} is outside the map`,
      )
    }
    return offset
  }

  const toRawUtf8Offset = (rawOffset: MarkdownSourceOffset) => {
    assertIntegerOffset(rawOffset, 'raw offset', rawSource.length)
    const mapped = utf8AtRaw[rawOffset]
    if (mapped === undefined) {
      throw new MarkdownRuntimeError(
        'protocol',
        `raw offset ${rawOffset} is not a UTF-16 code-unit boundary`,
      )
    }
    return mapped
  }

  const toRawOffsetFromUtf8 = (utf8Offset: MarkdownSourceUtf8Offset) => {
    if (!Number.isInteger(utf8Offset) || utf8Offset < 0) {
      throw new MarkdownRuntimeError(
        'protocol',
        `UTF-8 offset ${String(utf8Offset)} is outside the map`,
      )
    }
    for (let rawOffset = 0; rawOffset <= rawSource.length; rawOffset += 1) {
      if (utf8AtRaw[rawOffset] === utf8Offset) {
        return rawOffset
      }
    }
    throw new MarkdownRuntimeError(
      'protocol',
      `UTF-8 offset ${utf8Offset} is outside the map`,
    )
  }

  const graphemeBoundaryAt = (rawOffset: MarkdownSourceOffset) => {
    assertIntegerOffset(rawOffset, 'raw offset', rawSource.length)
    for (const segment of graphemes) {
      if (rawOffset >= segment.start && rawOffset < segment.end) {
        return segment
      }
      if (rawOffset === rawSource.length && segment.end === rawSource.length) {
        return segment
      }
    }
    return { start: rawOffset, end: rawOffset }
  }

  return Object.freeze({
    rawSource,
    normalizedSource,
    toNormalizedOffset,
    toRawOffset,
    toNormalizedRange,
    toRawRange,
    toRawLineColumn,
    toRawOffsetFromLineColumn,
    toRawUtf8Offset,
    toRawOffsetFromUtf8,
    graphemeBoundaryAt,
  })
}
