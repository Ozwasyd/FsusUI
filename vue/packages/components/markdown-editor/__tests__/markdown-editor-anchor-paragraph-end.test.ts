import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  ElMarkdownEditor,
  currentMarkdownAnchors,
  planMarkdownAnchorInsert,
} from '../../../element-plus'
import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'

describe('public anchor insertion at canonical paragraph end', () => {
  it.each([
    ['LF', 'First.\n\nSecond.', 'First. ^intro\n\nSecond.'],
    ['CRLF', 'First.\r\n\r\nSecond.', 'First. ^intro\r\n\r\nSecond.'],
    ['BOM/CRLF/UTF-8', '\uFEFF章节🙂\r\n\r\nSecond.', '\uFEFF章节🙂 ^intro\r\n\r\nSecond.'],
    ['multiline LF', 'First\nlast.\n\nSecond.', 'First\nlast. ^intro\n\nSecond.'],
    ['trailing CRLF', 'First.\r\n', 'First. ^intro\r\n'],
    ['EOF', 'First.', 'First. ^intro'],
  ])('dispatches a valid anchor for %s without moving source bytes', (label, source, expected) => {
    const identity = { id: `document:anchor:${label}`, epoch: 1 }
    const projection = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      identity,
    )
    const paragraph = projection.nodes.find((node) => node.kind === 'paragraph')!
    expect(paragraph).toBeDefined()
    const transaction = planMarkdownAnchorInsert(source, paragraph.rawRange.end, 'intro', { projection })
    const wrapper = mount(ElMarkdownEditor, {
      props: { modelValue: source, documentIdentity: identity },
    })
    try {
      const result = wrapper.vm.dispatchTransaction(transaction)
      expect(result).toMatchObject({ accepted: true, value: expected })
      const nextProjection = createMarkdownEditorProjection(result.value)
      const next = stabilizeMarkdownEditorProjection(nextProjection, identity, projection)
      expect(currentMarkdownAnchors(result.value, next)).toHaveLength(1)
      expect(nextProjection.diagnostics.filter((diagnostic) => diagnostic.code.startsWith('anchor-'))).toEqual([])
      expect(wrapper.vm.undo()).toMatchObject({ accepted: true, value: source })
      expect(wrapper.vm.redo()).toMatchObject({ accepted: true, value: expected })
    } finally {
      wrapper.unmount()
    }
  })

  it.each([6, 8])('uses canonical CRLF content coordinates with no supplied projection at %i', (offset) => {
    expect(planMarkdownAnchorInsert('First.\r\n\r\nSecond.', offset, 'intro')).toEqual({
      changes: [{ from: 6, to: 6, insert: ' ^intro' }],
      history: 'separate',
      origin: 'command',
    })
  })
})
