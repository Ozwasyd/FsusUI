import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  createMarkdownProjectionWorkerHost,
  isMarkdownProjectionWorkerRequest,
  projectMarkdownOnWorker,
  stabilizeMarkdownEditorProjection,
  type MarkdownProjectionWorkerRequest,
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

describe('markdown projection worker transport', () => {
  it('projects on the worker path and rejects a late result after rapid input', () => {
    const previousSource = '# Title\n\nA paragraph.\n'
    const previous = stabilize(previousSource)
    const posted: MarkdownProjectionWorkerRequest[] = []
    let hostProjects = 0
    const host = createMarkdownProjectionWorkerHost({
      documentIdentity: document,
      port: {
        post(request) {
          hostProjects += 1
          posted.push(request)
        },
      },
    })

    const firstChange = { from: 10, to: 10, insert: 'a' }
    const firstPlan = host.dispatch({
      previous,
      previousSource,
      change: firstChange,
      source: applyChange(previousSource, firstChange),
    })
    const secondChange = { from: 10, to: 10, insert: 'ab' }
    const secondPlan = host.dispatch({
      previous,
      previousSource,
      change: secondChange,
      source: applyChange(previousSource, secondChange),
    })

    expect(hostProjects).toBe(2)
    expect(firstPlan.revision).toBe(1)
    expect(secondPlan.revision).toBe(2)
    expect(host.session.currentTask?.revision).toBe(2)
    expect(posted.every((request) => isMarkdownProjectionWorkerRequest(request))).toBe(
      true,
    )
    expect(posted[0]!.plan.invalidatedRanges.length).toBeGreaterThan(0)

    const late = projectMarkdownOnWorker(posted[0]!)
    const current = projectMarkdownOnWorker(posted[1]!)
    expect(late.revision).toBe(1)
    expect(current.revision).toBe(2)
    expect(late.sourceIdentity).not.toBe(current.sourceIdentity)

    expect(host.accept(late)).toEqual({ ok: false, reason: 'aborted' })
    expect(host.accept(current)).toMatchObject({
      ok: true,
      value: { revision: 2, taskId: secondPlan.taskId },
    })
    expect(current.retainedCurrentIds.length).toBeGreaterThan(0)
  })

  it('rejects a worker result after the document switches', () => {
    const previousSource = 'Hello world.\n'
    const previous = stabilize(previousSource)
    const posted: MarkdownProjectionWorkerRequest[] = []
    const host = createMarkdownProjectionWorkerHost({
      documentIdentity: document,
      port: { post: (request) => posted.push(request) },
    })

    host.dispatch({
      previous,
      previousSource,
      change: { from: 5, to: 5, insert: 'x' },
      source: applyChange(previousSource, { from: 5, to: 5, insert: 'x' }),
    })
    const reply = projectMarkdownOnWorker(posted[0]!)
    host.replaceDocument({ id: 'doc-2', epoch: 2 })

    expect(host.accept(reply)).toEqual({ ok: false, reason: 'document-switch' })
  })

  it('does not treat last-message-wins as a successful stale commit', () => {
    const previousSource = 'Hello world.\n'
    const previous = stabilize(previousSource)
    const posted: MarkdownProjectionWorkerRequest[] = []
    const host = createMarkdownProjectionWorkerHost({
      documentIdentity: document,
      port: { post: (request) => posted.push(request) },
    })

    host.dispatch({
      previous,
      previousSource,
      change: { from: 1, to: 1, insert: '1' },
      source: applyChange(previousSource, { from: 1, to: 1, insert: '1' }),
    })
    host.dispatch({
      previous,
      previousSource,
      change: { from: 1, to: 1, insert: '12' },
      source: applyChange(previousSource, { from: 1, to: 1, insert: '12' }),
    })

    const first = projectMarkdownOnWorker(posted[0]!)
    const second = projectMarkdownOnWorker(posted[1]!)
    let naive = second
    naive = first
    expect(naive.revision).toBe(1)

    expect(host.accept(first).ok).toBe(false)
    const accepted = host.accept(second)
    expect(accepted.ok).toBe(true)
    if (accepted.ok) {
      expect(accepted.value.revision).toBe(2)
      expect(accepted.value.revision).not.toBe(naive.revision)
    }
  })
})
