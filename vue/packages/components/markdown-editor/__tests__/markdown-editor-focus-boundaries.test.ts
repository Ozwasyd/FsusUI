import { describe, expect, it } from 'vitest'
import {
  createWritingAidsController,
  createMarkdownFocusSegments,
} from '../src/markdown-editor'
import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'

const source = 'A\n\nB'
const projection = {
  nodes: [
    { id: 'a', kind: 'paragraph', rawRange: { start: 0, end: 1 } },
    { id: 'b', kind: 'paragraph', rawRange: { start: 3, end: 4 } },
  ],
}

const createController = () =>
  createWritingAidsController({
    writingAids: { focus: true },
    editorProfile: 'prose',
    source,
    projection,
  })

describe('MarkdownEditor Focus half-open boundaries', () => {
  it.each([
    [{ start: 0, end: 3 }, ['a']],
    [{ start: 3, end: 0, direction: 'backward' }, ['a']],
    [{ start: 1, end: 4 }, ['b']],
    [{ start: 1, end: 3 }, []],
    [{ start: 0, end: 4 }, ['a', 'b']],
  ] as const)(
    'attributes the noncollapsed selection %j to %j',
    (selection, expected) => {
      const controller = createController()
      controller.updateDocument({ selection })

      expect(controller.focusState?.activeBlockIds).toEqual(expected)
    },
  )

  it('dims the next block in the source presentation when the selection ends at its start', () => {
    const controller = createController()
    controller.updateDocument({ selection: { start: 0, end: 3 } })

    const segments = createMarkdownFocusSegments(source, controller.focusState!)
    expect(segments.find((segment) => segment.nodeId === 'b')).toMatchObject({
      text: 'B',
      dimmed: true,
      exempt: false,
    })
    expect(segments.map((segment) => segment.text).join('')).toBe(source)
  })

  it.each([
    [[0, 3], ['a']],
    [[1, 4], ['b']],
    [[1, 3], []],
    [
      [0, 4],
      ['a', 'b'],
    ],
  ] as const)(
    'exempts only blocks intersecting the search range %j',
    (range, expected) => {
      const controller = createController()
      controller.updateDocument({ focusExemptions: { searchMatches: [range] } })

      expect(controller.focusState?.exemptNodeIds).toEqual(expected)
    },
  )

  it.each([
    [0, 'a'],
    [1, 'a'],
    [2, 'a'],
    [3, 'b'],
    [4, 'b'],
  ] as const)(
    'preserves collapsed caret attribution at offset %i',
    (offset, expected) => {
      const controller = createController()
      controller.updateDocument({ selection: { start: offset, end: offset } })

      expect(controller.focusState?.activeBlockIds).toEqual([expected])
    },
  )

  it.each([
    [1, 'a'],
    [3, 'b'],
    [4, 'b'],
  ] as const)(
    'preserves numeric search-point attribution at offset %i',
    (offset, expected) => {
      const controller = createController()
      controller.updateDocument({
        focusExemptions: { searchMatches: [offset] },
      })

      expect(controller.focusState?.exemptNodeIds).toEqual([expected])
    },
  )

  it.each([
    [1, 'a'],
    [3, 'b'],
    [4, 'b'],
  ] as const)(
    'preserves collapsed search-range attribution at offset %i',
    (offset, expected) => {
      const controller = createController()
      controller.updateDocument({
        focusExemptions: { searchMatches: [[offset, offset]] },
      })

      expect(controller.focusState?.exemptNodeIds).toEqual([expected])
    },
  )

  it('uses the actual stabilized parser projection through the exported controller', () => {
    const actual = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      { id: 'focus-boundary-document', epoch: 1 },
    )
    const blocks = actual.nodes.filter((node) => node.parentRawRange == null)
    expect(blocks.map((node) => node.rawRange)).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 4 },
    ])
    const controller = createController()
    controller.updateDocument({
      projection: actual,
      selection: { start: 0, end: blocks[1]!.rawRange.start },
    })

    expect(controller.focusState?.activeBlockIds).toEqual([blocks[0]!.id])
  })
})
