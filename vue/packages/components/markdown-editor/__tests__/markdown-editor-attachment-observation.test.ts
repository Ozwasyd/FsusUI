import {
  effectScope,
  isProxy,
  nextTick,
  onWatcherCleanup,
  reactive,
  ref,
  toRaw,
} from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import * as embedProvider from '../../../wasm/markdown-embed-provider'
import { collectMarkdownEmbedNodes } from '../../../wasm/markdown-runtime'
import type {
  MarkdownEmbedProvider,
  MarkdownEmbedRequest,
  MarkdownEmbedResult,
} from '../../../wasm/markdown-embed-provider'
import { createMarkdownAttachmentEmbedResourceOwner } from '../src/markdown-editor-attachment-embed-owner'
import { createMarkdownAttachmentCaptureSession } from '../src/markdown-editor-attachment'
import { createMarkdownAttachmentJob } from '../src/markdown-editor-attachment-lifecycle'
import type { MarkdownAttachmentProviderResult } from '../src/markdown-editor-attachment'
import type { MarkdownAttachmentJob } from '../src/markdown-editor-attachment-lifecycle'

// Source controls only. Execution requires the original entry/import/hook preflight.
const fixture = (bind = true, provider?: MarkdownEmbedProvider) => {
  const documentIdentity = reactive({ id: 'host', epoch: 1 })
  const revision = ref(2)
  const jobs = ref<MarkdownAttachmentJob[]>([])
  let onReadJobs: (() => void) | undefined
  const owner = createMarkdownAttachmentEmbedResourceOwner({
    readDocument: () => ({ documentIdentity, revision: revision.value }),
    readAttachmentJobs: () => {
      const retained = jobs.value
      onReadJobs?.()
      return retained
    },
    readAttachmentBatches: () => new Map(),
    readAttachmentItems: () => new Map(),
    attachmentCaptureSession: createMarkdownAttachmentCaptureSession(),
    readEmbedProvider: () => provider,
    publishEmbedResults: () => {},
  })
  if (bind) owner.bindAttachmentInputs({ documentIdentity, revision, jobs })
  const job = createMarkdownAttachmentJob('item', {
    batchId: 'batch',
    documentIdentity,
    revision: revision.value,
  })
  jobs.value = [job]
  const settle = async () => {
    let complete!: (result: MarkdownAttachmentProviderResult) => void
    const future = new Promise<MarkdownAttachmentProviderResult>((resolve) => {
      complete = resolve
    })
    const work = owner.runAttachmentDispatch(jobs.value[0]!, () => future)
    complete({
      status: 'rejected',
      itemId: 'item',
      batchId: 'batch',
      documentIdentity: { id: 'host', epoch: 1 },
      revision: 2,
      code: 'provider-rejected',
    })
    return work
  }
  return {
    owner,
    job,
    jobs,
    documentIdentity,
    revision,
    settle,
    onReadJobs: (callback: () => void) => {
      onReadJobs = callback
    },
  }
}

