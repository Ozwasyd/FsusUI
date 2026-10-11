import { webcrypto } from 'node:crypto'
import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { collectMarkdownEmbedNodes } from '../../../wasm/markdown-runtime'
import {
  cancelMarkdownEmbedRequest,
  createMarkdownEmbedProjectionRequest,
  createMarkdownEmbedRequest,
  forgetMarkdownEmbedRequest,
  inspectMarkdownEmbedRequestResources,
  prepareMarkdownEmbedResult,
} from '../../../wasm/markdown-embed-provider'
import type {
  MarkdownEmbedProvider,
  MarkdownEmbedRequest,
  MarkdownEmbedResult,
} from '../../../wasm/markdown-embed-provider'
import { createMarkdownAttachmentEmbedResourceOwner } from '../src/markdown-editor-attachment-embed-owner'
import {
  createMarkdownAttachmentJob,
  planMarkdownAttachmentResolve,
  progressMarkdownAttachmentJob,
} from '../src/markdown-editor-attachment-lifecycle'
import { createMarkdownEditorSessionResourceCoordinator } from '../src/markdown-editor-session-resources'
import {
  createMarkdownAttachmentCaptureSession,
  createMarkdownAttachmentBatch,
} from '../src/markdown-editor-attachment'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const node = () => {
  const parsed = collectMarkdownEmbedNodes(
    '::embed[target="note" mode="article"]',
  )[0]!
  if (!parsed.ok) throw new Error('invalid-test-directive')
  return parsed
}
const resolved = (
  request: MarkdownEmbedRequest,
  title = 'Current',
): MarkdownEmbedResult => ({ ...request, status: 'resolved', title })
const fixture = (provider?: MarkdownEmbedProvider) => {
  const document = { documentIdentity: { id: 'host', epoch: 1 }, revision: 2 }
  const jobs = [createMarkdownAttachmentJob('unused')].slice(0, 0)
  const publications: ReadonlyMap<string, MarkdownEmbedResult>[] = []
  const batches = new Map<
    string,
    ReturnType<typeof createMarkdownAttachmentBatch>
  >()
  const items = new Map<
    string,
    ReturnType<typeof createMarkdownAttachmentBatch>['items'][number]
  >()
  const capture = createMarkdownAttachmentCaptureSession()
  const owner = createMarkdownAttachmentEmbedResourceOwner({
    readDocument: () => document,
    readAttachmentJobs: () => jobs,
    readAttachmentBatches: () => batches,
    readAttachmentItems: () => items,
    attachmentCaptureSession: capture,
    readEmbedProvider: () => provider,
    publishEmbedResults: (results) => publications.push(results),
  })
  return { owner, document, jobs, publications, batches, items, capture }
}
beforeEach(() => vi.stubGlobal('crypto', undefined))
afterEach(() => vi.unstubAllGlobals())

