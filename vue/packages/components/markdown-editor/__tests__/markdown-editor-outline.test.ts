import { describe, expect, it } from 'vitest'

import {
  createMarkdownOutlineModel,
  evaluateMarkdownOutlineMutations,
  resolveMarkdownEditorOutline,
  revealHeading,
  revealSourceRange,
} from '../src/markdown-editor-outline'

const identity = { id: 'doc-a', epoch: 1 }

describe('markdown editor leftover outline planner', () => {
  it('builds heading items from projection nodes with stable identity and ranges', () => {
    const source = '# Title\n\n## Nested\n'
    const outline = resolveMarkdownEditorOutline({
      documentIdentity: identity,
      revision: 4,
      source,
      nodes: [
        { kind: 'heading', rawRange: { start: 0, end: 7 } },
        { kind: 'paragraph', rawRange: { start: 9, end: 9 } },
        { kind: 'heading', rawRange: { start: 9, end: 18 } },
      ],
    })

    expect(outline).toHaveLength(2)
    expect(outline[0]).toMatchObject({
      nodeId: 'doc-a:4:heading:0',
      depth: 1,
      sourceRange: { start: 0, end: 7 },
    })
    expect(outline[1].nodeId).toBe('doc-a:4:heading:1')
    expect(outline[1].depth).toBe(2)
  })

  it('reveals headings by identity and fails closed on stale document epochs', () => {
    const outline = resolveMarkdownEditorOutline({
      documentIdentity: identity,
      revision: 1,
      source: '# A\n',
      nodes: [{ kind: 'heading', rawRange: { start: 0, end: 3 } }],
    })
    const nodeId = outline[0].nodeId

    expect(
      revealHeading(outline, nodeId, { documentIdentity: identity, revision: 1 }, {
        documentIdentity: identity,
        revision: 1,
      }),
    ).toBe('success')
    expect(
      revealHeading(outline, nodeId, { documentIdentity: identity, revision: 1 }, {
        documentIdentity: { id: 'doc-a', epoch: 2 },
        revision: 1,
      }),
    ).toBe('stale')
    expect(
      revealHeading(outline, 'missing', { documentIdentity: identity, revision: 1 }, {
        documentIdentity: identity,
        revision: 1,
      }),
    ).toBe('not-found')
    expect(revealSourceRange(outline, { start: 0, end: 2 })).toBe('success')
  })
})

describe('markdown outline projection model', () => {
  it('uses stable projection identities instead of title or offset keys', () => {
    const document = { id: 'doc-a', epoch: 1 }
    const first = createMarkdownOutlineModel('# Alpha\n\n# Alpha\n\n# Beta\n', document)
    expect(first.items).toHaveLength(3)
    expect(first.items[0]?.id).toBe(first.items[0]?.nodeId)
    expect(first.items[0]?.id.startsWith('syn:')).toBe(true)
    expect(first.items[0]?.id).not.toBe(first.items[1]?.id)
    expect(first.items[0]?.text).toBe('Alpha')
    expect(first.items[1]?.text).toBe('Alpha')
    expect(first.items[0]?.id).not.toBe(`hash:${first.items[0]?.text}`)
    expect(first.items[1]?.id).not.toBe(`heading:${first.items[1]?.sourceRange.start}`)

    const afterPrefix = createMarkdownOutlineModel(
      'intro\n\n# Alpha\n\n# Alpha\n\n# Beta\n',
      document,
      first.projection,
    )
    expect(afterPrefix.items.map((item) => item.id)).toEqual(
      first.items.map((item) => item.id),
    )

    const otherDoc = createMarkdownOutlineModel('# Alpha\n\n# Alpha\n\n# Beta\n', {
      id: 'doc-b',
      epoch: 1,
    })
    expect(otherDoc.items[0]?.id).not.toBe(first.items[0]?.id)

    const many = Array.from({ length: 80 }, (_, index) => `# H${index}`).join('\n\n')
    const large = createMarkdownOutlineModel(many, document)
    const largeEdited = createMarkdownOutlineModel(`intro\n\n${many}`, document, large.projection)
    expect(largeEdited.items.map((item) => item.id)).toEqual(large.items.map((item) => item.id))
  })

  it('kills regex, text, offset, and full-rebuild outline keys', () => {
    const report = evaluateMarkdownOutlineMutations('# Alpha\n\n# Alpha\n', {
      id: 'doc-a',
      epoch: 1,
    })
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
