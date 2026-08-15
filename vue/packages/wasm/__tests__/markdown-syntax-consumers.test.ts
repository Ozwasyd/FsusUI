import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  createMarkdownOutlineEntries,
  createMarkdownTableEntries,
  resolveMarkdownConsumerIdentity,
  searchMarkdownStableProjection,
  stabilizeMarkdownEditorProjection,
} from '../markdown-runtime'

const document = { id: 'doc-1', epoch: 4 }

describe('markdown outline/table/search identity consumers', () => {
  it('reuses the same heading/table identities instead of title hashes or offsets', () => {
    const source =
      '# Alpha\n\n# Alpha\n\nintro\n\n| h |\n| --- |\n| c |\n\n# Beta\n'
    const stable = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      document,
    )
    const outline = createMarkdownOutlineEntries(stable)
    const tables = createMarkdownTableEntries(stable)
    const hits = searchMarkdownStableProjection(stable, 'Alpha')

    expect(outline).toHaveLength(3)
    expect(outline[0]?.id).toBe(
      stable.nodes.find((node) => node.kind === 'heading')?.id,
    )
    expect(outline[0]?.id).not.toBe(outline[1]?.id)
    expect(outline[0]?.title).toBe('Alpha')
    expect(outline[1]?.title).toBe('Alpha')
    expect(outline.every((entry) => entry.id.startsWith('syn:'))).toBe(true)
    expect(outline[1]!.id).not.toBe(`heading:${outline[1]!.range.start}`)
    expect(outline[0]!.id).not.toBe(`hash:${outline[0]!.title}`)

    expect(tables).toHaveLength(1)
    expect(tables[0]?.id).toBe(
      stable.nodes.find((node) => node.kind === 'table')?.id,
    )

    const headingIds = new Set(
      stable.nodes.filter((node) => node.kind === 'heading').map((node) => node.id),
    )
    expect(hits.some((hit) => headingIds.has(hit.id))).toBe(true)
    expect(hits.every((hit) => stable.resolve(hit.id).status === 'current')).toBe(
      true,
    )
    expect(hits.some((hit) => hit.id.startsWith('match:'))).toBe(false)
  })

  it('keeps consumer identities through a prefix insert and does not retarget a deleted heading', () => {
    const first = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('# Alpha\n\n# Beta\n'),
      document,
    )
    const afterPrefix = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('intro text\n\n# Alpha\n\n# Beta\n'),
      document,
      first,
    )
    const firstOutline = createMarkdownOutlineEntries(first)
    const nextOutline = createMarkdownOutlineEntries(afterPrefix)
    expect(nextOutline.map((entry) => entry.id)).toEqual(
      firstOutline.map((entry) => entry.id),
    )
    expect(nextOutline[0]?.range.start).not.toBe(firstOutline[0]?.range.start)

    const afterDelete = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('intro text\n\n# Beta\n'),
      document,
      afterPrefix,
    )
    const deletedId = firstOutline[0]!.id
    expect(resolveMarkdownConsumerIdentity(afterDelete, deletedId).status).toBe(
      'deleted',
    )
    expect(createMarkdownOutlineEntries(afterDelete).map((entry) => entry.id)).toEqual([
      firstOutline[1]!.id,
    ])
    expect(searchMarkdownStableProjection(afterDelete, 'Alpha')).toEqual([])
    expect(
      searchMarkdownStableProjection(afterDelete, 'Beta')[0]?.id,
    ).toBe(firstOutline[1]!.id)
  })
})
