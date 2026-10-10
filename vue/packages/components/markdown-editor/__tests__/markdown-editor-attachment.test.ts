import { describe, expect, it } from 'vitest'

import {
  captureMarkdownAttachmentInput,
  commitMarkdownAttachmentResult,
  createMarkdownAttachmentAtomicPresentation,
  createMarkdownAttachmentBatch,
  createMarkdownAttachmentCaptureSession,
  createMarkdownAttachmentRequest,
  createMarkdownAttachmentSession,
  evaluateMarkdownAttachmentAcceptance,
  evaluateMarkdownAttachmentCaptureMutations,
  evaluateMarkdownAttachmentMutations,
  evaluateMarkdownAttachmentPresentationMutations,
  markdownFromAttachmentPayload,
  queryMarkdownAttachmentUnfinishedCount,
  validateMarkdownAttachmentPrepublish,
} from '../src/markdown-editor-attachment'
import {
  cancelMarkdownAttachmentJob,
  createMarkdownAttachmentJob,
  evaluateMarkdownAttachmentLifecycleMutations,
  formatMarkdownAttachmentPendingSource,
  planMarkdownAttachmentInsert,
  planMarkdownAttachmentRemove,
  planMarkdownAttachmentResolve,
  progressMarkdownAttachmentJob,
  rebaseMarkdownAttachmentJob,
  retryMarkdownAttachmentJob,
} from '../src/markdown-editor-attachment-lifecycle'
import { getMarkdownXssSourceUrl } from '../../../../tests/support/markdown-xss-corpus'

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
    expect(
      report.mutations.every((mutation) => mutation.accepted === false),
    ).toBe(true)
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
    expect(batch.items.map((item) => item.kind)).toEqual([
      'file',
      'image',
      'audio',
    ])
    expect(batch.anchor.nodeId).toBe('syn:doc:2:para:0')
    expect('files' in batch).toBe(false)
    expect(
      markdownFromAttachmentPayload({
        markdownKind: 'file',
        href: 'https://cdn.example/spec.pdf',
        mimeType: 'application/pdf',
        name: 'spec.pdf',
      }),
    ).toBe('[spec.pdf](https://cdn.example/spec.pdf)')
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
            href: getMarkdownXssSourceUrl('mxss-url-javascript-link'),
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

