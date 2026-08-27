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
      first,
    )
    expect(afterPrefix.nodes.map((node) => node.kind)).toEqual([
      'paragraph',
      'heading',
      'heading',
    ])
    expect(afterPrefix.nodes[1].id).toBe(first.nodes[0].id)
    expect(afterPrefix.nodes[2].id).toBe(first.nodes[1].id)
    expect(afterPrefix.nodes[1].rawRange.start).not.toBe(
      first.nodes[0].rawRange.start,
    )
  })

  it('gives repeated headings, paragraphs, code blocks, and links distinct identities', () => {
    const source =
      '# Same\n\n# Same\n\nSame paragraph.\n\nSame paragraph.\n\n```\nsame\n```\n\n```\nsame\n```\n\n[same](x) [same](x)\n'
    const stable = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      { id: 'duplicates', epoch: 1 },
    )

    for (const [kind, count] of [
      ['heading', 2],
      ['paragraph', 3],
      ['code', 2],
      ['link', 2],
    ] as const) {
      const ids = stable.nodes
        .filter((node) => node.kind === kind)
        .map((node) => node.id)
      expect(ids).toHaveLength(count)
      expect(new Set(ids).size).toBe(count)
    }
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

  it('does not reuse identities for another document with the same source and epoch', () => {
    const source = '# Title\n'
    const first = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      { id: 'doc-a', epoch: 1 },
    )
    const second = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      { id: 'doc-b', epoch: 1 },
      first,
    )
    expect(second.nodes[0].id).not.toBe(first.nodes[0].id)
    expect(second.resolve(first.nodes[0].id).status).toBe('invalid')
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

  it('uses the source change to preserve an identical survivor and never revives deleted ids', () => {
    const document = { id: 'doc-1', epoch: 4 }
    const source = '# Alpha\n\n# Alpha\n'
    const twins = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      document,
    )
    const secondStart = twins.nodes[1]!.rawRange.start
    const survivorSource = source.slice(secondStart)
    const survivor = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(survivorSource),
      document,
      twins,
      { from: 0, to: secondStart, insert: '' },
    )
    expect(survivor.nodes[0]!.id).toBe(twins.nodes[1]!.id)
    expect(survivor.resolve(twins.nodes[0]!.id).status).toBe('deleted')

    const empty = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(''),
      document,
      survivor,
      { from: 0, to: survivorSource.length, insert: '' },
    )
    expect(empty.resolve(twins.nodes[1]!.id).status).toBe('deleted')

    const recreated = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('# Alpha\n'),
      document,
      empty,
      { from: 0, to: 0, insert: '# Alpha\n' },
    )
    expect(recreated.nodes[0]!.id).not.toBe(twins.nodes[0]!.id)
    expect(recreated.nodes[0]!.id).not.toBe(twins.nodes[1]!.id)
    expect(recreated.resolve(twins.nodes[0]!.id).status).toBe('deleted')
    expect(recreated.resolve(twins.nodes[1]!.id).status).toBe('deleted')
  })

  it('keeps identity when a node is wrapped or unwrapped into another syntax kind', () => {
    const document = { id: 'doc-1', epoch: 4 }
    const paragraph = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Hello world.\n'),
      document,
    )
    const quoted = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('> Hello world.\n'),
      document,
      paragraph,
    )
    expect(quoted.nodes).toHaveLength(1)
    expect(quoted.nodes[0].kind).toBe('quote')
    expect(quoted.nodes[0].id).toBe(paragraph.nodes[0].id)
    expect(quoted.resolve(paragraph.nodes[0].id).status).toBe('current')
    expect(quoted.resolve(paragraph.nodes[0].id).node?.kind).toBe('quote')

    const unwrapped = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Hello world.\n'),
      document,
      quoted,
    )
    expect(unwrapped.nodes[0].kind).toBe('paragraph')
    expect(unwrapped.nodes[0].id).toBe(paragraph.nodes[0].id)

    const listed = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('- Hello world.\n'),
      document,
      paragraph,
    )
    expect(listed.nodes[0].kind).toBe('list')
    expect(listed.nodes[0].id).toBe(paragraph.nodes[0].id)

    const heading = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('# Title\n'),
      document,
    )
    const quotedHeading = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('> # Title\n'),
      document,
      heading,
    )
    expect(quotedHeading.nodes[0].kind).toBe('quote')
    expect(quotedHeading.nodes[0].id).toBe(heading.nodes[0].id)

    const pair = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Hello world.\n\nTail.\n'),
      document,
    )
    const wrapFirst = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('> Hello world.\n\nTail.\n'),
      document,
      pair,
    )
    expect(wrapFirst.nodes.map((node) => node.kind)).toEqual([
      'quote',
      'paragraph',
    ])
    expect(wrapFirst.nodes[0].id).toBe(pair.nodes[0].id)
    expect(wrapFirst.nodes[1].id).toBe(pair.nodes[1].id)

    const twins = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Hello world.\n\nHello world.\n'),
      document,
    )
    const wrapTwin = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('> Hello world.\n\nHello world.\n'),
      document,
      twins,
    )
    expect(wrapTwin.nodes[0].id).toBe(twins.nodes[0].id)
    expect(wrapTwin.nodes[1].id).toBe(twins.nodes[1].id)
    expect(wrapTwin.nodes[1].id).not.toBe(twins.nodes[0].id)
    expect(wrapTwin.resolve(twins.nodes[0].id).node?.kind).toBe('quote')
    expect(wrapTwin.resolve(twins.nodes[1].id).node?.kind).toBe('paragraph')
  })

  it('keeps identity when wrapping into task, table, code, footnote, or explicit paragraph', () => {
    const document = { id: 'doc-1', epoch: 4 }
    const paragraph = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Hello world.\n'),
      document,
    )
    const wraps = [
      { raw: '- [ ] Hello world.\n', kind: 'task' },
      { raw: '| Hello world. |\n| --- |\n', kind: 'table' },
      { raw: '```\nHello world.\n```\n', kind: 'code' },
      { raw: '[^n]: Hello world.\n', kind: 'footnote' },
      { raw: '::p\nHello world.\n::\n', kind: 'explicit-paragraph' },
    ] as const

    for (const wrap of wraps) {
      const wrapped = stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(wrap.raw),
        document,
        paragraph,
      )
      expect(wrapped.nodes[0]?.kind).toBe(wrap.kind)
      expect(wrapped.nodes[0]?.id).toBe(paragraph.nodes[0]!.id)
      const unwrapped = stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection('Hello world.\n'),
        document,
        wrapped,
      )
      expect(unwrapped.nodes[0]?.kind).toBe('paragraph')
      expect(unwrapped.nodes[0]?.id).toBe(paragraph.nodes[0]!.id)
    }

    const pair = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Hello world.\n\nTail.\n'),
      document,
    )
    const wrapFirstTask = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('- [ ] Hello world.\n\nTail.\n'),
      document,
      pair,
    )
    expect(wrapFirstTask.nodes.map((node) => node.kind)).toEqual([
      'task',
      'paragraph',
    ])
    expect(wrapFirstTask.nodes[0]!.id).toBe(pair.nodes[0]!.id)
    expect(wrapFirstTask.nodes[1]!.id).toBe(pair.nodes[1]!.id)
  })

  it('does not let an offset insert of the same visible text steal a heading identity', () => {
    const document = { id: 'doc-1', epoch: 4 }
    const heading = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('# Alpha\n'),
      document,
    )
    const inserted = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection('Alpha\n\n# Alpha\n'),
      document,
      heading,
    )
    expect(inserted.nodes.map((node) => node.kind)).toEqual([
      'paragraph',
      'heading',
    ])
    expect(inserted.nodes[1]!.id).toBe(heading.nodes[0]!.id)
    expect(inserted.nodes[0]!.id).not.toBe(heading.nodes[0]!.id)
    expect(inserted.resolve(heading.nodes[0]!.id).node?.kind).toBe('heading')
  })
})
