import { describe, expect, it } from 'vitest'

import { createMarkdownSourceCoordinateMap } from '../markdown-runtime'

const isCollapsedInterior = (raw: string, offset: number) => {
  if (offset === 0 && raw.startsWith('\uFEFF')) {
    return true
  }
  if (offset > 0 && raw[offset] === '\n' && raw[offset - 1] === '\r') {
    return true
  }
  if (raw[offset] === '\r' && raw[offset + 1] === '\n') {
    return true
  }
  return false
}

describe('Markdown source coordinate map contract', () => {
  it('round-trips raw UTF-16 positions through parser-normalized source', () => {
    const raw = '\uFEFFheader\r\n\r\n中\t  \\  \r\n👩‍💻e\u0301\n'
    const map = createMarkdownSourceCoordinateMap(raw)

    expect(map.rawSource).toBe(raw)
    expect(map.normalizedSource).toBe('header\n\n中\t  \\  \n👩‍💻e\u0301\n')
    expect(Object.is(map.rawSource, raw)).toBe(true)

    for (let rawOffset = 0; rawOffset <= raw.length; rawOffset += 1) {
      if (isCollapsedInterior(raw, rawOffset)) {
        continue
      }
      const normalized = map.toNormalizedOffset(rawOffset)
      const roundTrip = map.toRawOffset(normalized, { affinity: 'forward' })
      expect(roundTrip).toBe(rawOffset)
    }
  })

  it('does not use a normalized offset directly against CRLF raw source', () => {
    const raw = 'a\r\nb'
    const map = createMarkdownSourceCoordinateMap(raw)

    expect(map.toNormalizedOffset(3)).toBe(2)
    expect(map.toRawOffset(2, { affinity: 'forward' })).toBe(3)
    expect(map.toRawOffset(2, { affinity: 'backward' })).toBe(3)
  })

  it('reports unmappable malformed UTF-16 input clearly without mutating it', () => {
    const raw = 'before\uD800after'

    expect(() => createMarkdownSourceCoordinateMap(raw)).toThrow(
      /surrogate|map|invalid/i,
    )
    expect(raw).toBe('before\uD800after')
  })

  it('covers BOM, LF, CRLF, mixed newlines, CJK, emoji/ZWJ, combining marks, and RTL', () => {
    const raw = '\uFEFF拉丁\n中文\r\n👩‍💻e\u0301\rשלום\n'
    const map = createMarkdownSourceCoordinateMap(raw)

    expect(map.rawSource).toBe(raw)
    expect(map.normalizedSource).toBe('拉丁\n中文\n👩‍💻e\u0301\nשלום\n')

    expect(map.toNormalizedOffset(1)).toBe(0)
    expect(raw[1]).toBe('拉')
    expect(map.toRawOffset(0, { affinity: 'forward' })).toBe(1)

    const cjkRaw = raw.indexOf('中')
    expect(map.toRawOffset(map.toNormalizedOffset(cjkRaw))).toBe(cjkRaw)

    const emojiRaw = raw.indexOf('👩')
    expect(map.toRawOffset(map.toNormalizedOffset(emojiRaw))).toBe(emojiRaw)
    expect(map.toRawOffset(map.toNormalizedOffset(emojiRaw + 2))).toBe(emojiRaw + 2)

    const combiningRaw = raw.indexOf('e\u0301')
    expect(map.toRawOffset(map.toNormalizedOffset(combiningRaw + 1))).toBe(
      combiningRaw + 1,
    )

    const rtlRaw = raw.indexOf('ש')
    expect(map.toRawOffset(map.toNormalizedOffset(rtlRaw))).toBe(rtlRaw)
    expect(map.toRawOffset(map.toNormalizedOffset(rtlRaw + 3))).toBe(rtlRaw + 3)
  })

  it('fails if a normalized CRLF index is treated as a raw index', () => {
    const raw = 'a\r\nb'
    const map = createMarkdownSourceCoordinateMap(raw)
    const rawOffset = map.toRawOffset(2, { affinity: 'forward' })

    expect(map.normalizedSource[2]).toBe('b')
    expect(raw[rawOffset]).toBe('b')
    expect(rawOffset).not.toBe(2)
    expect(raw[2]).toBe('\n')
  })

  it('fails if the BOM is dropped from the offset map', () => {
    const raw = '\uFEFFhi'
    const map = createMarkdownSourceCoordinateMap(raw)

    expect(map.toNormalizedOffset(1)).toBe(0)
    expect(raw[1]).toBe('h')
    expect(map.toRawOffset(0, { affinity: 'forward' })).toBe(1)
    expect(map.toRawOffset(0, { affinity: 'backward' })).toBe(0)
    expect(map.toNormalizedOffset(0)).toBe(0)
  })

  it('does not mutate the caller source while mapping well-formed input', () => {
    const raw = '\uFEFFa\r\nb'
    const before = raw
    const map = createMarkdownSourceCoordinateMap(raw)

    expect(raw).toBe(before)
    expect(Object.is(map.rawSource, raw)).toBe(true)
    expect(map.normalizedSource).toBe('a\nb')
  })

  it('uses affinity when a normalized caret spans a collapsed CRLF pair', () => {
    const raw = 'a\r\nb'
    const map = createMarkdownSourceCoordinateMap(raw)

    expect(map.toNormalizedOffset(1)).toBe(1)
    expect(map.toNormalizedOffset(2)).toBe(1)
    expect(map.toRawOffset(1, { affinity: 'backward' })).toBe(1)
    expect(map.toRawOffset(1, { affinity: 'forward' })).toBe(2)
  })

  it('maps lone CR the same way as LF in the normalized view', () => {
    const raw = 'a\rb'
    const map = createMarkdownSourceCoordinateMap(raw)

    expect(map.normalizedSource).toBe('a\nb')
    expect(map.toNormalizedOffset(2)).toBe(2)
    expect(map.toRawOffset(2)).toBe(2)
    expect(raw[map.toRawOffset(1)]).toBe('\r')
  })
})
