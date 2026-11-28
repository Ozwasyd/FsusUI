import { describe, expect, it } from 'vitest'

import { createMarkdownOutlineModel } from '../src/markdown-editor-outline'
import {
  commitMarkdownOutlineActive,
  evaluateMarkdownOutlineActiveMutations,
  headingAtSourceOffset,
  resolveMarkdownActiveHeading,
  resolveMarkdownOutlineActive,
  resolveMarkdownOutlineNavigationOwner,
} from '../src/markdown-editor-outline-active'

const source = '# One\nbody one\n\n# Two\nbody two\n\n# Three\n'
const identity = { documentId: 'doc', documentEpoch: 2, revision: 5 }

describe('markdown outline active heading', () => {
  it('resolves caret, selection, viewport, and end-of-document sections from source offsets', () => {
    const model = createMarkdownOutlineModel(source, { id: 'doc', epoch: 2 })
    const [one, two, three] = model.items
    expect(one && two && three).toBeTruthy()
    expect(headingAtSourceOffset(model.items, one!.sourceRange.start)?.nodeId).toBe(one!.nodeId)
    expect(headingAtSourceOffset(model.items, one!.sourceRange.start + 2)?.nodeId).toBe(one!.nodeId)
    expect(headingAtSourceOffset(model.items, two!.sourceRange.start - 1)?.nodeId).toBe(one!.nodeId)
    expect(headingAtSourceOffset(model.items, 0)?.nodeId).toBe(one!.nodeId)
    expect(headingAtSourceOffset([], 0)).toBeNull()
    expect(headingAtSourceOffset(model.items, source.length)?.nodeId).toBe(three!.nodeId)

    const beforeFirst = createMarkdownOutlineModel('lead\n\n# One\n', { id: 'doc', epoch: 2 })
    expect(headingAtSourceOffset(beforeFirst.items, 0)).toBeNull()
    expect(headingAtSourceOffset(beforeFirst.items, 4)).toBeNull()

    const spanning = resolveMarkdownOutlineActive({
      ...identity,
      items: model.items,
      selection: { start: one!.sourceRange.start, end: two!.sourceRange.end, direction: 'forward' },
      cause: 'selection',
    })
    expect(spanning.headingId).toBe(one!.nodeId)
    expect(spanning.cause).toBe('selection')

    const backward = resolveMarkdownOutlineActive({
      ...identity,
      items: model.items,
      selection: { start: one!.sourceRange.start, end: two!.sourceRange.end, direction: 'backward' },
      cause: 'selection',
    })
    expect(backward.headingId).toBe(two!.nodeId)

    const viewport = resolveMarkdownActiveHeading(model.items, {
      start: two!.sourceRange.start + 1,
      end: two!.sourceRange.end + 8,
    })
    expect(viewport?.nodeId).toBe(two!.nodeId)
  })

  it('lets typing, manual scroll, and explicit navigation own the active heading', () => {
    const model = createMarkdownOutlineModel(source, { id: 'doc', epoch: 2 })
    const [one, two] = model.items
    expect(resolveMarkdownOutlineNavigationOwner('typewriter', 'typing')).toBe('typing')
    expect(resolveMarkdownOutlineNavigationOwner('typing', 'manual-scroll')).toBe('manual-scroll')

    const typing = resolveMarkdownOutlineActive({
      ...identity,
      items: model.items,
      caret: one!.sourceRange.start + 1,
      viewport: { start: two!.sourceRange.start, end: two!.sourceRange.end },
      cause: 'typing',
    })
    expect(typing.headingId).toBe(one!.nodeId)
    expect(typing.cause).toBe('typing')
    expect(typing.suspended).toBe(false)

    const scrolled = resolveMarkdownOutlineActive({
      ...identity,
      items: model.items,
      caret: one!.sourceRange.start + 1,
      viewport: { start: two!.sourceRange.start, end: two!.sourceRange.end },
      cause: 'manual-scroll',
    })
    expect(scrolled.headingId).toBe(two!.nodeId)
    expect(scrolled.cause).toBe('manual-scroll')
    expect(scrolled.suspended).toBe(true)

    const jumped = resolveMarkdownOutlineActive({
      ...identity,
      items: model.items,
      caret: two!.sourceRange.start,
      owner: 'outline',
      previous: {
        headingId: two!.nodeId,
        ...identity,
        cause: 'outline',
        owner: 'outline',
        suspended: false,
      },
    })
    expect(jumped.headingId).toBe(two!.nodeId)
    expect(jumped.cause).toBe('outline')
  })

  it('tracks identity across rename and rejects other-document active state', () => {
    const model = createMarkdownOutlineModel(source, { id: 'doc', epoch: 2 })
    const renamedSource = source.replace('# One', '# Uno')
    const renamed = createMarkdownOutlineModel(renamedSource, { id: 'doc', epoch: 2 }, model.projection)
    const active = resolveMarkdownOutlineActive({
      ...identity,
      items: renamed.items,
      caret: renamed.items[0]!.sourceRange.start,
      previous: {
        headingId: model.items[0]!.nodeId,
        ...identity,
        cause: 'caret',
        owner: 'typing',
        suspended: false,
      },
    })
    expect(active.headingId).toBe(renamed.items[0]!.nodeId)
    expect(renamed.items[0]!.nodeId).toBe(model.items[0]!.nodeId)

    const switched = commitMarkdownOutlineActive(
      { documentId: 'other', documentEpoch: 2, revision: 5 },
      active,
    )
    expect(switched).toEqual({ rejected: 'stale' })

    const epoch = commitMarkdownOutlineActive(
      { documentId: 'doc', documentEpoch: 9, revision: 5 },
      active,
    )
    expect(epoch).toEqual({ rejected: 'stale' })
  })

  it('kills DOM active, click-only, text match, and scroll-loop mutations', () => {
    const model = createMarkdownOutlineModel(source, { id: 'doc', epoch: 2 })
    const report = evaluateMarkdownOutlineActiveMutations(model.items, {
      start: 0,
      end: 4,
    })
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'dom-active',
      'click-only',
      'text-match',
      'scroll-loop',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
