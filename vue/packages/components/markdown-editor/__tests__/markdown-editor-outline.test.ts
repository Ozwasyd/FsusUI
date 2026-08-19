import { describe, expect, it } from 'vitest'

import {
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
      level: 1,
      sourceRange: { start: 0, end: 7 },
    })
    expect(outline[1].nodeId).toBe('doc-a:4:heading:1')
    expect(outline[1].level).toBe(2)
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
        documentIdentity: { key: 'doc-a', epoch: 2 },
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