describe('attachment input capture and deduplication (#375)', () => {
  it('creates unified batch intent across pick, paste, and drop', () => {
    const files = [
      { name: 'doc.pdf', mimeType: 'application/pdf', byteLength: 500 },
      { name: 'img.png', mimeType: 'image/png', byteLength: 200 },
    ]

    for (const sourceKind of ['pick', 'paste', 'drop'] as const) {
      const result = captureMarkdownAttachmentInput({
        sourceKind,
        documentIdentity: identity,
        revision: 3,
        anchor: { range: { start: 10, end: 10 }, nodeId: 'syn:p:1' },
        files,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.batch.sourceKind).toBe(sourceKind)
      expect(result.batch.items).toHaveLength(2)
      expect(result.batch.items[0]?.name).toBe('doc.pdf')
      expect(result.batch.items[0]?.kind).toBe('file')
      expect(result.batch.items[1]?.name).toBe('img.png')
      expect(result.batch.items[1]?.kind).toBe('image')
      expect(result.batch.anchor.range).toEqual({ start: 10, end: 10 })
    }
  })

  it('deduplicates identical events using event fingerprint', () => {
    const input = {
      sourceKind: 'drop' as const,
      documentIdentity: identity,
      revision: 1,
      anchor: { range: { start: 0, end: 0 } },
      files: [{ name: 'photo.jpg', mimeType: 'image/jpeg', byteLength: 1000 }],
      eventFingerprint: 'event-drop-unique-99',
      session: createMarkdownAttachmentCaptureSession(),
    }

    const first = captureMarkdownAttachmentInput(input)
    expect(first.ok).toBe(true)

    const duplicate = captureMarkdownAttachmentInput(input)
    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) {
      expect((duplicate as { rejected?: string }).rejected).toBe(
        'duplicate-event',
      )
    }
  })

  it('rejects readonly, disabled, preview, composing, stale document, and empty files', () => {
    const base = {
      sourceKind: 'paste' as const,
      documentIdentity: identity,
      revision: 2,
      anchor: { range: { start: 0, end: 0 } },
      files: [{ name: 'a.png', mimeType: 'image/png', byteLength: 100 }],
    }

    expect(
      captureMarkdownAttachmentInput({ ...base, context: { readonly: true } }),
    ).toMatchObject({
      ok: false,
      rejected: 'readonly',
    })
    expect(
      captureMarkdownAttachmentInput({ ...base, context: { disabled: true } }),
    ).toMatchObject({
      ok: false,
      rejected: 'disabled',
    })
    expect(
      captureMarkdownAttachmentInput({ ...base, context: { mode: 'preview' } }),
    ).toMatchObject({
      ok: false,
      rejected: 'preview',
    })
    expect(
      captureMarkdownAttachmentInput({
        ...base,
        context: { isComposing: true },
      }),
    ).toMatchObject({
      ok: false,
      rejected: 'composition-active',
    })
    expect(
      captureMarkdownAttachmentInput({
        ...base,
        context: { currentRevision: 5 },
      }),
    ).toMatchObject({
      ok: false,
      rejected: 'stale-document',
    })
    expect(
      captureMarkdownAttachmentInput({ ...base, files: [] }),
    ).toMatchObject({
      ok: false,
      rejected: 'empty-files',
    })
  })

  it('kills dom-positioning, duplicate-events, data-url, and stale-capture mutations', () => {
    const report = evaluateMarkdownAttachmentCaptureMutations()
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'dom-positioning',
      'duplicate-events',
      'data-url',
      'stale-capture',
    ])
    for (const m of report.mutations) {
      expect(m.accepted).toBe(false)
      expect(m.equivalent).toBe(false)
    }
  })
})

