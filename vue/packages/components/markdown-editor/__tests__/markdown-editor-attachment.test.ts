import { describe, expect, it } from 'vitest'

import {
  bindMarkdownAttachmentConsumerRequest,
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
  type MarkdownAttachmentConsumerRequest,
  type MarkdownAttachmentConsumerRequestBinding,
  type MarkdownAttachmentProviderResult,
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

describe('original attachment consumer request capabilities', () => {
  const resources = () => ({
    backgroundTasks: 1,
    timers: 0,
    observers: 0,
    retainedListeners: 0,
    networkRequests: 1,
    memoryUnits: 1,
  })
  const request = (): MarkdownAttachmentConsumerRequest => ({
    result: new Promise<MarkdownAttachmentProviderResult>(() => {}),
    settled: new Promise<void>(() => {}),
    cancelLocal() {},
    inspectLocalResources: resources,
  })
  const bind = (
    original: unknown,
  ): MarkdownAttachmentConsumerRequestBinding => {
    const admission = bindMarkdownAttachmentConsumerRequest(original)
    expect(admission.supported).toBe(true)
    if (admission.supported === false) throw new Error(admission.reason)
    return admission.value
  }

  it('preserves unknown void, bare futures and incomplete original handles', () => {
    const original = request()
    for (const value of [
      undefined,
      null,
      original.result,
      { result: original.result },
    ]) {
      const admission = bindMarkdownAttachmentConsumerRequest(value)
      expect(admission.supported).toBe(false)
      expect(admission.value).toBe(value)
    }
  })

  it('retains the identical request and both futures without subscribing', () => {
    let subscriptions = 0
    const original = {
      result: {
        then() {
          subscriptions += 1
        },
      },
      settled: {
        then() {
          subscriptions += 1
        },
      },
      cancelLocal() {},
      inspectLocalResources: resources,
    }
    const bound = bind(original)
    expect(bound.request).toBe(original)
    expect(bound.result).toBe(original.result)
    expect(bound.settled).toBe(original.settled)
    expect(subscriptions).toBe(0)
    expect(
      bindMarkdownAttachmentConsumerRequest({
        ...original,
        settled: original.result,
      }).supported,
    ).toBe(false)
  })

  it('forwards original local cancellation without acknowledging settlement', async () => {
    let finish!: () => void
    let completed = false
    let receiver: unknown
    let reason: unknown
    const original = {
      ...request(),
      settled: new Promise<void>((resolve) => {
        finish = resolve
      }),
      cancelLocal(this: unknown, value?: string) {
        receiver = this
        reason = value
      },
    }
    void original.settled.then(() => {
      completed = true
    })
    const bound = bind(original)
    bound.cancelLocal('local-pause')
    expect(receiver).toBe(original)
    expect(reason).toBe('local-pause')
    expect(completed).toBe(false)
    expect(bound.inspectLocalResources()).toEqual({
      supported: true,
      value: resources(),
    })
    finish()
    await bound.settled
    expect(completed).toBe(true)
  })

  it('refuses accessor capabilities without evaluating them', () => {
    let reads = 0
    const original = request()
    Object.defineProperty(original, 'cancelLocal', {
      get() {
        reads += 1
        return () => {}
      },
    })
    expect(bindMarkdownAttachmentConsumerRequest(original).supported).toBe(
      false,
    )
    expect(reads).toBe(0)
  })

  it('never converts missing or unknown census into zero', () => {
    for (const returned of [
      undefined,
      {},
      { ...resources(), networkRequests: null },
      { ...resources(), timers: -1 },
    ]) {
      const bound = bind({
        ...request(),
        inspectLocalResources: () => returned,
      })
      expect(bound.inspectLocalResources().supported).toBe(false)
    }
    let reads = 0
    const returned = resources()
    Object.defineProperty(returned, 'memoryUnits', {
      get() {
        reads += 1
        return 0
      },
    })
    expect(
      bind({
        ...request(),
        inspectLocalResources: () => returned,
      }).inspectLocalResources().supported,
    ).toBe(false)
    expect(reads).toBe(0)
  })

  it('keeps an observed stale port stale and retains original cleanup', () => {
    let originalCancelled = 0
    let replacementCancelled = 0
    const original = {
      ...request(),
      cancelLocal() {
        originalCancelled += 1
      },
    }
    const pinned = original.cancelLocal
    const bound = bind(original)
    original.cancelLocal = () => {
      replacementCancelled += 1
    }
    expect(bound.inspectLocalResources().supported).toBe(false)
    original.cancelLocal = pinned
    expect(bound.inspectLocalResources().supported).toBe(false)
    bound.cancelLocal()
    expect([originalCancelled, replacementCancelled]).toEqual([1, 0])
  })

  it('refuses callback reentry before invoking nested cancellation', () => {
    let cancellations = 0
    let bound!: MarkdownAttachmentConsumerRequestBinding
    bound = bind({
      ...request(),
      cancelLocal() {
        cancellations += 1
      },
      inspectLocalResources() {
        expect(() => bound.cancelLocal()).toThrow(
          'attachment-consumer-request-reentry',
        )
        return resources()
      },
    })
    expect(bound.inspectLocalResources().supported).toBe(true)
    expect(cancellations).toBe(0)
  })

  it('refuses absent, incomplete and null checkpoints', () => {
    for (const checkpoint of [
      undefined,
      { capture: () => ({}) },
      { capture: () => null, recreate: () => request(), release() {} },
    ]) {
      const bound = bind({ ...request(), checkpoint })
      expect(bound.captureCheckpoint().supported).toBe(false)
    }
  })

  it('recreates only the original opaque pointer with the original port receiver', () => {
    let bodyReads = 0
    const opaque = Object.defineProperty({}, 'body', {
      get() {
        bodyReads += 1
        return 'body'
      },
    })
    const next = request()
    const calls: unknown[][] = []
    const port = {
      capture() {
        return opaque
      },
      recreate(this: unknown, checkpoint: object) {
        calls.push([this, checkpoint])
        return next
      },
      release(this: unknown, checkpoint: object) {
        calls.push([this, checkpoint])
      },
    }
    const bound = bind({ ...request(), checkpoint: port })
    expect(bound.captureCheckpoint()).toEqual({
      supported: true,
      value: opaque,
    })
    expect(bound.recreateCheckpoint({}).supported).toBe(false)
    expect(calls).toHaveLength(0)
    const recreated = bound.recreateCheckpoint(opaque)
    expect(recreated.supported).toBe(true)
    if (recreated.supported === false) throw new Error(recreated.reason)
    expect(recreated.value.request).toBe(next)
    expect(bound.recreateCheckpoint(opaque).supported).toBe(false)
    bound.releaseCheckpoint(opaque)
    expect(calls).toEqual([
      [port, opaque],
      [port, opaque],
    ])
    expect(bodyReads).toBe(0)
  })

  it('consumes a failed recreation without discarding its unknown child', () => {
    const opaque = {}
    const unknownChild = { pending: true }
    let invoked = 0
    const bound = bind({
      ...request(),
      checkpoint: {
        capture: () => opaque,
        recreate() {
          invoked += 1
          return unknownChild
        },
        release() {},
      },
    })
    bound.captureCheckpoint()
    const failed = bound.recreateCheckpoint(opaque)
    expect(failed.supported).toBe(false)
    expect(failed.value).toBe(unknownChild)
    expect(bound.recreateCheckpoint(opaque).supported).toBe(false)
    expect(invoked).toBe(1)
  })

  it('retains a failed original checkpoint release for actual retry', () => {
    const opaque = {}
    let releases = 0
    let retained = true
    const bound = bind({
      ...request(),
      inspectLocalResources: () => ({
        ...resources(),
        memoryUnits: retained ? 1 : 0,
      }),
      checkpoint: {
        capture: () => opaque,
        recreate: () => request(),
        release(checkpoint: object) {
          expect(checkpoint).toBe(opaque)
          releases += 1
          if (releases === 1) throw new Error('native-release-failed')
          retained = false
        },
      },
    })
    bound.captureCheckpoint()
    expect(() => bound.releaseCheckpoint(opaque)).toThrow(
      'native-release-failed',
    )
    expect(bound.inspectLocalResources()).toEqual({
      supported: false,
      reason: 'consumer-cleanup-unsettled',
      value: bound.request,
    })
    expect(bound.request.inspectLocalResources().memoryUnits).toBe(1)
    bound.releaseCheckpoint(opaque)
    expect(releases).toBe(2)
    expect(() => bound.releaseCheckpoint(opaque)).toThrow(
      'attachment-consumer-checkpoint-foreign',
    )
  })

  it('does not remint a released checkpoint returned again by its original port', () => {
    const opaque = {}
    const bound = bind({
      ...request(),
      checkpoint: {
        capture: () => opaque,
        recreate: () => request(),
        release() {},
      },
    })
    expect(bound.captureCheckpoint().supported).toBe(true)
    bound.releaseCheckpoint(opaque)
    expect(bound.captureCheckpoint().supported).toBe(false)
    expect(bound.recreateCheckpoint(opaque).supported).toBe(false)
    bound.releaseCheckpoint(opaque)
  })

  it('retires recreation while retaining original census, futures and cleanup', () => {
    const opaque = {}
    let cleaned = 0
    const original = {
      ...request(),
      cancelLocal() {
        cleaned += 1
      },
      checkpoint: {
        capture: () => opaque,
        recreate: () => request(),
        release() {
          cleaned += 1
        },
      },
    }
    const bound = bind(original)
    bound.captureCheckpoint()
    bound.retire()
    expect(bound.captureCheckpoint().supported).toBe(false)
    expect(bound.recreateCheckpoint(opaque).supported).toBe(false)
    expect(bound.inspectLocalResources().supported).toBe(true)
    expect(bound.settled).toBe(original.settled)
    bound.cancelLocal()
    bound.releaseCheckpoint(opaque)
    expect(cleaned).toBe(2)
  })

  it('does not revive observed stale checkpoint methods after property restoration', () => {
    const opaque = {}
    const port = {
      capture: () => opaque,
      recreate: () => request(),
      release() {},
    }
    const pinned = port.recreate
    const bound = bind({ ...request(), checkpoint: port })
    bound.captureCheckpoint()
    port.recreate = () => request()
    expect(bound.recreateCheckpoint(opaque).supported).toBe(false)
    port.recreate = pinned
    expect(bound.recreateCheckpoint(opaque).supported).toBe(false)
    bound.releaseCheckpoint(opaque)
  })

  it('preserves cancellation failure without granting recreation or settlement', () => {
    const opaque = {}
    const original = {
      ...request(),
      cancelLocal() {
        throw new Error('native-cancel-failed')
      },
      checkpoint: {
        capture: () => opaque,
        recreate: () => request(),
        release() {},
      },
    }
    const bound = bind(original)
    bound.captureCheckpoint()
    expect(() => bound.cancelLocal()).toThrow('native-cancel-failed')
    expect(bound.recreateCheckpoint(opaque).supported).toBe(false)
    expect(bound.settled).toBe(original.settled)
    bound.releaseCheckpoint(opaque)
  })

  it('returns a stale capture pointer and exposes its pinned cleanup after capability mutation', () => {
    const opaque = {}
    const released: object[] = []
    const original = {
      ...request(),
      checkpoint: {
        capture() {
          original.inspectLocalResources = () => resources()
          return opaque
        },
        recreate: () => request(),
        release(checkpoint: object) {
          released.push(checkpoint)
        },
      },
    }
    const bound = bind(original)
    const failed = bound.captureCheckpoint()
    expect(failed.supported).toBe(false)
    expect(failed.value).toBe(opaque)
    expect(bound.getRetainedCheckpoint()).toBe(opaque)
    bound.releaseCheckpoint(opaque)
    expect(released).toEqual([opaque])
    expect(bound.getRetainedCheckpoint()).toBe(null)
  })

  it('retains an asynchronous release pointer and original failure until an actual retry settles', async () => {
    const opaque = {}
    const cause = new Error('async-release-failed')
    let reject!: (cause: unknown) => void
    let finish!: () => void
    const first = new Promise<void>((_, fail) => {
      reject = fail
    })
    const second = new Promise<void>((resolve) => {
      finish = resolve
    })
    let calls = 0
    const receivers: unknown[] = []
    const port = {
      capture: () => opaque,
      recreate: () => request(),
      release(this: unknown, checkpoint: object) {
        expect(checkpoint).toBe(opaque)
        receivers.push(this)
        calls += 1
        return calls === 1 ? first : second
      },
    }
    const bound = bind({ ...request(), checkpoint: port })
    bound.captureCheckpoint()
    expect(bound.releaseCheckpoint(opaque)).toBe(first)
    expect(bound.getRetainedCheckpoint()).toBe(opaque)
    expect(bound.inspectCleanup()[0]!.work).toBe(first)
    expect(bound.inspectCleanup()[0]!.checkpoint).toBe(opaque)
    expect(bound.inspectCleanup()[0]!.status).toBe('pending')
    expect(() => bound.releaseCheckpoint(opaque)).toThrow(
      'attachment-consumer-cleanup-unsettled',
    )
    expect(bound.inspectLocalResources().supported).toBe(false)
    reject(cause)
    await expect(first).rejects.toBe(cause)
    await bound.inspectCleanup()[0]!.observerWork
    expect(bound.inspectCleanup()[0]!.status).toBe('rejected')
    expect(bound.inspectCleanup()[0]!.cause).toBe(cause)
    expect(bound.getRetainedCheckpoint()).toBe(opaque)
    expect(bound.releaseCheckpoint(opaque)).toBe(second)
    finish()
    await second
    await bound.inspectCleanup()[0]!.observerWork
    expect(bound.getRetainedCheckpoint()).toBe(null)
    expect(bound.inspectCleanup()[0]!.status).toBe('fulfilled')
    expect(receivers).toEqual([port, port])
  })

  it('returns asynchronous cancellation work and preserves its original rejection for retry', async () => {
    const cause = new Error('async-cancel-failed')
    let reject!: (cause: unknown) => void
    let finish!: () => void
    const first = new Promise<void>((_, fail) => {
      reject = fail
    })
    const second = new Promise<void>((resolve) => {
      finish = resolve
    })
    let calls = 0
    const receivers: unknown[] = []
    const original = {
      ...request(),
      cancelLocal(this: unknown) {
        receivers.push(this)
        calls += 1
        return calls === 1 ? first : second
      },
    }
    const bound = bind(original)
    expect(bound.cancelLocal()).toBe(first)
    expect(bound.inspectCleanup()[0]!.operation).toBe('cancel')
    expect(() => bound.cancelLocal()).toThrow(
      'attachment-consumer-cleanup-unsettled',
    )
    reject(cause)
    await expect(first).rejects.toBe(cause)
    await bound.inspectCleanup()[0]!.observerWork
    expect(bound.inspectCleanup()[0]!.cause).toBe(cause)
    expect(bound.cancelLocal()).toBe(second)
    finish()
    await second
    await bound.inspectCleanup()[0]!.observerWork
    expect(bound.inspectCleanup()[0]!.status).toBe('fulfilled')
    expect(bound.result).toBe(original.result)
    expect(bound.settled).toBe(original.settled)
    expect(receivers).toEqual([original, original])
  })

  it('retains unobservable cleanup work and pointer instead of accepting a synchronous return', () => {
    const opaque = {}
    const work = { unavailable: true }
    const bound = bind({
      ...request(),
      checkpoint: {
        capture: () => opaque,
        recreate: () => request(),
        release: () => work,
      },
    })
    bound.captureCheckpoint()
    expect(() => bound.releaseCheckpoint(opaque)).toThrow(
      'attachment-consumer-cleanup-future-unavailable',
    )
    const observation = bound.inspectCleanup()[0]!
    expect(observation.work).toBe(work)
    expect(observation.checkpoint).toBe(opaque)
    expect(observation.status).toBe('unobservable')
    expect(observation.observationCause).toBeInstanceOf(Error)
    expect(bound.getRetainedCheckpoint()).toBe(opaque)
    expect(bound.inspectLocalResources().supported).toBe(false)
  })

  it('does not discard a pointer when then fulfills synchronously and subsequently throws', () => {
    const opaque = {}
    const cause = new Error('subscription-failed')
    const work = {
      then(fulfilled: () => void) {
        fulfilled()
        throw cause
      },
    }
    const bound = bind({
      ...request(),
      checkpoint: {
        capture: () => opaque,
        recreate: () => request(),
        release: () => work,
      },
    })
    bound.captureCheckpoint()
    expect(() => bound.releaseCheckpoint(opaque)).toThrow(cause)
    expect(bound.getRetainedCheckpoint()).toBe(opaque)
    expect(bound.inspectCleanup()[0]!.work).toBe(work)
    expect(bound.inspectCleanup()[0]!.observationCause).toBe(cause)
    expect(bound.inspectCleanup()[0]!.status).toBe('unobservable')
  })

  it('refuses recreated objects reusing either original future while retaining the actual child', () => {
    for (const reuse of ['result', 'settled', 'both'] as const) {
      const opaque = {}
      const original = request()
      const fresh = request()
      const child = {
        ...fresh,
        result: reuse === 'settled' ? fresh.result : original.result,
        settled: reuse === 'result' ? fresh.settled : original.settled,
      }
      const bound = bind({
        ...original,
        checkpoint: {
          capture: () => opaque,
          recreate: () => child,
          release() {},
        },
      })
      bound.captureCheckpoint()
      const refused = bound.recreateCheckpoint(opaque)
      expect(refused.supported).toBe(false)
      if (refused.supported === true) throw new Error('old future admitted')
      expect(refused.reason).toBe('consumer-recreation-future-reused')
      expect(refused.value).toBe(child)
      expect(bound.getRetainedCheckpoint()).toBe(opaque)
      bound.releaseCheckpoint(opaque)
    }
  })

  it('refuses an ancestor future reused later in the same original recreation chain', () => {
    const firstOpaque = {}
    const secondOpaque = {}
    const original = request()
    const grandchild = { ...request(), settled: original.settled }
    const child = {
      ...request(),
      checkpoint: {
        capture: () => secondOpaque,
        recreate: () => grandchild,
        release() {},
      },
    }
    const bound = bind({
      ...original,
      checkpoint: {
        capture: () => firstOpaque,
        recreate: () => child,
        release() {},
      },
    })
    bound.captureCheckpoint()
    const next = bound.recreateCheckpoint(firstOpaque)
    if (next.supported === false) throw new Error(next.reason)
    next.value.captureCheckpoint()
    const refused = next.value.recreateCheckpoint(secondOpaque)
    expect(refused.supported).toBe(false)
    expect(refused.value).toBe(grandchild)
    next.value.releaseCheckpoint(secondOpaque)
    bound.releaseCheckpoint(firstOpaque)
  })
})
