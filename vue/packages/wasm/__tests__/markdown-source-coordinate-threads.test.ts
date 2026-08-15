import { describe, expect, it } from 'vitest'

import {
  compareMarkdownSourceCoordinateMapThreads,
  createMarkdownSourceCoordinateMap,
  evaluateMarkdownSourceCoordinateMutations,
  markdownSourceCoordinateSnapshotsEquivalent,
  snapshotMarkdownSourceCoordinateMap,
  transferMarkdownSourceCoordinateMap,
} from '../markdown-runtime'

const fixtures = [
  '\uFEFFheader\r\n\r\n中\t  \\  \r\n👩‍💻e\u0301\n',
  'a\r\nb',
  '\uFEFFhi',
  'a\rb',
  '\uFEFF拉丁\n中文\r\n👩‍💻e\u0301\rשלום\n',
  'Hello \u05e9\u05dc\u05d5\u05dd \u2066world\u2069',
] as const

describe('markdown source coordinate worker/main threads', () => {
  it('produces equivalent maps after a JSON worker transfer', () => {
    for (const raw of fixtures) {
      const comparison = compareMarkdownSourceCoordinateMapThreads(raw)
      expect(comparison.equivalent).toBe(true)
      expect(comparison.main.rawSource).toBe(raw)
      expect(comparison.worker.normalizedSource).toBe(
        comparison.main.normalizedSource,
      )
      expect(
        markdownSourceCoordinateSnapshotsEquivalent(
          comparison.main,
          transferMarkdownSourceCoordinateMap(raw),
        ),
      ).toBe(true)
    }
  })

  it('rejects treating normalized offsets as raw, dropping the BOM, or counting CRLF as LF', () => {
    const raw = '\uFEFFa\r\nb\n'
    const report = evaluateMarkdownSourceCoordinateMutations(raw)
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    const map = createMarkdownSourceCoordinateMap(raw)
    const afterCrlf = map.toNormalizedOffset(raw.indexOf('b'))

    expect(report.authority.normalizedSource).toBe('a\nb\n')
    expect(map.toRawOffset(afterCrlf)).not.toBe(afterCrlf)
    expect(raw[afterCrlf]).not.toBe('b')
    expect(map.toRawLineColumn(raw.indexOf('b'))).toEqual({ line: 2, column: 0 })
    expect(byKind['normalized-as-raw']?.equivalent).toBe(false)
    expect(byKind['normalized-as-raw']?.accepted).toBe(false)
    expect(byKind['bom-dropped']?.equivalent).toBe(false)
    expect(byKind['bom-dropped']?.accepted).toBe(false)
    expect(byKind['crlf-line-as-lf']?.equivalent).toBe(false)
    expect(byKind['crlf-line-as-lf']?.accepted).toBe(false)
    expect(
      markdownSourceCoordinateSnapshotsEquivalent(
        report.authority,
        snapshotMarkdownSourceCoordinateMap(map),
      ),
    ).toBe(true)
  })

  it('does not treat a different source as an equivalent worker map', () => {
    const left = snapshotMarkdownSourceCoordinateMap('a\r\nb')
    const right = transferMarkdownSourceCoordinateMap('a\nb')
    expect(markdownSourceCoordinateSnapshotsEquivalent(left, right)).toBe(false)
  })
})
