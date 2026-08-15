import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_POINTER_PLATFORMS,
  createMarkdownAnchorMap,
  createMarkdownEditorProjection,
  createMarkdownSourceCoordinateMap,
  stabilizeMarkdownEditorProjection,
} from '../markdown-runtime'

const markdownEditorModes = ['source', 'live', 'split', 'preview'] as const

describe('markdown source/syntax/visual anchor map', () => {
  it('round-trips collapsed and directional source selections without rendered offsets', () => {
    const map = createMarkdownAnchorMap({
      identity: 'shared-document',
      source: 'A **bold** \u{1F600}\r\n\u4e2d\u6587',
      syntax: [
        { id: 'marker', range: [2, 4], hidden: true },
        { id: 'nested', range: [4, 8], parentId: 'marker' },
      ],
    })

    const selections = [
      { anchor: 0, focus: 0 },
      { anchor: 1, focus: 8 },
      { anchor: 8, focus: 1 },
      { anchor: 0, focus: 12 },
    ] as const

    for (const selection of selections) {
      const visual = map.sourceSelectionToVisual(selection)
      expect(visual.identity).toBe('shared-document')
      expect(map.visualAnchorToSourceSelection(visual)).toEqual(selection)
    }

    expect(map.sourceSelectionToVisual({ anchor: 1, focus: 8 }).direction).toBe(
      'forward',
    )
    expect(map.sourceSelectionToVisual({ anchor: 8, focus: 1 }).direction).toBe(
      'backward',
    )
    expect(map.sourceSelectionToVisual({ anchor: 0, focus: 0 }).direction).toBe(
      'collapsed',
    )
  })

  it('distinguishes marker affinities, atomic boundaries, virtual targets, and deleted ranges', () => {
    const map = createMarkdownAnchorMap({
      identity: 'shared-document',
      source: '\ufeffa\u0301\u{1F469}\u200d\u{1F680} \u05e9\u05dc\u05d5\u05dd',
      syntax: [{ id: 'atom', range: [3, 6], atomic: true, virtual: true }],
    })

    expect(
      map.sourcePositionToVisual({ offset: 3, affinity: 'before' }),
    ).toMatchObject({
      kind: 'atomic',
      side: 'before',
    })
    expect(
      map.sourcePositionToVisual({ offset: 3, affinity: 'after' }),
    ).toMatchObject({
      kind: 'atomic',
      side: 'after',
    })
    expect(
      map.visualPointToSource({ anchorId: 'atom', point: 'inside-source' }),
    ).toMatchObject({
      offset: 3,
    })
    expect(map.reveal({ anchorId: 'atom' })).toMatchObject({ virtual: true })

    expect(map.remapRange({ start: 1, end: 4 }, { delete: [1, 4] })).toEqual({
      status: 'deleted',
    })
    expect(map.remapRange({ start: 1, end: 6 }, { delete: [3, 5] })).toMatchObject(
      {
        status: 'partial',
      },
    )
  })

  it('keeps hidden markers and nested syntax on the source map, not rendered text', () => {
    const map = createMarkdownAnchorMap({
      identity: 'shared-document',
      source: 'A **bold** word',
      syntax: [
        { id: 'marker-open', range: [2, 4], hidden: true },
        { id: 'nested', range: [4, 8], parentId: 'marker-open' },
        { id: 'marker-close', range: [8, 10], hidden: true },
      ],
    })

    expect(
      map.sourcePositionToVisual({ offset: 3, affinity: 'after' }),
    ).toMatchObject({
      kind: 'hidden',
      anchorId: 'marker-open',
    })
    expect(
      map.sourcePositionToVisual({ offset: 4, affinity: 'after' }),
    ).toMatchObject({
      anchorId: 'nested',
      parentId: 'marker-open',
    })

    const acrossMarker = map.sourceSelectionToVisual({ anchor: 2, focus: 10 })
    expect(map.visualAnchorToSourceSelection(acrossMarker)).toEqual({
      anchor: 2,
      focus: 10,
    })
    expect(acrossMarker.anchor.hidden || acrossMarker.focus.hidden).toBe(true)
  })

  it('shares one document identity across source/live/split/preview', () => {
    const document = { id: 'doc-shared', epoch: 7 }
    const source = '# Title\n\nA paragraph.\n'
    const identities = markdownEditorModes.map((mode) => {
      const map = createMarkdownAnchorMap({
        identity: document,
        source,
      })
      return { mode, identity: map.documentIdentity, key: map.identity }
    })

    expect(new Set(identities.map((entry) => entry.key)).size).toBe(1)
    for (const entry of identities) {
      expect(entry.identity).toEqual(document)
    }
  })

  it('consumes #321 coordinates and #323 identities instead of HTML or naked text search', () => {
    const raw = '\uFEFF# Title\r\n\n# Title\n'
    const document = { id: 'doc-1', epoch: 3 }
    const coordinates = createMarkdownSourceCoordinateMap(raw)
    const stable = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(raw),
      document,
    )
    const map = createMarkdownAnchorMap({
      identity: document,
      source: raw,
      projection: stable,
    })

    expect(map.coordinates.normalizedSource).toBe(coordinates.normalizedSource)
    expect(map.syntax.map((node) => node.id)).toEqual(
      stable.nodes.map((node) => node.id),
    )

    const first = stable.nodes[0]
    const second = stable.nodes[1]
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first!.id).not.toBe(second!.id)

    const firstVisual = map.sourceRangeToVisual(first!.rawRange)
    expect(map.visualAnchorToSourceSelection(firstVisual)).toEqual({
      anchor: first!.rawRange.start,
      focus: first!.rawRange.end,
    })

    const deleted = map.remapRange(first!.rawRange, {
      delete: [first!.rawRange.start, first!.rawRange.end],
    })
    expect(deleted).toEqual({ status: 'deleted' })

    const remainingText = raw.slice(second!.rawRange.start, second!.rawRange.end)
    expect(remainingText).toContain('# Title')
    expect(raw.slice(first!.rawRange.start, first!.rawRange.end)).toContain(
      '# Title',
    )
    expect(raw.indexOf('# Title')).toBeGreaterThanOrEqual(first!.rawRange.start)
    expect(raw.indexOf('# Title')).toBeLessThan(first!.rawRange.end)
    expect(
      map.visualPointToSource({ anchorId: second!.id, point: 'start' }).offset,
    ).toBe(second!.rawRange.start)
    expect(
      map.visualPointToSource({ anchorId: second!.id, point: 'start' }).offset,
    ).not.toBe(raw.indexOf('# Title'))

    const crlfRaw = 'ab\r\ncd'
    const crlfMap = createMarkdownAnchorMap({
      identity: 'crlf',
      source: crlfRaw,
      syntax: [{ id: 'line', range: [0, 5] }],
    })
    const acrossCrlf = crlfMap.sourceSelectionToVisual({ anchor: 0, focus: 4 })
    expect(crlfMap.visualAnchorToSourceSelection(acrossCrlf)).toEqual({
      anchor: 0,
      focus: 4,
    })
    expect(acrossCrlf.focus.sourceOffset).not.toBe(
      createMarkdownSourceCoordinateMap(crlfRaw).toNormalizedOffset(4),
    )
  })

  it('does not snap a fully deleted identical neighbor and remaps later ranges', () => {
    const source = 'hello hello'
    const map = createMarkdownAnchorMap({
      identity: 'twins',
      source,
      syntax: [
        { id: 'left', range: [0, 5] },
        { id: 'right', range: [6, 11] },
      ],
    })

    expect(map.remapRange({ start: 0, end: 5 }, { delete: [0, 5] })).toEqual({
      status: 'deleted',
    })
    expect(map.remapRange({ start: 6, end: 11 }, { delete: [0, 5] })).toEqual({
      status: 'mapped',
      range: { start: 1, end: 6 },
    })
    expect(map.remapRange({ start: 6, end: 11 }, { insert: { at: 0, text: 'xx' } })).toEqual({
      status: 'mapped',
      range: { start: 8, end: 13 },
    })
  })

  it('maps platform-neutral pointer hits through hidden markers without DOM or HTML offsets', () => {
    const source = 'A **bold** word'
    const map = createMarkdownAnchorMap({
      identity: 'shared-document',
      source,
      syntax: [
        { id: 'marker-open', range: [2, 4], hidden: true },
        { id: 'nested', range: [4, 8], parentId: 'marker-open' },
        { id: 'marker-close', range: [8, 10], hidden: true },
      ],
    })

    const platforms = MARKDOWN_POINTER_PLATFORMS.map((platform) =>
      map.pointerHitToSource(
        { anchorId: 'marker-open', point: 'start' },
        { platform },
      ),
    )
    expect(new Set(platforms.map((hit) => hit.offset)).size).toBe(1)
    expect(platforms[0]).toMatchObject({
      offset: 2,
      hidden: true,
      platform: 'source',
    })
    expect(
      map.pointerHitToSource({
        anchorId: 'marker-open',
        point: 'after',
        affinity: 'after',
      }),
    ).toMatchObject({ offset: 4, hidden: true })
    expect(
      map.pointerHitToSource({ anchorId: 'nested', point: 'start' }),
    ).toMatchObject({ offset: 4, hidden: false })

    const forward = map.traverseHiddenMarker({
      anchorId: 'marker-open',
      direction: 'forward',
    })
    expect(forward).toMatchObject({
      offset: 4,
      crossed: true,
      hidden: true,
      nextAnchorId: 'nested',
    })
    const backward = map.traverseHiddenMarker({
      anchorId: 'marker-close',
      direction: 'backward',
    })
    expect(backward).toMatchObject({
      offset: 8,
      crossed: true,
      nextAnchorId: 'nested',
    })

    const revealed = map.sourceRangeToReveal({ start: 2, end: 10 })
    expect(revealed.highlights.map((item) => item.anchorId)).toEqual([
      'marker-open',
      'nested',
      'marker-close',
    ])
    expect(revealed.reveal.anchorId).toBe('marker-open')
    expect(revealed.reveal.range).toEqual({ start: 2, end: 4 })
    expect(source.slice(2, 10)).not.toBe('bold')
  })

  it('snaps pointer hits to graphemes and does not reveal a nearby identical neighbor', () => {
    const raw = '\uFEFF# Title\r\n\n# Title\n'
    const document = { id: 'doc-1', epoch: 3 }
    const stable = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(raw),
      document,
    )
    const map = createMarkdownAnchorMap({
      identity: document,
      source: raw,
      projection: stable,
    })
    const second = stable.nodes[1]
    expect(second).toBeDefined()

    const platforms = MARKDOWN_POINTER_PLATFORMS.map((platform) =>
      map.pointerHitToSource(
        { anchorId: second!.id, point: 'start' },
        { platform },
      ),
    )
    expect(new Set(platforms.map((hit) => `${hit.offset}:${hit.anchorId}`)).size).toBe(1)
    expect(platforms[0]!.offset).toBe(second!.rawRange.start)
    expect(platforms[0]!.offset).not.toBe(raw.indexOf('# Title'))

    const revealed = map.sourceRangeToReveal(second!.rawRange)
    expect(revealed.reveal.anchorId).toBe(second!.id)
    expect(revealed.reveal.range).toEqual(second!.rawRange)

    const emojiSource = 'a👩‍💻b'
    const emojiMap = createMarkdownAnchorMap({
      identity: 'emoji',
      source: emojiSource,
      syntax: [{ id: 'line', range: [0, emojiSource.length] }],
    })
    const emoji = emojiSource.indexOf('👩')
    const midEmoji = emoji + 1
    const boundary = createMarkdownSourceCoordinateMap(emojiSource).graphemeBoundaryAt(
      midEmoji,
    )
    const snapped = emojiMap.pointerHitToSource({
      anchorId: 'line',
      point: 'caret',
      localOffset: midEmoji,
    })
    expect(snapped.offset).toBe(boundary.start)
    expect(snapped.offset).not.toBe(midEmoji)
  })
})
