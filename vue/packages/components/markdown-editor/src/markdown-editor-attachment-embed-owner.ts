import { watch, toRaw } from 'vue'
import type { WatchSource, WatchStopHandle } from 'vue'
import type {
  MarkdownDocumentIdentity,
  MarkdownEmbedValidNode,
} from '../../../wasm/markdown-runtime'
import {
  bindMarkdownEmbedRequestDigest,
  cancelMarkdownEmbedRequest,
  commitMarkdownEmbedResult,
  createMarkdownEmbedRequest,
  forgetMarkdownEmbedRequest,
  inspectMarkdownEmbedRequestResources,
} from '../../../wasm/markdown-embed-provider'
import type {
  MarkdownEmbedProvider,
  MarkdownEmbedRequest,
  MarkdownEmbedResult,
} from '../../../wasm/markdown-embed-provider'
import type { MarkdownAttachmentJob } from './markdown-editor-attachment-lifecycle'
import {
  inspectMarkdownAttachmentDispatch,
  runMarkdownAttachmentDispatch,
} from './markdown-editor-attachment-lifecycle'
import { inspectMarkdownAttachmentCaptureResources } from './markdown-editor-attachment'
import type {
  MarkdownAttachmentProviderResult,
  MarkdownAttachmentCaptureSession,
  MarkdownAttachmentBatchIntent,
  MarkdownAttachmentItemIntent,
} from './markdown-editor-attachment'
import type {
  MarkdownEditorSessionResourceInspection,
  MarkdownEditorSessionResourceParticipant,
} from './markdown-editor-session-resources'

export interface MarkdownAttachmentEmbedOwnerBindings {
  readonly readDocument: () => {
    readonly documentIdentity: MarkdownDocumentIdentity
    readonly revision: number
  }
  readonly readEmbedProvider: () => MarkdownEmbedProvider | undefined
  readonly readAttachmentJobs: () => readonly MarkdownAttachmentJob[]
  readonly readAttachmentBatches: () => ReadonlyMap<
    string,
    MarkdownAttachmentBatchIntent
  >
  readonly readAttachmentItems: () => ReadonlyMap<
    string,
    MarkdownAttachmentItemIntent
  >
  readonly attachmentCaptureSession: MarkdownAttachmentCaptureSession
  readonly publishEmbedResults: (
    results: ReadonlyMap<string, MarkdownEmbedResult>,
  ) => void
}

const nodeId = (node: MarkdownEmbedValidNode) =>
  `embed:${node.ranges.full.start}:${node.target}:${node.mode}`
const unfinished = (job: MarkdownAttachmentJob) =>
  job.phase === 'pending' || job.phase === 'progress'

