import { resolve } from 'node:path'
import { threadId, Worker } from 'node:worker_threads'

import { describe, expect, it } from 'vitest'

import {
  bindMarkdownProjectionWorkerScope,
  connectMarkdownProjectionWorker,
  createMarkdownEditorProjection,
  createMarkdownProjectionWorkerHost,
  handleMarkdownProjectionWorkerMessage,
  planMarkdownProjectionInvalidation,
  stabilizeMarkdownEditorProjection,
  type MarkdownProjectionWorkerRequest,
  type MarkdownProjectionWorkerResult,
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('markdown projection dedicated worker entry', () => {
  it('rejects a late worker-thread result after rapid input', async () => {
    const previousSource = '# Title\n\nA paragraph.\n'
    const previous = stabilize(previousSource)
    const commits: Array<{ ok: boolean; reason?: string; revision?: number }> = []
    const incoming: MarkdownProjectionWorkerRequest[] = []

    const workerScope = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      postMessage(message: unknown) {
        const hostScope = connected.hostScope
        queueMicrotask(() => hostScope.onmessage?.({ data: message }))
      },
    }

    const hostScope = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      postMessage(message: unknown) {
        incoming.push(message as MarkdownProjectionWorkerRequest)
        const delay = incoming.length === 1 ? 30 : 0
        setTimeout(() => {
          const result = handleMarkdownProjectionWorkerMessage(message)
          workerScope.onmessage?.({ data: result })
        }, delay)
      },
    }

    bindMarkdownProjectionWorkerScope(workerScope)
    const host = createMarkdownProjectionWorkerHost({
      documentIdentity: document,
      port: {
        post(request) {
          hostScope.postMessage(request)
        },
      },
    })
    const connected = { hostScope }
    workerScope.onmessage = (event) => {
      const accepted = host.accept(event.data)
      commits.push(
        'reason' in accepted
          ? { ok: false, reason: accepted.reason }
          : { ok: true, revision: accepted.value.revision },
      )
    }

    host.dispatch({
      previous,
      previousSource,
      change: { from: 10, to: 10, insert: 'a' },
      source: applyChange(previousSource, { from: 10, to: 10, insert: 'a' }),
    })
    const secondPlan = host.dispatch({
      previous,
      previousSource,
      change: { from: 10, to: 10, insert: 'ab' },
      source: applyChange(previousSource, { from: 10, to: 10, insert: 'ab' }),
    })

    expect(secondPlan.budget.scannedBytes).toBeLessThanOrEqual(
      secondPlan.budget.maxScannedBytes + 2,
    )
    expect(incoming).toHaveLength(2)

    await wait(50)

    expect(commits.some((commit) => commit.ok === false)).toBe(true)
    const accepted = commits.find((commit) => commit.ok)
    expect(accepted?.revision).toBe(2)
    expect(commits.filter((commit) => commit.ok).length).toBe(1)
  })

  it('runs the dedicated node worker entry on another thread and still rejects stale work', async () => {
    const previousSource = 'Hello world.\n'
    const previous = stabilize(previousSource)
    const worker = new Worker(
      resolve(
        process.cwd(),
        'vue/packages/wasm/markdown-projection.worker-node.mjs',
      ),
    )
    expect(worker.threadId).not.toBe(threadId)
    const commits: Array<{ ok: boolean; reason?: string }> = []
    const workerErrors: unknown[] = []
    worker.on('error', (error) => {
      workerErrors.push(error)
    })
    try {
      const host = connectMarkdownProjectionWorker({
        documentIdentity: document,
        worker: {
          postMessage(message) {
            worker.postMessage(message)
          },
          on(type, listener) {
            if (type === 'message') {
              worker.on('message', listener)
            }
          },
        },
        onCommit(result) {
          commits.push(
            'reason' in result
              ? { ok: false, reason: result.reason }
              : { ok: true },
          )
        },
      })

      host.dispatch({
        previous,
        previousSource,
        change: { from: 5, to: 5, insert: 'x' },
        source: applyChange(previousSource, { from: 5, to: 5, insert: 'x' }),
      })
      host.dispatch({
        previous,
        previousSource,
        change: { from: 5, to: 5, insert: 'xy' },
        source: applyChange(previousSource, { from: 5, to: 5, insert: 'xy' }),
      })

      const started = Date.now()
      while (commits.length < 2 && Date.now() - started < 5000) {
        await wait(20)
      }

      expect(workerErrors).toEqual([])
      expect(commits.length).toBeGreaterThanOrEqual(1)
      expect(commits.filter((commit) => commit.ok).length).toBe(1)
      expect(
        commits.some((commit) => commit.ok === false) || commits.length === 1,
      ).toBe(true)
    } finally {
      await worker.terminate()
    }
  })

  it('does not treat a main-thread full reparse as the worker entry', () => {
    const previousSource = `${'word '.repeat(80)}\n\n# Heading\n`
    const previous = stabilize(previousSource)
    const plan = planMarkdownProjectionInvalidation({
      identity: document,
      revision: 3,
      previousSource,
      change: { from: 4, to: 4, insert: 'x' },
      previous,
    })
    expect(plan.expanded).toBe(false)
    expect(plan.budget.scannedBytes).toBeLessThan(previousSource.length)
    expect(handleMarkdownProjectionWorkerMessage({ type: 'nope' })).toBeNull()
    const request = {
      type: 'project' as const,
      taskId: plan.taskId,
      revision: plan.revision,
      documentIdentity: document,
      source: applyChange(previousSource, { from: 4, to: 4, insert: 'x' }),
      plan: {
        taskId: plan.taskId,
        revision: plan.revision,
        documentIdentity: document,
        expanded: plan.expanded,
        reason: plan.reason,
        invalidatedRanges: plan.invalidatedRanges,
        invalidatedNodeIds: plan.invalidatedNodeIds,
        retainedNodeIds: plan.retainedNodeIds,
      },
      previous: {
        documentIdentity: document,
        normalizedSource: previous.normalizedSource,
        nodes: previous.nodes.map((node) => ({
          id: node.id,
          kind: node.kind,
          normalizedRange: node.normalizedRange,
          rawRange: node.rawRange,
        })),
      },
    }
    const result = handleMarkdownProjectionWorkerMessage(request)
    expect(result?.revision).toBe(3)
    expect((result as MarkdownProjectionWorkerResult).nodeIds.length).toBeGreaterThan(0)
  })
})
