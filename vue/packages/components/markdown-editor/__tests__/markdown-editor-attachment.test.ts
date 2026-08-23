import { describe, expect, it } from 'vitest'

import {
  commitMarkdownAttachmentResult,
  createMarkdownAttachmentBatch,
  createMarkdownAttachmentRequest,
  createMarkdownAttachmentSession,
  evaluateMarkdownAttachmentMutations,
  markdownFromAttachmentPayload,
} from '../src/markdown-editor-attachment'
import {
  cancelMarkdownAttachmentJob,
  createMarkdownAttachmentJob,
  progressMarkdownAttachmentJob,
} from '../src/markdown-editor-attachment-lifecycle'

const identity = { id: 'doc', epoch: 2 }

describe('markdown attachment provider contract', () => {
  it('keeps consumer-owned request identity', () => {
    const request = createMarkdownAttachmentRequest(
      'paste',
      {
        documentIdentity: { id: 'doc', epoch: 1 },
        revision: 2,
        nodeId: null,
        sourceOffset: 4,
      },
      'image/png',
    )
    expect(request.requestId).toContain('doc')
    expect(request.intent).toBe('paste')
    const report = evaluateMarkdownAttachmentMutations(request)
    expect(report.mutations.every((mutation) => mutation.accepted === false)).toBe(true)
    const job = createMarkdownAttachmentJob('att-1')
    progressMarkdownAttachmentJob(job, 40)
    expect(job.phase).toBe('progress')
    cancelMarkdownAttachmentJob(job)
    expect(job.phase).toBe('cancelled')
  })

  it('orders batch items and does not assume every attachment is an image', () => {
    const batch = createMarkdownAttachmentBatch({
      sourceKind: 'drop',
      documentIdentity: identity,
      revision: 4,
      nodeId: 'syn:doc:2:para:0',
      range: { start: 8, end: 8 },
      items: [
        { mimeType: 'application/pdf', name: 'spec.pdf', byteLength: 1200 },
        { mimeType: 'image/png', name: 'shot.png', byteLength: 80 },
        { mimeType: 'audio/mpeg', name: 'note.mp3', byteLength: 400 },
      ],
    })
    expect(batch.items.map((item) => item.order)).toEqual([0, 1, 2])
    expect(batch.items.map((item) => item.itemId)).toEqual([
      `${batch.batchId}:0`,
      `${batch.batchId}:1`,
      `${batch.batchId}:2`,
    ])
    expect(batch.items.map((item) => item.kind)).toEqual(['file', 'image', 'audio'])
    expect(batch.anchor.nodeId).toBe('syn:doc:2:para:0')
    expect('files' in batch).toBe(false)
    expect(markdownFromAttachmentPayload({
      markdownKind: 'file',
      href: 'https://cdn.example/spec.pdf',
      mimeType: 'application/pdf',
      name: 'spec.pdf',
    })).toBe('[spec.pdf](https://cdn.example/spec.pdf)')
  })

  it('rejects stale, deleted, other-document, and unsafe provider results', () => {
    const batch = createMarkdownAttachmentBatch({
      sourceKind: 'paste',
      documentIdentity: identity,
      revision: 4,
      range: { start: 0, end: 0 },
      items: [{ mimeType: 'image/png', name: 'a.png', byteLength: 10 }],
    })
    const resolved = {
      status: 'resolved' as const,
      batchId: batch.batchId,
      itemId: batch.items[0]!.itemId,
      documentIdentity: identity,
      revision: 4,
      payload: {
        markdownKind: 'image' as const,
        href: 'https://cdn.example/a.png',
        mimeType: 'image/png',
        alt: 'a',
      },
    }
    expect(
      commitMarkdownAttachmentResult({
        documentIdentity: identity,
        revision: 4,
        result: resolved,
      }).accepted,
    ).toBe(true)
    expect(
      commitMarkdownAttachmentResult({
        documentIdentity: identity,
        revision: 9,
        result: resolved,
      }),
    ).toMatchObject({ accepted: false, status: 'stale' })
    expect(
      commitMarkdownAttachmentResult({
        documentIdentity: identity,
        revision: 4,
        nodeStatus: 'deleted',
        result: resolved,
      }),
    ).toMatchObject({ accepted: false, status: 'deleted' })
    expect(
      commitMarkdownAttachmentResult({
        documentIdentity: { id: 'other', epoch: 2 },
        revision: 4,
        result: resolved,
      }),
    ).toMatchObject({ accepted: false, status: 'document-abort' })
    expect(
      commitMarkdownAttachmentResult({
        documentIdentity: identity,
        revision: 4,
        result: {
          ...resolved,
          payload: {
            markdownKind: 'image',
            href: 'javascript:alert(1)',
            mimeType: 'image/png',
          },
        },
      }),
    ).toMatchObject({ accepted: false, status: 'unsafe' })

    const session = createMarkdownAttachmentSession()
    session.register(batch)
    expect(session.query(batch.items[0]!.itemId)?.status).toBe('pending')
    session.record({
      status: 'rejected',
      batchId: batch.batchId,
      itemId: batch.items[0]!.itemId,
      code: 'too-large',
    })
    const queried = session.query(batch.items[0]!.itemId)
    expect(queried?.status).toBe('rejected')
    expect(queried?.code).toBe('too-large')
    expect(Object.isFrozen(queried)).toBe(true)
  })

  it('kills File[] half-migration, consumer source writes, HTML results, and bare offsets', () => {
    const request = createMarkdownAttachmentRequest(
      'pick',
      {
        documentIdentity: identity,
        revision: 1,
        nodeId: 'syn:doc:2:para:1',
        sourceOffset: 3,
      },
      'application/pdf',
    )
    const report = evaluateMarkdownAttachmentMutations(request)
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'file-array-half-migration',
      'consumer-source-mutation',
      'arbitrary-html',
      'bare-offset',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
