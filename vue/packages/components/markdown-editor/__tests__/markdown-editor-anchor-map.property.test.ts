import { describe, expect, it } from 'vitest'

import {
  createMarkdownAnchorMap,
  type SourceSelection,
} from '../src/markdown-editor-anchor-map'

describe('markdown editor anchor map contract', () => {
  it('round-trips collapsed and directional source selections without using rendered offsets', () => {
    const map = createMarkdownAnchorMap({
      identity: 'shared-document',
      source: 'A **bold** \u{1F600}\r\n\u4e2d\u6587',
      syntax: [
        { id: 'marker', range: [2, 4], hidden: true },
        { id: 'nested', range: [4, 8], parentId: 'marker' },
      ],
    })

    const selections: SourceSelection[] = [
      { anchor: 0, focus: 0 },
      { anchor: 1, focus: 8 },
      { anchor: 8, focus: 1 },
      { anchor: 0, focus: 12 },
    ]

    for (const selection of selections) {
      const visual = map.sourceSelectionToVisual(selection)
      expect(map.visualAnchorToSourceSelection(visual)).toEqual(selection)
    }
  })

  it('distinguishes marker affinities, atomic boundaries, virtual targets, and deleted ranges', () => {
    const map = createMarkdownAnchorMap({
      identity: 'shared-document',
      source: '\ufeffa\u0301\u{1F469}\u200d\u{1F680} \u05e9\u05dc\u05d5\u05dd',
      syntax: [{ id: 'atom', range: [3, 6], atomic: true, virtual: true }],
    })

    expect(map.sourcePositionToVisual({ offset: 3, affinity: 'before' })).toMatchObject({
      kind: 'atomic',
      side: 'before',
    })
    expect(map.sourcePositionToVisual({ offset: 3, affinity: 'after' })).toMatchObject({
      kind: 'atomic',
      side: 'after',
    })
    expect(map.visualPointToSource({ anchorId: 'atom', point: 'inside-source' })).toMatchObject({
      offset: 3,
    })
    expect(map.reveal({ anchorId: 'atom' })).toMatchObject({ virtual: true })

    expect(map.remapRange({ start: 1, end: 4 }, { delete: [1, 4] })).toEqual({
      status: 'deleted',
    })
    expect(map.remapRange({ start: 1, end: 6 }, { delete: [3, 5] })).toMatchObject({
      status: 'partial',
    })
  })
})