/** One setup-owned lifecycle. Vue supplies reactive reads/writes, never another queue. */
export const createMarkdownAttachmentEmbedResourceOwner = (
  bindings: MarkdownAttachmentEmbedOwnerBindings,
) => {
  const active = new Set<{
    controller: AbortController
    request: MarkdownEmbedRequest
  }>()
  const attachmentTasks = new Map<object, MarkdownAttachmentJob>()
  // An unobserved consumer dispatch cannot be cleared by phase changes/removal.
  const observedAttachmentJobs = new Set<MarkdownAttachmentJob>()
  const attachmentResults = new WeakMap<
    MarkdownAttachmentProviderResult,
    {
      readonly job: MarkdownAttachmentJob
      readonly dispatchRef: object
      readonly attempt: number
      readonly generation: number
      readonly kind: 'progress' | 'settlement'
    }
  >()
  // Aborting a preparation can return before its consumer resolver has settled.
  const draining = new Set<MarkdownEmbedRequest>()
  const versions = new Map<string, number>()
  let results = new Map<string, MarkdownEmbedResult>()
  let nodes: readonly MarkdownEmbedValidNode[] = []
  let embedGeneration = 0
  let attachmentGeneration = 0
  let pauseRequested = false
  let disposed = false
  let watchInputs:
    | {
        sources: readonly WatchSource[]
        readNodes: () => readonly MarkdownEmbedValidNode[]
      }
    | undefined
  let stopWatcher: WatchStopHandle | undefined

  const stopWatching = () => {
    stopWatcher?.()
    stopWatcher = undefined
  }
  const startWatching = () => {
    if (!watchInputs || pauseRequested || disposed) return
    stopWatcher = watch([...watchInputs.sources], () =>
      refreshEmbeds(watchInputs!.readNodes()),
    )
    refreshEmbeds(watchInputs.readNodes())
  }

  const collectDraining = () => {
    for (const request of draining) {
      const resources = inspectMarkdownEmbedRequestResources(request)
      if (
        resources.backgroundTasks === 0 &&
        resources.timers === 0 &&
        resources.retainedListeners === 0
      )
        draining.delete(request)
    }
  }
  const cancel = () => {
    embedGeneration += 1
    for (const operation of active) {
      operation.controller.abort()
      cancelMarkdownEmbedRequest(operation.request)
    }
  }
  const inspect = (): MarkdownEditorSessionResourceInspection => {
    collectDraining()
    const jobs = bindings.readAttachmentJobs()
    const currentJobs = new Set(jobs.map((job) => toRaw(job)))
    for (const job of currentJobs) observedAttachmentJobs.add(job)
    const attachmentRunning = new Set(attachmentTasks.keys())
    for (const job of observedAttachmentJobs) {
      const state = inspectMarkdownAttachmentDispatch(job)
      if (
        !state ||
        state.attempt !== job.attempt ||
        (!state.settlementAvailable && !state.dispatching)
      ) {
        throw new Error(
          'editor-session-attachment-settlement-owner-unavailable',
        )
      }
      if (!state.settled) attachmentRunning.add(state.dispatchRef)
      else if (
        !currentJobs.has(job) &&
        !attachmentTasks.has(state.dispatchRef)
      ) {
        observedAttachmentJobs.delete(job)
      }
    }
    const batches = bindings.readAttachmentBatches()
    const items = bindings.readAttachmentItems()
    const capture = inspectMarkdownAttachmentCaptureResources(
      bindings.attachmentCaptureSession,
    )
    const requests = new Set([...active].map((operation) => operation.request))
    for (const request of draining) requests.add(request)
    let timers = 0
    let retainedListeners = 0
    let preparationTasks = 0
    for (const request of requests) {
      const resources = inspectMarkdownEmbedRequestResources(request)
      timers += resources.timers
      retainedListeners += resources.retainedListeners
      preparationTasks += resources.backgroundTasks
    }
    const backgroundTasks =
      active.size + preparationTasks + attachmentRunning.size
    return Object.freeze({
      ownerRef: 'attachment-embed',
      paused:
        pauseRequested &&
        stopWatcher === undefined &&
        backgroundTasks === 0 &&
        timers === 0 &&
        retainedListeners === 0,
      // No checkpoint exists for provider results, job ranges/attempts or opaque uploads.
      // Only an empty lifecycle can be reconstructed without inventing restoration proof.
      recoverable:
        backgroundTasks === 0 &&
        jobs.length === 0 &&
        observedAttachmentJobs.size === 0 &&
        batches.size === 0 &&
        items.size === 0 &&
        capture.memoryUnits === 0 &&
        results.size === 0 &&
        nodes.length === 0 &&
        versions.size === 0,
      retainedListeners,
      usage: Object.freeze({
        editorInstances: 0,
        renderers: 0,
        observers: stopWatcher ? 1 : 0,
        timers,
        backgroundTasks,
        // This library performs no network I/O. Opaque consumer work blocks pause
        // through actual dispatch/provider futures; it is never reported as cancelled.
        networkRequests: 0,
        memoryUnits:
          active.size +
          draining.size +
          jobs.length +
          observedAttachmentJobs.size +
          attachmentTasks.size +
          batches.size +
          items.size +
          capture.memoryUnits +
          results.size +
          versions.size +
          nodes.length +
          (stopWatcher ? 1 : 0),
      }),
    })
  }
  const publish = () => bindings.publishEmbedResults(new Map(results))
  const resolveEmbedNode = async (
    node: MarkdownEmbedValidNode,
  ): Promise<void> => {
    if (pauseRequested || disposed) return
    const provider = bindings.readEmbedProvider()
    if (!provider) return
    const identity = bindings.readDocument()
    const documentIdentity = Object.freeze({ ...identity.documentIdentity })
    const revision = identity.revision
    const id = nodeId(node)
    const version = (versions.get(id) ?? 0) + 1
    versions.set(id, version)
    const epoch = embedGeneration
    const controller = new AbortController()
    let operation:
      | { controller: AbortController; request: MarkdownEmbedRequest }
      | undefined
    const current = (checkSignal = true) => {
      const now = bindings.readDocument()
      return (
        !disposed &&
        !pauseRequested &&
        !controller.signal.aborted &&
        (!checkSignal || !operation?.request.signal?.aborted) &&
        embedGeneration === epoch &&
        versions.get(id) === version &&
        bindings.readEmbedProvider() === provider &&
        now.revision === revision &&
        now.documentIdentity.id === documentIdentity.id &&
        now.documentIdentity.epoch === documentIdentity.epoch
      )
    }
    try {
      // Admission can refuse capacity before any request handle exists.
      operation = {
        controller,
        request: createMarkdownEmbedRequest({
          documentIdentity,
          revision,
          nodeId: id,
          target: node.target,
          mode: node.mode,
          version,
          signal: controller.signal,
        }),
      }
      active.add(operation)
      if (globalThis.crypto?.subtle) {
        try {
          operation.request = await bindMarkdownEmbedRequestDigest(
            operation.request,
          )
        } catch {
          // Preserve the existing metadata fallback, but never restart cancelled work.
          if (!current(false)) return
          operation.request = createMarkdownEmbedRequest({
            documentIdentity,
            revision,
            nodeId: id,
            target: node.target,
            mode: node.mode,
            version,
            signal: controller.signal,
          })
        }
      }
      if (!current()) return
      results.set(
        id,
        Object.freeze({ ...operation.request, status: 'pending' as const }),
      )
      publish()
      if (!current()) return
      let result: MarkdownEmbedResult
      try {
        result = await provider(operation.request)
      } catch {
        result = Object.freeze({
          ...operation.request,
          status: 'rejected' as const,
        })
      }
      if (!current()) return
      results.set(id, commitMarkdownEmbedResult(operation.request, result))
      publish()
    } catch (error) {
      if (
        !(error instanceof Error) ||
        (error.message !== 'markdown-embed-request-capacity-exceeded' &&
          error.message !== 'markdown-embed-request-id-in-use')
      )
        throw error
      // Refusal is not a provider result or a completed request. Release only
      // this attempt's presentation bookkeeping, including fallback refusal.
      if (current(false)) {
        results.delete(id)
        versions.delete(id)
        publish()
      }
    } finally {
      if (operation) {
        active.delete(operation)
        if (controller.signal.aborted)
          cancelMarkdownEmbedRequest(operation.request)
        else
          forgetMarkdownEmbedRequest(
            operation.request.requestId,
            operation.request,
          )
        draining.add(operation.request)
      } else controller.abort()
      collectDraining()
    }
  }
  const refreshEmbeds = (nextNodes: readonly MarkdownEmbedValidNode[]) => {
    if (disposed) throw new Error('editor-session-attachment-embed-disposed')
    if (pauseRequested)
      throw new Error('editor-session-attachment-embed-paused')
    cancel()
    nodes = [...nextNodes]
    const ids = new Set(nodes.map(nodeId))
    results = new Map([...results].filter(([id]) => ids.has(id)))
    for (const id of versions.keys()) if (!ids.has(id)) versions.delete(id)
    publish()
    for (const node of nodes) void resolveEmbedNode(node)
  }
  const participant: MarkdownEditorSessionResourceParticipant = Object.freeze({
    ownerRef: 'attachment-embed',
    inspect,
    pause() {
      attachmentGeneration += 1
      pauseRequested = true
      stopWatching()
      cancel()
      return inspect()
    },
    resume() {
      if (disposed) throw new Error('editor-session-attachment-embed-disposed')
      const wasPaused = pauseRequested
      pauseRequested = false
      if (wasPaused) {
        if (watchInputs) startWatching()
        else refreshEmbeds(nodes)
      }
      return inspect()
    },
    dispose(snapshotRef: string) {
      const state = inspect()
      if (!snapshotRef || !state.paused || !state.recoverable)
        throw new Error(
          'editor-session-attachment-embed-checkpoint-not-recoverable',
        )
      disposed = true
      attachmentGeneration += 1
      cancel()
    },
  })
  const acceptsAttachmentResult = (
    result: MarkdownAttachmentProviderResult,
  ) => {
    if (pauseRequested || disposed || !result.itemId) return false
    const proof = attachmentResults.get(result)
    if (!proof) return false
    const job = bindings
      .readAttachmentJobs()
      .find((candidate) => toRaw(candidate) === proof.job)
    if (!job) return false
    const dispatch = inspectMarkdownAttachmentDispatch(job)
    const identity = bindings.readDocument().documentIdentity
    return (
      dispatch?.dispatchRef === proof.dispatchRef &&
      attachmentGeneration === proof.generation &&
      dispatch.attempt === proof.attempt &&
      job.attempt === proof.attempt &&
      (proof.kind === 'progress'
        ? result.status === 'progress' && !dispatch.settled
        : result.status !== 'progress' && dispatch.settled) &&
      job.itemId === result.itemId &&
      job.batchId === result.batchId &&
      unfinished(job) &&
      job.documentIdentity?.id === identity.id &&
      job.documentIdentity.epoch === identity.epoch &&
      (!result.documentIdentity ||
        (result.documentIdentity.id === identity.id &&
          result.documentIdentity.epoch === identity.epoch)) &&
      (result.revision === undefined || result.revision === job.revision)
    )
  }
  return Object.freeze({
    participant,
    async runAttachmentDispatch(
      job: MarkdownAttachmentJob,
      dispatch: (
        admitProgress: (result: MarkdownAttachmentProviderResult) => boolean,
      ) => PromiseLike<MarkdownAttachmentProviderResult>,
    ): Promise<MarkdownAttachmentProviderResult> {
      if (disposed || pauseRequested)
        throw new Error('editor-session-attachment-dispatch-admission-blocked')
      const ownedJob = toRaw(job)
      if (
        !bindings
          .readAttachmentJobs()
          .some((candidate) => toRaw(candidate) === ownedJob)
      ) {
        throw new Error('editor-session-attachment-dispatch-job-unavailable')
      }
      observedAttachmentJobs.add(ownedJob)
      const epoch = attachmentGeneration
      let dispatchRef: object | undefined
      let bindSettlement:
        | ((
            result: MarkdownAttachmentProviderResult,
          ) => MarkdownAttachmentProviderResult)
        | undefined
      try {
        const result = await runMarkdownAttachmentDispatch(ownedJob, () => {
          const state = inspectMarkdownAttachmentDispatch(ownedJob)!
          dispatchRef = state.dispatchRef
          attachmentTasks.set(dispatchRef, ownedJob)
          const bindResult = (
            result: MarkdownAttachmentProviderResult,
            kind: 'progress' | 'settlement',
          ) => {
            const previous = attachmentResults.get(result)
            if (
              previous &&
              (previous.dispatchRef !== state.dispatchRef ||
                previous.kind !== kind)
            )
              return false
            attachmentResults.set(result, {
              job: ownedJob,
              dispatchRef: state.dispatchRef,
              attempt: state.attempt,
              generation: epoch,
              kind,
            })
            return acceptsAttachmentResult(result)
          }
          bindSettlement = (result) => {
            // Snapshot actual settled data; no caller can upgrade a progress object.
            const settled = Object.freeze({
              ...result,
              ...(result.documentIdentity
                ? {
                    documentIdentity: Object.freeze({
                      ...result.documentIdentity,
                    }),
                  }
                : {}),
              ...(result.status === 'resolved'
                ? { payload: Object.freeze({ ...result.payload }) }
                : {}),
            }) as MarkdownAttachmentProviderResult
            bindResult(settled, 'settlement')
            return settled
          }
          const work = dispatch((progress) => {
            const current = inspectMarkdownAttachmentDispatch(ownedJob)
            if (
              progress.status !== 'progress' ||
              current?.dispatchRef !== state.dispatchRef ||
              current.settled
            )
              return false
            if (progress.documentIdentity)
              Object.freeze(progress.documentIdentity)
            Object.freeze(progress)
            return bindResult(progress, 'progress')
          })
          // An event emission or terminal label is not a settlement future.
          if (!work || typeof work.then !== 'function') {
            throw new Error(
              'editor-session-attachment-dispatch-settlement-unavailable',
            )
          }
          return work
        })
        // Ledger settlement happens before final provenance is issued.
        return bindSettlement!(result)
      } finally {
        if (dispatchRef) attachmentTasks.delete(dispatchRef)
      }
    },
    bindEmbedInputs(
      sources: readonly WatchSource[],
      readNodes: () => readonly MarkdownEmbedValidNode[],
    ) {
      if (disposed || watchInputs)
        throw new Error(
          'editor-session-attachment-embed-watch-already-bound-or-disposed',
        )
      watchInputs = { sources: [...sources], readNodes }
      startWatching()
    },
    resolveEmbedNode,
    refreshEmbeds,
    readEmbedResults: () =>
      new Map(results) as ReadonlyMap<string, MarkdownEmbedResult>,
    readEmbedRequestVersions: () =>
      new Map(versions) as ReadonlyMap<string, number>,
    acceptsAttachmentResult,
    abort() {
      attachmentGeneration += 1
      pauseRequested = true
      stopWatching()
      cancel()
    },
  })
}