describe('attachment lifecycle, transactions, and undo (#376)', () => {
  it('plans insertion of pending representation without consumer private scheme', () => {
    const batch = createMarkdownAttachmentBatch({
      sourceKind: 'drop',
      documentIdentity: identity,
      revision: 1,
      range: { start: 5, end: 5 },
      items: [
        {
          name: 'chart.png',
          mimeType: 'image/png',
          byteLength: 300,
          kind: 'image',
        },
        {
          name: 'data.csv',
          mimeType: 'text/csv',
          byteLength: 100,
          kind: 'file',
        },
      ],
    })

    const plan = planMarkdownAttachmentInsert(
      'hello world',
      batch.anchor,
      batch,
      (name) => `Uploading ${name}...`,
    )
    expect(plan.transaction.changes).toHaveLength(1)
    const inserted = plan.transaction.changes[0]!.insert
    expect(inserted).toContain('![Uploading chart.png...]()')
    expect(inserted).toContain('[Uploading data.csv...]()')
    expect(inserted).not.toContain('fsusblog:')
    expect(inserted).not.toContain('data:')
    expect(inserted).not.toContain('<')
    expect(plan.jobs).toHaveLength(2)
    expect(plan.jobs[0]?.phase).toBe('pending')
    expect(plan.jobs[0]?.range).toBeDefined()
  })

  it('rebases job ranges through source changes and detects full deletion', () => {
    const job = createMarkdownAttachmentJob('j1', {
      range: { start: 10, end: 35 },
    })

    rebaseMarkdownAttachmentJob(job, [
      { from: 0, to: 5, insert: 'longer text' },
    ])
    expect(job.range).toEqual({ start: 16, end: 41 })
    expect(job.phase).toBe('pending')

    rebaseMarkdownAttachmentJob(job, [{ from: 10, to: 50, insert: '' }])
    expect(job.phase).toBe('deleted')
  })

  it('resolves provider result and prevents resurrection if job was deleted or cancelled', () => {
    const job = createMarkdownAttachmentJob('j2', {
      batchId: 'b:1',
      documentIdentity: identity,
      revision: 1,
      range: { start: 5, end: 30 },
    })

    const resolveResult = {
      status: 'resolved' as const,
      batchId: 'b:1',
      itemId: 'j2',
      documentIdentity: identity,
      revision: 1,
      payload: {
        markdownKind: 'image' as const,
        href: 'https://cdn.example/final.png',
        alt: 'final image',
        mimeType: 'image/png',
      },
    }

    const resolvePlan = planMarkdownAttachmentResolve(
      'source',
      job,
      resolveResult,
    )
    expect(resolvePlan.accepted).toBe(true)
    expect(resolvePlan.status).toBe('resolved')
    expect(resolvePlan.transaction?.changes[0]?.insert).toBe(
      '![final image](https://cdn.example/final.png)',
    )
    expect(job.phase).toBe('resolved')

    // Deleted job will NOT resurrect
    const deletedJob = createMarkdownAttachmentJob('j3', {
      batchId: 'b:1',
      documentIdentity: identity,
      revision: 1,
      range: { start: 5, end: 30 },
    })
    deletedJob.phase = 'deleted'
    const rejectedResolve = planMarkdownAttachmentResolve(
      'source',
      deletedJob,
      resolveResult,
    )
    expect(rejectedResolve.accepted).toBe(false)
    expect(rejectedResolve.status).toBe('deleted')
    expect(rejectedResolve.transaction).toBeUndefined()

    // Cancelled job will NOT resurrect
    const cancelledJob = createMarkdownAttachmentJob('j4', {
      batchId: 'b:1',
      documentIdentity: identity,
      revision: 1,
      range: { start: 5, end: 30 },
    })
    cancelMarkdownAttachmentJob(cancelledJob)
    expect(cancelledJob.phase).toBe('cancelled')
    const cancelledResolve = planMarkdownAttachmentResolve(
      'source',
      cancelledJob,
      resolveResult,
    )
    expect(cancelledResolve.accepted).toBe(false)
    expect(cancelledResolve.status).toBe('cancelled')

    // Retry resets phase to pending and increments attempt
    retryMarkdownAttachmentJob(cancelledJob)
    expect(cancelledJob.phase).toBe('pending')
    expect(cancelledJob.attempt).toBe(2)
  })

  it('kills stale-completion, undo-resurrection, consumer-scheme, and duplicate-attempt', () => {
    const report = evaluateMarkdownAttachmentLifecycleMutations()
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'library-owned-store',
      'stale-completion',
      'undo-resurrection',
      'consumer-scheme',
      'duplicate-attempt',
    ])
    for (const m of report.mutations) {
      expect(m.accepted).toBe(false)
      expect(m.equivalent).toBe(false)
    }
  })
})

