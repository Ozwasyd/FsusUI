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
})
