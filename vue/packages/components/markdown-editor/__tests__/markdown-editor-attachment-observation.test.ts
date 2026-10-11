import { isProxy, reactive, ref, toRaw } from 'vue'
import { describe, expect, it } from 'vitest'
import { createMarkdownAttachmentEmbedResourceOwner } from '../src/markdown-editor-attachment-embed-owner'
import { createMarkdownAttachmentCaptureSession } from '../src/markdown-editor-attachment'
import { createMarkdownAttachmentJob } from '../src/markdown-editor-attachment-lifecycle'
import type { MarkdownAttachmentProviderResult } from '../src/markdown-editor-attachment'
import type { MarkdownAttachmentJob } from '../src/markdown-editor-attachment-lifecycle'

// Source controls only. Execution requires the original entry/import/hook preflight.
const fixture = (bind = true) => {
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
    readEmbedProvider: () => undefined,
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
})