describe('attachment atomic presentation and total acceptance (#377)', () => {
  it('creates compact atomic presentation with visible actions and touch target >= 44px', () => {
    const pendingPresentation = createMarkdownAttachmentAtomicPresentation({
      itemId: 'item:1',
      name: 'diagram.svg',
      kind: 'image',
      status: 'progress',
      progress: 45,
      copy: {
        actions: { cancel: 'Cancel', remove: 'Remove', retry: 'Retry' },
        status: (name, status, percent) =>
          status === 'rejected'
            ? `${name} upload failed`
            : `${name}: ${percent}% uploaded`,
      },
    })

    expect(pendingPresentation.compact).toBe(true)
    expect(pendingPresentation.isLargeCard).toBe(false)
    expect(pendingPresentation.hasGradientOrGlow).toBe(false)
    expect(pendingPresentation.actions.some((a) => a.key === 'cancel')).toBe(
      true,
    )
    expect(
      pendingPresentation.actions.every((a) => a.minTouchTargetPx >= 44),
    ).toBe(true)
    expect(pendingPresentation.statusAriaLive).toBe('polite')
    expect(pendingPresentation.progressAriaText).toBe(
      'diagram.svg: 50% uploaded',
    )

    const failedPresentation = createMarkdownAttachmentAtomicPresentation({
      itemId: 'item:2',
      name: 'report.pdf',
      kind: 'file',
      status: 'rejected',
      progress: 0,
      copy: {
        actions: { cancel: 'Cancel', remove: 'Remove', retry: 'Retry' },
        status: (name, status, percent) =>
          status === 'rejected'
            ? `${name} upload failed`
            : `${name}: ${percent}% uploaded`,
      },
    })
    expect(failedPresentation.actions.some((a) => a.key === 'retry')).toBe(true)
    expect(failedPresentation.actions.some((a) => a.key === 'remove')).toBe(
      true,
    )
    expect(failedPresentation.progressAriaText).toBe('report.pdf upload failed')
  })

  it('validates prepublish checks and reports unfinished count', () => {
    const query = queryMarkdownAttachmentUnfinishedCount([
      { status: 'pending' },
      { status: 'progress' },
      { status: 'resolved' },
      { status: 'rejected' },
    ])
    expect(query.pendingCount).toBe(2)
    expect(query.failedCount).toBe(1)
    expect(query.totalCount).toBe(4)

    const blocked = validateMarkdownAttachmentPrepublish([
      { status: 'progress' },
      { status: 'resolved' },
    ])
    expect(blocked.canPrepublish).toBe(false)
    expect(blocked.reason).toContain('still uploading')

    const ready = validateMarkdownAttachmentPrepublish([
      { status: 'resolved' },
      { status: 'resolved' },
    ])
    expect(ready.canPrepublish).toBe(true)
  })

  it('kills protocol-leak, hover-only, large-card, scroll-jump, and private-dom mutations', () => {
    const report = evaluateMarkdownAttachmentPresentationMutations()
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'protocol-leak',
      'hover-only',
      'large-card',
      'scroll-jump',
      'private-dom',
    ])
    for (const m of report.mutations) {
      expect(m.accepted).toBe(false)
      expect(m.equivalent).toBe(false)
    }
  })

  it('evaluates total acceptance across full matrix and kills all mutation sets', () => {
    const acceptance = evaluateMarkdownAttachmentAcceptance()
    expect(acceptance.accepted).toBe(true)
    expect(acceptance.version).toBe('markdown-attachment-acceptance@2026-08-16')
    expect(acceptance.mutationsKilled).toBe(true)
    expect(acceptance.matrix.inputs).toEqual(['pick', 'paste', 'drop'])
    expect(acceptance.matrix.surfaces).toEqual(['source', 'live', 'split'])
    expect(acceptance.matrix.accessibility).toEqual({
      screenReaderNonFlooding: true,
      touchTargetMeetsBudget: true,
      nonHoverOnly: true,
    })
  })
})

describe('attachment capture signal binding', () => {
  it('keeps supplied batch and independent item signals without exposing Files', () => {
    const batchController = new AbortController()
    const controllers = [new AbortController(), new AbortController()]
    const result = captureMarkdownAttachmentInput({
      sourceKind: 'pick',
      documentIdentity: identity,
      revision: 4,
      anchor: { range: { start: 0, end: 0 } },
      signal: batchController.signal,
      files: controllers.map((controller) => ({
        name: 'same.png',
        type: 'image/png',
        size: 1,
        signal: controller.signal,
      })),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('capture rejected')
    expect(result.batch.signal).toBe(batchController.signal)
    expect(result.batch.items.map((item) => item.signal)).toEqual(
      controllers.map((controller) => controller.signal),
    )
    controllers[0]!.abort()
    expect(result.batch.items[0]!.signal.aborted).toBe(true)
    expect(result.batch.items[1]!.signal.aborted).toBe(false)
    expect(result.batch.signal.aborted).toBe(false)
    expect('files' in result.batch).toBe(false)
  })
})
