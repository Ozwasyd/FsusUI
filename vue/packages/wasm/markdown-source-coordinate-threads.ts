import {
  createMarkdownSourceCoordinateMap,
  type MarkdownSourceCoordinateMap,
  type MarkdownSourceLineColumn,
} from './markdown-source-coordinate-map'

export type MarkdownSourceCoordinateMutationKind =
  | 'normalized-as-raw'
  | 'bom-dropped'
  | 'crlf-line-as-lf'

export interface MarkdownSourceCoordinateMutationResult {
  readonly kind: MarkdownSourceCoordinateMutationKind
  readonly equivalent: boolean
  readonly accepted: boolean
  readonly detail: string
}

export interface MarkdownSourceCoordinateSnapshot {
  readonly rawSource: string
  readonly normalizedSource: string
  readonly rawToNormalized: readonly number[]
  readonly normalizedToRawBackward: readonly number[]
  readonly normalizedToRawForward: readonly number[]
  readonly rawLineColumns: readonly MarkdownSourceLineColumn[]
  readonly rawUtf8: readonly number[]
}

export interface MarkdownSourceCoordinateThreadComparison {
  readonly equivalent: boolean
  readonly main: MarkdownSourceCoordinateSnapshot
  readonly worker: MarkdownSourceCoordinateSnapshot
}

export interface MarkdownSourceCoordinateMutationReport {
  readonly authority: MarkdownSourceCoordinateSnapshot
  readonly mutations: readonly MarkdownSourceCoordinateMutationResult[]
}

const rawUtf16Boundaries = (raw: string) => {
  const offsets: number[] = []
  let index = 0
  while (index <= raw.length) {
    offsets.push(index)
    if (index === raw.length) break
    const code = raw.charCodeAt(index)
    index += code >= 0xd800 && code <= 0xdbff ? 2 : 1
  }
  return offsets
}

const snapshotFromMap = (
  map: MarkdownSourceCoordinateMap,
): MarkdownSourceCoordinateSnapshot => {
  const rawLength = map.rawSource.length
  const normalizedLength = map.normalizedSource.length
  const utf16Boundaries = rawUtf16Boundaries(map.rawSource)
  return Object.freeze({
    rawSource: map.rawSource,
    normalizedSource: map.normalizedSource,
    rawToNormalized: Object.freeze(
      Array.from({ length: rawLength + 1 }, (_, offset) =>
        map.toNormalizedOffset(offset),
      ),
    ),
    normalizedToRawBackward: Object.freeze(
      Array.from({ length: normalizedLength + 1 }, (_, offset) =>
        map.toRawOffset(offset, { affinity: 'backward' }),
      ),
    ),
    normalizedToRawForward: Object.freeze(
      Array.from({ length: normalizedLength + 1 }, (_, offset) =>
        map.toRawOffset(offset, { affinity: 'forward' }),
      ),
    ),
    rawLineColumns: Object.freeze(
      Array.from({ length: rawLength + 1 }, (_, offset) =>
        map.toRawLineColumn(offset),
      ),
    ),
    rawUtf8: Object.freeze(
      utf16Boundaries.map((offset) => map.toRawUtf8Offset(offset)),
    ),
  })
}

const sameLineColumns = (
  left: readonly MarkdownSourceLineColumn[],
  right: readonly MarkdownSourceLineColumn[],
) =>
  left.length === right.length &&
  left.every(
    (entry, index) =>
      entry.line === right[index]?.line && entry.column === right[index]?.column,
  )

export const markdownSourceCoordinateSnapshotsEquivalent = (
  left: MarkdownSourceCoordinateSnapshot,
  right: MarkdownSourceCoordinateSnapshot,
) =>
  left.rawSource === right.rawSource &&
  left.normalizedSource === right.normalizedSource &&
  left.rawToNormalized.length === right.rawToNormalized.length &&
  left.rawToNormalized.every((value, index) => value === right.rawToNormalized[index]) &&
  left.normalizedToRawBackward.every(
    (value, index) => value === right.normalizedToRawBackward[index],
  ) &&
  left.normalizedToRawForward.every(
    (value, index) => value === right.normalizedToRawForward[index],
  ) &&
  sameLineColumns(left.rawLineColumns, right.rawLineColumns) &&
  left.rawUtf8.every((value, index) => value === right.rawUtf8[index])

export const snapshotMarkdownSourceCoordinateMap = (
  rawSource: string | MarkdownSourceCoordinateMap,
): MarkdownSourceCoordinateSnapshot =>
  snapshotFromMap(
    typeof rawSource === 'string'
      ? createMarkdownSourceCoordinateMap(rawSource)
      : rawSource,
  )

