import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
} from '../markdown-runtime'

describe('markdown syntax stable identity', () => {
  it('gives duplicate headings different identities that survive prefix text', () => {
    const document = { id: 'doc-1', epoch: 4 }
    const first = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('# Alpha\n\n# Alpha\n'),
      document,
    )
    expect(first.nodes).toHaveLength(2)
    expect(first.nodes[0].kind).toBe('heading')
    expect(first.nodes[1].kind).toBe('heading')
    expect(first.nodes[0].id).not.toBe(first.nodes[1].id)

    const afterPrefix = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('intro text\n\n# Alpha\n\n# Alpha\n'),
      document,
    )
    expect(afterPrefix.nodes.map((node) => node.kind)).toEqual([
      'paragraph',
      'heading',
      'heading',
    ])
    expect(afterPrefix.nodes[1].id).toBe(first.nodes[0].id)
    expect(afterPrefix.nodes[2].id).toBe(first.nodes[1].id)
    expect(afterPrefix.nodes[1].rawRange.start).not.toBe(first.nodes[0].rawRange.start)
  })

  it('does not reuse identities across document epochs even when source matches', () => {
    const source = '# Title\n'
    const first = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      { id: 'doc-1', epoch: 1 },
    )
    const second = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      { id: 'doc-1', epoch: 2 },
    )
    expect(second.nodes[0].id).not.toBe(first.nodes[0].id)
    expect(second.resolve(first.nodes[0].id).status).toBe('deleted')
    expect(second.resolve(second.nodes[0].id).status).toBe('current')
    expect(second.resolve('not-an-id').status).toBe('invalid')
  })

  it('keeps identities across move, split, and merge and does not retarget a deleted neighbor', () => {
    const document = { id: 'doc-1', epoch: 4 }
    const movedFrom = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('# Alpha\n\n# Beta\n'),
      document,
    )
    const moved = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('# Beta\n\n# Alpha\n'),
      document,
      movedFrom,
    )
    expect(moved.nodes[0].id).toBe(movedFrom.nodes[1].id)
    expect(moved.nodes[1].id).toBe(movedFrom.nodes[0].id)

    const beforeSplit = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Hello world.\n'),
      document,
    )
    const split = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Hello\n\nworld.\n'),
      document,
      beforeSplit,
    )
    expect(split.nodes).toHaveLength(2)
    expect(split.nodes[0].id).toBe(beforeSplit.nodes[0].id)
    expect(split.nodes[1].id).not.toBe(beforeSplit.nodes[0].id)
    expect(split.resolve(beforeSplit.nodes[0].id).status).toBe('current')

    const beforeMerge = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Hello\n\nworld.\n'),
      document,
    )
    const merged = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Hello world.\n'),
      document,
      beforeMerge,
    )
    expect(merged.nodes).toHaveLength(1)
    expect(merged.nodes[0].id).toBe(beforeMerge.nodes[0].id)
    expect(merged.resolve(beforeMerge.nodes[1].id).status).toBe('deleted')

    const twins = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('# Alpha\n\n# Beta\n\n# Alpha\n'),
      document,
    )
    const afterDelete = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('# Beta\n\n# Alpha\n'),
      document,
      twins,
    )
    expect(afterDelete.resolve(twins.nodes[0].id).status).toBe('deleted')
    expect(afterDelete.nodes[0].id).toBe(twins.nodes[1].id)
    expect(afterDelete.nodes[1].id).toBe(twins.nodes[2].id)
    expect(afterDelete.nodes[1].id).not.toBe(twins.nodes[0].id)
  })
})
