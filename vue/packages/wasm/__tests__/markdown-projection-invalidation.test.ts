import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  createMarkdownProjectionSession,
  createMarkdownProjectionTask,
  planMarkdownProjectionInvalidation,
  stabilizeMarkdownEditorProjection,
} from '../markdown-runtime'

const document = { id: 'doc-1', epoch: 2 }

const applyChange = (
  source: string,
  change: { from: number; to: number; insert: string },
) => source.slice(0, change.from) + change.insert + source.slice(change.to)

const stabilize = (source: string) =>
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    document,
  )

describe('markdown projection invalidation', () => {
  it('invalidates only the necessary range for a single-character paragraph edit', () => {
    const previousSource = '# Title\n\nA paragraph.\n\nTail paragraph.\n'
    const previous = stabilize(previousSource)
    const paragraph = previous.nodes.find((node) => node.kind === 'paragraph')
    expect(paragraph).toBeDefined()

    const change = {
      from: paragraph!.rawRange.start + 2,
      to: paragraph!.rawRange.start + 2,
      insert: 'x',
    }
    const plan = planMarkdownProjectionInvalidation({
      identity: document,
      revision: 4,
      previousSource,
      change,
      previous,
    })

    expect(plan.expanded).toBe(false)
    expect(plan.reason).toBe('local-edit')
    expect(plan.documentIdentity).toEqual(document)
    expect(plan.revision).toBe(4)
    expect(plan.taskId).toContain('doc-1')
    expect(plan.invalidatedNodeIds).toEqual([paragraph!.id])
    expect(plan.retainedNodeIds).toContain(
      previous.nodes.find((node) => node.kind === 'heading')!.id,
    )
    expect(plan.invalidatedRanges.every((range) => range.end - range.start < previousSource.length)).toBe(
      true,
    )

    const nextSource = applyChange(previousSource, change)
    const next = stabilize(nextSource)
    for (const retained of plan.retained) {
      expect(next.resolve(retained.id).status).toBe('current')
    }
  })

  it('expands unclosed fence, list indent, and reference edits instead of staying in the paragraph', () => {
    const fenced = 'intro\n\n```js\nconst x = 1\n'
    const fencedProjection = stabilize(fenced)
    const fencePlan = planMarkdownProjectionInvalidation({
      identity: document,
      revision: 1,
      previousSource: fenced,
      change: { from: fenced.length, to: fenced.length, insert: 'y' },
      previous: fencedProjection,
    })
    expect(fencePlan.expanded).toBe(true)
    expect(fencePlan.reason).toBe('unclosed-fence')
    expect(fencePlan.invalidatedRanges.some((range) => range.end === fenced.length + 1)).toBe(
      true,
    )

    const listed = '# Title\n\n- one\n- two\n'
    const listedProjection = stabilize(listed)
    const list = listedProjection.nodes.find((node) => node.kind === 'list')
    expect(list).toBeDefined()
    const listPlan = planMarkdownProjectionInvalidation({
      identity: document,
      revision: 2,
      previousSource: listed,
      change: {
        from: list!.rawRange.start,
        to: list!.rawRange.start,
        insert: '  ',
      },
      previous: listedProjection,
    })
    expect(listPlan.expanded).toBe(true)
    expect(listPlan.reason).toBe('list-structure')
    expect(listPlan.invalidatedNodeIds).toContain(list!.id)

    const referenced = 'See [note].\n\n[note]: https://example.com\n'
    const referencedProjection = stabilize(referenced)
    const referencePlan = planMarkdownProjectionInvalidation({
      identity: document,
      revision: 3,
      previousSource: referenced,
      change: {
        from: referenced.indexOf('[note]:'),
        to: referenced.indexOf('[note]:') + 6,
        insert: '[note]:',
      },
      previous: referencedProjection,
    })
    expect(referencePlan.expanded).toBe(true)
    expect(referencePlan.reason).toBe('reference-or-footnote')
  })

  it('rejects aborted and stale tasks so rapid input cannot commit an old revision', () => {
    const previousSource = 'Hello world\n'
    const previous = stabilize(previousSource)
    const session = createMarkdownProjectionSession({
      documentIdentity: document,
      revision: 0,
    })

    const firstPlan = session.plan(previous, previousSource, {
      from: 5,
      to: 5,
      insert: 'a',
    })
    const firstTask = session.begin(firstPlan)

    const secondPlan = session.plan(
      previous,
      previousSource,
      { from: 5, to: 5, insert: 'ab' },
    )
    const secondTask = session.begin(secondPlan)

    expect(firstTask.aborted).toBe(true)
    expect(
      firstTask.commit({ revision: firstPlan.revision, documentIdentity: document }, 'late'),
    ).toEqual({ ok: false, reason: 'aborted' })
    expect(
      firstTask.commit({ revision: secondPlan.revision, documentIdentity: document }, 'late'),
    ).toEqual({ ok: false, reason: 'aborted' })

    const current = { revision: secondPlan.revision, documentIdentity: document }
    expect(secondTask.commit(current, 'fresh')).toEqual({
      ok: true,
      value: 'fresh',
    })
    expect(
      secondTask.commit(
        { revision: secondPlan.revision + 1, documentIdentity: document },
        'stale',
      ),
    ).toEqual({ ok: false, reason: 'stale-revision' })
    expect(
      secondTask.commit(
        { revision: secondPlan.revision, documentIdentity: { id: 'other', epoch: 2 } },
        'switched',
      ),
    ).toEqual({ ok: false, reason: 'document-switch' })
  })

  it('does not treat a full-document range as local evidence', () => {
    const previousSource = `${'word '.repeat(40)}\n\n# Heading\n`
    const previous = stabilize(previousSource)
    const heading = previous.nodes.find((node) => node.kind === 'heading')
    expect(heading).toBeDefined()

    const change = {
      from: heading!.rawRange.start + 2,
      to: heading!.rawRange.start + 2,
      insert: 'Z',
    }
    const plan = planMarkdownProjectionInvalidation({
      identity: document,
      revision: 9,
      previousSource,
      change,
      previous,
    })

    expect(plan.expanded).toBe(false)
    expect(plan.budget.scannedBytes).toBe(change.insert.length)
    expect(plan.budget.scannedBytes).toBeLessThan(previousSource.length)
    expect(
      plan.invalidatedRanges.some(
        (range) => range.start === 0 && range.end >= previousSource.length,
      ),
    ).toBe(false)

    const task = createMarkdownProjectionTask({
      documentIdentity: plan.documentIdentity,
      revision: plan.revision,
      taskId: plan.taskId,
    })
    expect(
      task.commit(
        { revision: plan.revision, documentIdentity: document },
        plan.invalidatedRanges,
      ).ok,
    ).toBe(true)
  })
})