export const transferMarkdownSourceCoordinateMap = (
  rawSource: string,
): MarkdownSourceCoordinateSnapshot =>
  JSON.parse(
    JSON.stringify(snapshotMarkdownSourceCoordinateMap(rawSource)),
  ) as MarkdownSourceCoordinateSnapshot

export const createMarkdownSourceCoordinateMapOnWorker = (
  rawSource: string,
): MarkdownSourceCoordinateSnapshot =>
  transferMarkdownSourceCoordinateMap(rawSource)

export const compareMarkdownSourceCoordinateMapThreads = (
  rawSource: string,
): MarkdownSourceCoordinateThreadComparison => {
  const main = snapshotMarkdownSourceCoordinateMap(rawSource)
  const worker = createMarkdownSourceCoordinateMapOnWorker(rawSource)
  return Object.freeze({
    equivalent: markdownSourceCoordinateSnapshotsEquivalent(main, worker),
    main,
    worker,
  })
}

const identitySnapshot = (raw: string): MarkdownSourceCoordinateSnapshot =>
  Object.freeze({
    rawSource: raw,
    normalizedSource: raw,
    rawToNormalized: Object.freeze(
      Array.from({ length: raw.length + 1 }, (_, offset) => offset),
    ),
    normalizedToRawBackward: Object.freeze(
      Array.from({ length: raw.length + 1 }, (_, offset) => offset),
    ),
    normalizedToRawForward: Object.freeze(
      Array.from({ length: raw.length + 1 }, (_, offset) => offset),
    ),
    rawLineColumns: Object.freeze(
      Array.from({ length: raw.length + 1 }, (_, offset) => ({
        line: 1,
        column: offset,
      })),
    ),
    rawUtf8: Object.freeze(
      Array.from({ length: raw.length + 1 }, (_, offset) => offset),
    ),
  })

const bomDroppedSnapshot = (raw: string): MarkdownSourceCoordinateSnapshot => {
  if (!raw.startsWith('\uFEFF')) {
    return snapshotMarkdownSourceCoordinateMap(raw)
  }
  const dropped = snapshotMarkdownSourceCoordinateMap(raw.slice(1))
  return Object.freeze({
    ...dropped,
    rawSource: raw,
    rawToNormalized: Object.freeze([0, ...dropped.rawToNormalized]),
    rawLineColumns: Object.freeze([{ line: 1, column: 0 }, ...dropped.rawLineColumns]),
    rawUtf8: Object.freeze([0, ...dropped.rawUtf8]),
  })
}

const crlfLineAsLfSnapshot = (
  raw: string,
  authority: MarkdownSourceCoordinateSnapshot,
): MarkdownSourceCoordinateSnapshot => {
  const fakeColumns = authority.rawLineColumns.map((_, offset) => {
    let line = 1
    let start = 0
    for (let index = 0; index < offset; index += 1) {
      if (raw[index] === '\n' || raw[index] === '\r') {
        line += 1
        start = index + 1
      }
    }
    return { line, column: offset - start }
  })
  return Object.freeze({
    ...authority,
    rawLineColumns: Object.freeze(fakeColumns),
  })
}

export const evaluateMarkdownSourceCoordinateMutations = (
  rawSource: string,
): MarkdownSourceCoordinateMutationReport => {
  const authority = snapshotMarkdownSourceCoordinateMap(rawSource)
  const asRaw = identitySnapshot(rawSource)
  const bomDropped = bomDroppedSnapshot(rawSource)
  const crlfLines = crlfLineAsLfSnapshot(rawSource, authority)
  const asRawEquivalent = markdownSourceCoordinateSnapshotsEquivalent(
    authority,
    asRaw,
  )
  const bomEquivalent = markdownSourceCoordinateSnapshotsEquivalent(
    authority,
    bomDropped,
  )
  const crlfEquivalent = markdownSourceCoordinateSnapshotsEquivalent(
    authority,
    crlfLines,
  )

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'normalized-as-raw' as const,
        equivalent: asRawEquivalent,
        accepted: asRawEquivalent,
        detail: 'normalized offsets must not be used as raw UTF-16 offsets',
      }),
      Object.freeze({
        kind: 'bom-dropped' as const,
        equivalent: bomEquivalent,
        accepted: bomEquivalent,
        detail: 'dropping the BOM shifts every raw caret',
      }),
      Object.freeze({
        kind: 'crlf-line-as-lf' as const,
        equivalent: crlfEquivalent,
        accepted: crlfEquivalent,
        detail: 'CRLF line/column must be counted on the raw source',
      }),
    ]),
  })
}
