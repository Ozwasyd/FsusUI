import { resolve } from 'node:path'
import { threadId, Worker } from 'node:worker_threads'

import { describe, expect, it } from 'vitest'

import {
  connectMarkdownProjectionWorker,
  createMarkdownEditorProjection,
  evaluateMarkdownProjectionKeystrokeMutations,
  markdownKeystrokeFullReparseRejected,
  markdownKeystrokePlanStaysBounded,
  stabilizeMarkdownEditorProjection,
} from '../markdown-runtime'

const document = { id: 'doc-1', epoch: 2 }

const applyChange = (
  source: string,
  change: { from: number; to: number; insert: string },
) => source.slice(0, change.from) + change.insert + source.slice(change.to)

const wait = (ms: number) => new Promise((resolveWait) => setTimeout(resolveWait, ms))

describe('markdown projection keystroke mutations', () => {
  it('rejects every-keystroke full reparse, fake local evidence, and stale commits', () => {
    const source = `${'word '.repeat(40)}\n\n# Heading\n\nA paragraph.\n\nTail stays.\n`
    const paragraph = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      document,
    ).nodes.find((node) => node.kind === 'paragraph' && node.rawRange.start > 20)
    expect(paragraph).toBeDefined()

    const from = paragraph!.rawRange.start + 2
    const report = evaluateMarkdownProjectionKeystrokeMutations({
      source,
      documentIdentity: document,
      from,
      typed: 'keystroke',
    })
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )

    expect(report.strokes).toHaveLength(9)
    expect(
      report.strokes.every((stroke) =>
        markdownKeystrokePlanStaysBounded(stroke.plan, stroke.source),
      ),
    ).toBe(true)
    expect(report.strokes.every((stroke) => stroke.plan.reason === 'local-edit')).toBe(
      true,
    )
    expect(markdownKeystrokeFullReparseRejected(report)).toBe(true)
    expect(byKind['every-keystroke-full-reparse']?.accepted).toBe(false)
    expect(byKind['fake-local-evidence']?.accepted).toBe(false)
    expect(byKind['stale-worker-commit']?.accepted).toBe(false)
    expect(report.commits.filter((commit) => commit.ok)).toHaveLength(1)
    expect(report.commits.filter((commit) => commit.ok)[0]?.revision).toBe(9)
  })

  it('runs the typed sequence on the dedicated worker thread and still rejects stale work', async () => {
    const source = 'Hello world.\n\n# Tail\n'
    const previous = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      document,
    )
    const worker = new Worker(
      resolve(
        process.cwd(),
        'vue/packages/wasm/markdown-projection.worker-node.mjs',
      ),
    )
    expect(worker.threadId).not.toBe(threadId)
    const commits: Array<{ ok: boolean; revision?: number }> = []
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
            result.ok
              ? { ok: true, revision: result.value.revision }
              : { ok: false },
          )
        },
      })

      let current = source
      for (const [index, insert] of ['x', 'y', 'z'].entries()) {
        const change = { from: 5 + index, to: 5 + index, insert }
        const next = applyChange(current, change)
        const plan = host.dispatch({
          previous,
          previousSource: current,
          change,
          source: next,
        })
        expect(markdownKeystrokePlanStaysBounded(plan, next)).toBe(true)
        current = next
      }

      const started = Date.now()
      while (commits.length < 3 && Date.now() - started < 5000) {
        await wait(20)
      }

      expect(workerErrors).toEqual([])
      expect(commits.filter((commit) => commit.ok)).toHaveLength(1)
      expect(commits.some((commit) => commit.ok && commit.revision === 3)).toBe(true)
    } finally {
      await worker.terminate()
    }
  })
})