describe('attachment result native observation boundary', () => {
  it('admits the original settled job when spread retains Vue proxies in the raw array', async () => {
    const state = fixture()
    const result = await state.settle()
    // This is the production capture append shape, including proxy elements.
    state.jobs.value = [...state.jobs.value]
    const rawSlot = toRaw(state.jobs.value)[0]!
    expect(isProxy(rawSlot)).toBe(true)
    expect(rawSlot).not.toBe(state.job)
    expect(toRaw(rawSlot)).toBe(state.job)
    expect(state.owner.acceptsAttachmentResult(result)).toBe(true)
    expect(state.owner.acceptsAttachmentResult({ ...result })).toBe(false)
    state.jobs.value = []
    expect(state.owner.acceptsAttachmentResult(result)).toBe(false)
    state.owner.abort()
  })

  it('rejects document drift in the last jobs callback even when it returns the old array', async () => {
    const state = fixture()
    const result = await state.settle()
    state.onReadJobs(() => {
      state.documentIdentity.id = 'next'
      state.documentIdentity.epoch += 1
    })
    expect(state.owner.acceptsAttachmentResult(result)).toBe(false)
    state.owner.abort()
  })

  it('rejects mutate-and-restore in the last callback using actual synchronous invalidation', async () => {
    const state = fixture()
    const result = await state.settle()
    state.onReadJobs(() => {
      state.documentIdentity.epoch += 1
      state.documentIdentity.epoch -= 1
    })
    expect(state.owner.acceptsAttachmentResult(result)).toBe(false)
    state.owner.abort()
  })

  it('rejects a revision change in the last callback', async () => {
    const state = fixture()
    const result = await state.settle()
    state.onReadJobs(() => {
      state.revision.value += 1
    })
    expect(state.owner.acceptsAttachmentResult(result)).toBe(false)
    state.owner.abort()
  })

  it('counts the actual observer and recreates it only on resume', () => {
    const state = fixture()
    state.jobs.value = []
    expect(state.owner.participant.inspect().usage.observers).toBe(1)
    expect(state.owner.participant.pause()).toMatchObject({
      paused: true,
      usage: { observers: 0 },
    })
    expect(state.owner.participant.resume().usage.observers).toBe(1)
    state.owner.abort()
  })

  it('blocks unbound census and dispatch instead of accepting an incomplete observation', async () => {
    const state = fixture(false)
    let called = false
    const future = new Promise<MarkdownAttachmentProviderResult>(() => {})
    await expect(
      state.owner.runAttachmentDispatch(state.job, () => {
        called = true
        return future
      }),
    ).rejects.toThrow('observation-unavailable')
    expect(called).toBe(false)
    expect(() => state.owner.participant.inspect()).toThrow('input-unavailable')
    state.owner.abort()
  })

  it('rejects cleanup-to-resume before mutation and stops the original scoped attachment watcher', async () => {
    const scope = effectScope()
    // Inspect actual Vue scope retention, not only the owner's reported census.
    const nativeScope = scope as unknown as {
      readonly effects: readonly unknown[]
    }
    const state = scope.run(() => fixture())!
    const source = ref(0)
    const cleanupErrors: unknown[] = []
    let registerCleanup = false
    state.jobs.value = []
    try {
      state.owner.bindEmbedInputs([source], () => {
        if (registerCleanup)
          onWatcherCleanup(() => {
            try {
              state.owner.participant.resume()
            } catch (error) {
              cleanupErrors.push(error)
            }
            expect(nativeScope.effects).toHaveLength(1)
          })
        return []
      })
      // Register in the actual embed watch callback, not the setup/manual read.
      registerCleanup = true
      source.value += 1
      await nextTick()
      expect(nativeScope.effects).toHaveLength(1)
      expect(state.owner.participant.inspect().usage.observers).toBe(2)
      expect(state.owner.participant.pause()).toMatchObject({
        paused: true,
        recoverable: true,
        usage: { observers: 0 },
      })
      expect(cleanupErrors).toHaveLength(1)
      expect(cleanupErrors[0]).toMatchObject({
        message: 'editor-session-attachment-embed-lifecycle-transition',
      })
      // The pre-fix leak leaves attachment watcher A in this original scope.
      expect(nativeScope.effects).toHaveLength(0)
      state.documentIdentity.epoch += 1
      source.value += 1
      await nextTick()
      expect(nativeScope.effects).toHaveLength(0)
      expect(state.owner.participant.pause().usage.observers).toBe(0)
      state.owner.participant.dispose('snapshot:actual-empty')
      expect(nativeScope.effects).toHaveLength(0)
    } finally {
      scope.stop()
    }
  })

  it('attempts the second original cancellation after the first fails and retains real futures', async () => {
    const calls: {
      request: MarkdownEmbedRequest
      resolve: (result: MarkdownEmbedResult) => void
    }[] = []
    const state = fixture(
      true,
      (request) =>
        new Promise<MarkdownEmbedResult>((resolve) => {
          calls.push({ request, resolve })
        }),
    )
    state.jobs.value = []
    const actualCancel = embedProvider.cancelMarkdownEmbedRequest
    const firstFailure = new Error('first-cancel-boundary-failure')
    const seen: (MarkdownEmbedRequest | string)[] = []
    const reentryErrors: unknown[] = []
    const work: Promise<void>[] = []
    let cancellationSpy:
      | MockInstance<typeof embedProvider.cancelMarkdownEmbedRequest>
      | undefined
    let replacement: MarkdownEmbedRequest | undefined
    vi.stubGlobal('crypto', undefined)
    try {
      const nodes = collectMarkdownEmbedNodes(
        '::embed[target="first" mode="article"]\n::embed[target="second" mode="article"]',
      )
      for (const node of nodes) {
        if (!node.ok) throw new Error('invalid-test-directive')
        work.push(state.owner.resolveEmbedNode(node))
      }
      expect(calls).toHaveLength(2)
      // Fault injection only at the cancellation call boundary. Other calls
      // delegate to the actual provider; no resource counts or settlement stubs.
      cancellationSpy = vi
        .spyOn(embedProvider, 'cancelMarkdownEmbedRequest')
        .mockImplementation((request) => {
          seen.push(request)
          if (request === calls[0]!.request) {
            try {
              state.owner.participant.resume()
            } catch (error) {
              reentryErrors.push(error)
            }
            throw firstFailure
          }
          actualCancel(request)
        })
      let failure: unknown
      try {
        state.owner.abort()
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(AggregateError)
      const cancellationFailure = (failure as AggregateError)
        .errors[0] as AggregateError
      expect(cancellationFailure.message).toBe(
        'editor-session-attachment-embed-cancel-failed',
      )
      expect(cancellationFailure.errors).toEqual([firstFailure])
      expect(seen).toEqual(calls.map((call) => call.request))
      expect(reentryErrors).toHaveLength(1)
      expect(reentryErrors[0]).toMatchObject({
        message: 'editor-session-attachment-embed-lifecycle-transition',
      })
      expect(calls[1]!.request.signal!.aborted).toBe(true)
      expect(
        embedProvider.inspectMarkdownEmbedRequestResources(calls[1]!.request)
          .registered,
      ).toBe(false)
      expect(
        embedProvider.inspectMarkdownEmbedRequestResources(calls[0]!.request)
          .registered,
      ).toBe(true)
      expect(state.owner.participant.inspect()).toMatchObject({
        paused: false,
        usage: { backgroundTasks: 2 },
      })
      cancellationSpy.mockRestore()
      cancellationSpy = undefined
      // Repair the injected boundary failure through the real original capability.
      // A later same-id replacement must survive the owner's late old cleanup.
      actualCancel(calls[0]!.request)
      replacement = embedProvider.createMarkdownEmbedRequest({
        ...calls[0]!.request,
        signal: new AbortController().signal,
        version: calls[0]!.request.version + 1,
      })
      for (const call of calls)
        call.resolve({ ...call.request, status: 'rejected' })
      await Promise.all(work)
      expect(replacement.signal!.aborted).toBe(false)
      expect(
        embedProvider.inspectMarkdownEmbedRequestResources(replacement)
          .registered,
      ).toBe(true)
    } finally {
      cancellationSpy?.mockRestore()
      for (const call of calls)
        call.resolve({ ...call.request, status: 'rejected' })
      await Promise.all(work)
      if (replacement) actualCancel(replacement)
      state.owner.abort()
      vi.unstubAllGlobals()
    }
  })
})