describe('attachment/embed real resource owner', () => {
  it('counts retained attachment containers and refuses a foreign capture census', () => {
    const { owner, batches, items, capture } = fixture()
    const batch = createMarkdownAttachmentBatch({
      sourceKind: 'pick',
      documentIdentity: { id: 'host', epoch: 1 },
      revision: 2,
      range: { start: 0, end: 0 },
      items: [{ name: 'asset', mimeType: 'image/png', byteLength: 10 }],
    })
    batches.set(batch.batchId, batch)
    items.set(batch.items[0]!.itemId, batch.items[0]!)
    capture.claim('fingerprint')
    expect(owner.participant.pause()).toMatchObject({
      paused: true,
      recoverable: false,
      usage: { memoryUnits: 3 },
    })
    batches.clear()
    items.clear()
    capture.clear()
    expect(owner.participant.inspect().recoverable).toBe(true)
    const foreign = createMarkdownAttachmentEmbedResourceOwner({
      readDocument: () => ({
        documentIdentity: { id: 'host', epoch: 1 },
        revision: 2,
      }),
      readEmbedProvider: () => undefined,
      readAttachmentJobs: () => [],
      readAttachmentBatches: () => new Map(),
      readAttachmentItems: () => new Map(),
      attachmentCaptureSession: { claim: () => true, clear: () => {} },
      publishEmbedResults: () => {},
    })
    expect(() => foreign.participant.inspect()).toThrow(
      'capture-owner-unavailable',
    )
  })
  it('owns and stops the real embed watcher across pause and resume', async () => {
    const source = ref('first')
    const provider = vi.fn((request: MarkdownEmbedRequest) => resolved(request))
    const { owner } = fixture(provider)
    owner.bindEmbedInputs([source], () => [node()])
    await vi.waitFor(() =>
      expect(owner.participant.inspect().usage.backgroundTasks).toBe(0),
    )
    expect(owner.participant.inspect().usage.observers).toBe(1)
    expect(provider).toHaveBeenCalledOnce()
    expect(owner.participant.pause()).toMatchObject({
      paused: true,
      usage: { observers: 0 },
    })
    source.value = 'paused edit'
    await nextTick()
    expect(provider).toHaveBeenCalledOnce()
    owner.participant.resume()
    await vi.waitFor(() =>
      expect(owner.participant.inspect().usage.backgroundTasks).toBe(0),
    )
    expect(provider).toHaveBeenCalledTimes(2)
    source.value = 'resumed edit'
    await nextTick()
    await vi.waitFor(() =>
      expect(owner.participant.inspect().usage.backgroundTasks).toBe(0),
    )
    expect(provider).toHaveBeenCalledTimes(3)
    owner.abort()
    expect(owner.participant.inspect().usage.observers).toBe(0)
  })

  it('keeps cancelled preparation work in its own census after the provider returns', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const completion = deferred<string>()
    const targetVersion = {
      targetIdentity: 'note',
      resolvedRevision: 'one',
      targetVersionIdentity: 'version:one',
      projectionIdentity: 'projection:one',
      projectionDigest: 'a'.repeat(64),
    }
    let materializing = false
    const { owner } = fixture((request) =>
      prepareMarkdownEmbedResult(
        request,
        {
          ...resolved(request),
          targetVersion,
          projection: {
            kind: 'markdown-reference',
            projectionIdentity: targetVersion.projectionIdentity,
            contentDigest: targetVersion.projectionDigest,
          },
        },
        {
          readTargetVersion: () => targetVersion,
          resolveMarkdown: () => {
            materializing = true
            return completion.promise
          },
        },
      ),
    )
    const work = owner.resolveEmbedNode(node())
    await vi.waitFor(() => expect(materializing).toBe(true))
    expect(owner.participant.inspect().usage).toMatchObject({
      backgroundTasks: 2,
      timers: 1,
    })
    owner.participant.pause()
    await work
    expect(owner.participant.inspect()).toMatchObject({
      paused: false,
      retainedListeners: 0,
      usage: { backgroundTasks: 1, timers: 0 },
    })
    completion.resolve('late')
    await vi.waitFor(() =>
      expect(owner.participant.inspect().paused).toBe(true),
    )
  })
  it('holds an opaque consumer upload and never acknowledges its pause', () => {
    const { owner, jobs } = fixture()
    jobs.push(
      createMarkdownAttachmentJob('item', {
        documentIdentity: { id: 'host', epoch: 1 },
      }),
    )
    const state = owner.participant.pause()
    expect(state).toMatchObject({
      paused: false,
      recoverable: false,
      retainedListeners: 0,
      usage: { backgroundTasks: 1, networkRequests: 0 },
    })
    expect(() => owner.participant.dispose('snapshot:1')).toThrow(
      'checkpoint-not-recoverable',
    )
    expect(() =>
      createMarkdownEditorSessionResourceCoordinator(() => [
        owner.participant,
      ]).pauseResources(),
    ).toThrow('owner-unavailable')
  })

  it('retains a cancelled provider promise until settlement and suppresses its result', async () => {
    const completion = deferred<MarkdownEmbedResult>()
    let request!: MarkdownEmbedRequest
    const { owner, publications } = fixture((input) => {
      request = input
      return completion.promise
    })
    const work = owner.resolveEmbedNode(node())
    expect(owner.participant.inspect()).toMatchObject({
      retainedListeners: 1,
      usage: { backgroundTasks: 1 },
    })
    expect(owner.participant.pause()).toMatchObject({
      paused: false,
      retainedListeners: 0,
      usage: { backgroundTasks: 1 },
    })
    expect(request.signal?.aborted).toBe(true)
    completion.resolve(resolved(request, 'late'))
    await work
    expect(publications).toHaveLength(1)
    expect(owner.participant.inspect()).toMatchObject({
      paused: true,
      recoverable: false,
      usage: { backgroundTasks: 0 },
    })
  })

  it('does not apply provider results after a host epoch or revision change', async () => {
    for (const field of ['epoch', 'revision'] as const) {
      const completion = deferred<MarkdownEmbedResult>()
      let request!: MarkdownEmbedRequest
      const { owner, document, publications } = fixture((input) => {
        request = input
        return completion.promise
      })
      const work = owner.resolveEmbedNode(node())
      if (field === 'epoch') document.documentIdentity.epoch += 1
      else document.revision += 1
      completion.resolve(resolved(request, 'foreign-session'))
      await work
      expect(publications).toHaveLength(1)
      expect(owner.participant.inspect().usage.backgroundTasks).toBe(0)
    }
  })

  it('keeps a digest task visible during pause and never dispatches it afterwards', async () => {
    const digest = deferred<ArrayBuffer>()
    vi.stubGlobal('crypto', { subtle: { digest: () => digest.promise } })
    const provider = vi.fn((request: MarkdownEmbedRequest) => resolved(request))
    const { owner } = fixture(provider)
    const work = owner.resolveEmbedNode(node())
    expect(owner.participant.inspect().retainedListeners).toBe(1)
    expect(owner.participant.pause().paused).toBe(false)
    digest.resolve(new ArrayBuffer(32))
    await work
    expect(provider).not.toHaveBeenCalled()
    expect(owner.participant.inspect()).toMatchObject({
      paused: true,
      retainedListeners: 0,
      usage: { backgroundTasks: 0 },
    })
  })

  it('resumes through a fresh request and rejects the old generation completion', async () => {
    const calls: {
      request: MarkdownEmbedRequest
      completion: ReturnType<typeof deferred<MarkdownEmbedResult>>
    }[] = []
    const { owner, publications } = fixture((request) => {
      const completion = deferred<MarkdownEmbedResult>()
      calls.push({ request, completion })
      return completion.promise
    })
    owner.refreshEmbeds([node()])
    expect(owner.participant.pause().paused).toBe(false)
    expect(owner.participant.resume().paused).toBe(false)
    expect(calls).toHaveLength(2)
    expect(calls[1]!.request.version).toBe(2)
    expect(owner.participant.inspect().usage.backgroundTasks).toBe(2)
    calls[1]!.completion.resolve(resolved(calls[1]!.request, 'fresh'))
    await vi.waitFor(() =>
      expect([...owner.readEmbedResults().values()][0]!.title).toBe('fresh'),
    )
    const beforeLate = publications.length
    calls[0]!.completion.resolve(resolved(calls[0]!.request, 'late'))
    await vi.waitFor(() =>
      expect(owner.participant.inspect().usage.backgroundTasks).toBe(0),
    )
    expect(publications).toHaveLength(beforeLate)
    owner.abort()
  })

  it('stops dispatch when publishing pending state reentrantly pauses the owner', async () => {
    const provider = vi.fn((request: MarkdownEmbedRequest) => resolved(request))
    let owner!: ReturnType<typeof createMarkdownAttachmentEmbedResourceOwner>
    owner = createMarkdownAttachmentEmbedResourceOwner({
      readDocument: () => ({
        documentIdentity: { id: 'host', epoch: 1 },
        revision: 2,
      }),
      readEmbedProvider: () => provider,
      readAttachmentJobs: () => [],
      readAttachmentBatches: () => new Map(),
      readAttachmentItems: () => new Map(),
      attachmentCaptureSession: createMarkdownAttachmentCaptureSession(),
      publishEmbedResults: () => owner.participant.pause(),
    })
    await owner.resolveEmbedNode(node())
    expect(provider).not.toHaveBeenCalled()
    expect(owner.participant.inspect().paused).toBe(true)
  })

  it('preserves metadata fallback after digest failure and provider rejection', async () => {
    vi.stubGlobal('crypto', {
      subtle: { digest: () => Promise.reject(new Error('digest-unavailable')) },
    })
    const provider = vi.fn(() =>
      Promise.reject(new Error('provider-unavailable')),
    )
    const { owner } = fixture(provider)
    await owner.resolveEmbedNode(node())
    expect(provider).toHaveBeenCalledOnce()
    expect([...owner.readEmbedResults().values()][0]!.status).toBe('rejected')
    expect(owner.participant.inspect()).toMatchObject({
      retainedListeners: 0,
      usage: { backgroundTasks: 0 },
    })
  })

  it('admits recoverable disposal only for an empty, paused lifecycle', () => {
    const { owner } = fixture()
    expect(owner.participant.pause()).toMatchObject({
      paused: true,
      recoverable: true,
    })
    expect(() => owner.participant.dispose('')).toThrow(
      'checkpoint-not-recoverable',
    )
    owner.participant.dispose('snapshot:empty')
    expect(() => owner.participant.resume()).toThrow('disposed')
  })

  it('gates attachment progress by batch, job phase and current host identity', () => {
    const { owner, jobs, document } = fixture()
    jobs.push(
      createMarkdownAttachmentJob('item', {
        itemId: 'item',
        batchId: 'batch',
        documentIdentity: document.documentIdentity,
        revision: 2,
      }),
    )
    const result = {
      status: 'progress' as const,
      batchId: 'batch',
      itemId: 'item',
      documentIdentity: { id: 'host', epoch: 1 },
      revision: 2,
    }
    expect(owner.acceptsAttachmentResult(result)).toBe(true)
    expect(
      owner.acceptsAttachmentResult({ ...result, batchId: 'foreign' }),
    ).toBe(false)
    expect(owner.acceptsAttachmentResult({ ...result, revision: 3 })).toBe(
      false,
    )
    owner.participant.pause()
    expect(owner.acceptsAttachmentResult(result)).toBe(false)
    owner.participant.resume()
    document.documentIdentity.epoch = 2
    expect(jobs[0]!.documentIdentity?.epoch).toBe(1)
    expect(owner.acceptsAttachmentResult(result)).toBe(false)
    expect(
      owner.acceptsAttachmentResult({
        status: 'progress',
        batchId: 'batch',
        itemId: 'item',
      }),
    ).toBe(false)
  })

  it('does not resurrect terminal attachment jobs through progress or resolution', () => {
    for (const phase of [
      'document-abort',
      'stale',
      'resolved',
      'rejected',
      'cancelled',
      'deleted',
    ] as const) {
      const job = createMarkdownAttachmentJob('item', {
        range: { start: 0, end: 8 },
      })
      job.phase = phase
      progressMarkdownAttachmentJob(job, 70)
      expect(job.phase).toBe(phase)
      expect(
        planMarkdownAttachmentResolve('![x]()', job, {
          status: 'resolved',
          batchId: 'batch',
          itemId: 'item',
          documentIdentity: { id: 'host', epoch: 1 },
          revision: 2,
          payload: {
            href: 'https://example.com/image.png',
            markdownKind: 'image',
            mimeType: 'image/png',
          },
        }).accepted,
      ).toBe(false)
      expect(job.phase).toBe(phase)
    }
  })

  it('does not let old same-id cleanup cancel a replacement request or its listener', () => {
    const input = {
      requestId: 'duplicate',
      documentIdentity: { id: 'host', epoch: 1 },
      revision: 2,
      nodeId: 'one',
      target: 'note',
      mode: 'article' as const,
      version: 1,
      signal: new AbortController().signal,
    }
    const old = createMarkdownEmbedRequest(input)
    const next = createMarkdownEmbedRequest(input)
    forgetMarkdownEmbedRequest(old.requestId, old)
    cancelMarkdownEmbedRequest(old)
    expect(inspectMarkdownEmbedRequestResources(next)).toMatchObject({
      registered: true,
      retainedListeners: 1,
    })
    expect(next.signal?.aborted).toBe(false)
    cancelMarkdownEmbedRequest(next)
    expect(inspectMarkdownEmbedRequestResources(next)).toMatchObject({
      registered: false,
      retainedListeners: 0,
    })
  })

  it('counts real projection timers/listeners and retains cancelled unresolved resolver work', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const request = await createMarkdownEmbedProjectionRequest({
      documentIdentity: { id: 'host', epoch: 1 },
      revision: 2,
      nodeId: 'one',
      target: 'note',
      mode: 'article',
      version: 1,
    })
    const targetVersion = {
      targetIdentity: 'note',
      resolvedRevision: 'one',
      targetVersionIdentity: 'version:one',
      projectionIdentity: 'projection:one',
      projectionDigest: 'a'.repeat(64),
    }
    const completion = deferred<string>()
    const result = {
      ...resolved(request),
      targetVersion,
      projection: {
        kind: 'markdown-reference' as const,
        projectionIdentity: targetVersion.projectionIdentity,
        contentDigest: targetVersion.projectionDigest,
      },
    }
    const work = prepareMarkdownEmbedResult(request, result, {
      readTargetVersion: () => targetVersion,
      resolveMarkdown: () => completion.promise,
    })
    expect(inspectMarkdownEmbedRequestResources(request)).toMatchObject({
      backgroundTasks: 1,
      timers: 1,
      retainedListeners: 2,
    })
    cancelMarkdownEmbedRequest(request)
    expect(
      inspectMarkdownEmbedRequestResources(request).retainedListeners,
    ).toBe(0)
    expect((await work).status).toBe('stale')
    expect(inspectMarkdownEmbedRequestResources(request)).toMatchObject({
      backgroundTasks: 1,
      timers: 0,
      retainedListeners: 0,
    })
    completion.resolve('late')
    await vi.waitFor(() =>
      expect(
        inspectMarkdownEmbedRequestResources(request).backgroundTasks,
      ).toBe(0),
    )
  })
})
