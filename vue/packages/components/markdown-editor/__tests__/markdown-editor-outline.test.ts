import { describe, expect, it } from 'vitest'

import {
  createMarkdownOutlineModel,
  createMarkdownOutlineTree,
  evaluateMarkdownOutlineMutations,
  evaluateMarkdownOutlineRevealMutations,
  resolveMarkdownEditorOutline,
  revealHeading,
  revealSourceRange,
} from '../src/markdown-editor-outline'
import { planMarkdownOutlineReveal } from '../src/markdown-editor-outline-active'

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

    const many = Array.from({ length: 1000 }, (_, index) => `# H${index}`).join('\n\n')
    const large = createMarkdownOutlineModel(many, document)
    expect(large.items).toHaveLength(1000)
    const largeEdited = createMarkdownOutlineModel(`intro\n\n${many}`, document, large.projection)
    expect(largeEdited.items.map((item) => item.id)).toEqual(large.items.map((item) => item.id))

    const setext = createMarkdownOutlineModel('Title\n=====\n\nSub\n---\n', document)
    expect(setext.items.map((item) => ({ depth: item.depth, text: item.text }))).toEqual([
      { depth: 1, text: 'Title' },
      { depth: 2, text: 'Sub' },
    ])
    expect(setext.items.every((item) => item.id.startsWith('syn:'))).toBe(true)

    const empty = createMarkdownOutlineModel('#\n\n#  \n', document)
    expect(empty.items.every((item) => item.text === '')).toBe(true)
    const jumped = createMarkdownOutlineModel('# One\n\n### Nested\n', document)
    expect(jumped.items[1]?.diagnostics.some((item) => item.code === 'heading-layer-jump')).toBe(
      true,
    )
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

describe('markdown outline reveal and virtual target accessibility (#438)', () => {
  const doc = { id: 'doc-x', epoch: 1 }

  it('reveals heading by identity and handles virtual target, deleted, stale, and unsupported cases', () => {
    const source = '# Alpha\n\n## Beta\n\n# Alpha\n'
    const model = createMarkdownOutlineModel(source, doc)
    expect(model.items).toHaveLength(3)

    const first = model.items[0]!
    const secondAlpha = model.items[2]!
    expect(first.nodeId).not.toBe(secondAlpha.nodeId)

    // Successful reveal of exact identity
    expect(
      revealHeading(model.items, first.nodeId, { documentIdentity: doc, revision: 1 }, {
        documentIdentity: doc,
        revision: 1,
      }),
    ).toBe('success')

    // Stale check
    expect(
      revealHeading(model.items, first.nodeId, { documentIdentity: doc, revision: 1 }, {
        documentIdentity: { id: 'doc-x', epoch: 2 },
        revision: 1,
      }),
    ).toBe('stale')

    // Deleted check via options
    expect(
      revealHeading(model.items, first.nodeId, { documentIdentity: doc, revision: 1 }, {
        documentIdentity: doc,
        revision: 1,
      }, {
        deletedNodeIds: [first.nodeId],
      }),
    ).toBe('deleted')

    // Unsupported mode check
    expect(
      revealHeading(model.items, first.nodeId, { documentIdentity: doc, revision: 1 }, {
        documentIdentity: doc,
        revision: 1,
      }, {
        mode: 'unsupported',
      }),
    ).toBe('unsupported')

    // Missing target does NOT fall back to same-title sibling
    expect(
      revealHeading(model.items, 'non-existent-id', { documentIdentity: doc, revision: 1 }, {
        documentIdentity: doc,
        revision: 1,
      }),
    ).toBe('not-found')

    // Virtual target mounting
    expect(
      revealHeading(model.items, 'virtual:heading:99', { documentIdentity: doc, revision: 1 }, {
        documentIdentity: doc,
        revision: 1,
      }, {
        virtualTarget: true,
      }),
    ).toBe('success')
  })

  it('reveals source ranges with exact bounds and mode consistency', () => {
    const model = createMarkdownOutlineModel('# Intro\nbody text\n\n# Details\nmore info\n', doc)
    expect(revealSourceRange(model.items, { start: 0, end: 5 })).toBe('success')
    expect(revealSourceRange(model.items, { start: 50, end: 60 })).toBe('not-found')
    expect(revealSourceRange(model.items, { start: -1, end: 5 })).toBe('not-found')

    expect(
      revealSourceRange(model.items, { start: 0, end: 5 }, {
        expected: { documentIdentity: doc, revision: 1 },
        actual: { documentIdentity: { id: 'other', epoch: 1 }, revision: 1 },
      }),
    ).toBe('stale')

    expect(
      revealSourceRange(model.items, { start: 0, end: 5 }, {
        mode: 'unsupported',
      }),
    ).toBe('unsupported')
  })

  it('provides an unstyled hierarchical outline tree for consumers without styling decoration', () => {
    const source = '# H1\n\n## H2\n\n### H3\n\n# Another H1\n'
    const model = createMarkdownOutlineModel(source, doc)
    const tree = createMarkdownOutlineTree(model.items)

    expect(tree).toHaveLength(2)
    expect(tree[0]!.text).toBe('H1')
    expect(tree[0]!.children).toHaveLength(1)
    expect(tree[0]!.children[0]!.text).toBe('H2')
    expect(tree[0]!.children[0]!.children).toHaveLength(1)
    expect(tree[0]!.children[0]!.children[0]!.text).toBe('H3')
    expect(tree[1]!.text).toBe('Another H1')
    expect(tree[1]!.children).toHaveLength(0)
  })

  it('plans reveal with reduced motion and navigation ownership without history mutation', () => {
    const model = createMarkdownOutlineModel('# One\n\n# Two\n', doc)
    const plan = planMarkdownOutlineReveal(model.items, model.items[0]!.nodeId, {
      reducedMotion: true,
      mode: 'live',
    })

    expect(plan.status).toBe('success')
    expect(plan.scroll).toBe(true)
    expect(plan.smooth).toBe(false)
    expect(plan.liveRevealState).toBe('marker-reveal')
    expect(plan.navigationOwner).toBe('outline')
    expect(plan.historyMutated).toBe(false)
  })

  it('handles 100, 1000, and 10000 headings without unbounded reparse or DOM scan', () => {
    const generateHeadings = (count: number) =>
      Array.from({ length: count }, (_, i) => `# Section ${i}`).join('\n\n')

    for (const count of [100, 1000, 10000]) {
      const src = generateHeadings(count)
      const model = createMarkdownOutlineModel(src, doc)
      expect(model.items).toHaveLength(count)

      const mid = model.items[Math.floor(count / 2)]!
      const plan = planMarkdownOutlineReveal(model.items, mid.nodeId)
      expect(plan.status).toBe('success')
      expect(plan.range).toEqual(mid.sourceRange)
    }
  })

  it('kills text-key reveal, DOM query, nearby success, history mutation, and navigation loop mutations', () => {
    const model = createMarkdownOutlineModel('# Alpha\n\n# Alpha\n', doc)
    const report = evaluateMarkdownOutlineRevealMutations(model.items, doc)

    expect(report.mutations.map((m) => m.kind)).toEqual([
      'text-key-reveal',
      'dom-query-reveal',
      'nearby-success',
      'history-mutation',
      'navigation-loop',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
