import { watch } from 'vue'
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
  // Aborting a preparation can return before its consumer resolver has settled.
  const draining = new Set<MarkdownEmbedRequest>()
  const versions = new Map<string, number>()
  let results = new Map<string, MarkdownEmbedResult>()
  let nodes: readonly MarkdownEmbedValidNode[] = []
  let generation = 0
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
    generation += 1
    for (const operation of active) {
      operation.controller.abort()
      cancelMarkdownEmbedRequest(operation.request)
    }
  }
  const inspect = (): MarkdownEditorSessionResourceInspection => {
    collectDraining()
    const jobs = bindings.readAttachmentJobs()
    const batches = bindings.readAttachmentBatches()
    const items = bindings.readAttachmentItems()
    const capture = inspectMarkdownAttachmentCaptureResources(
      bindings.attachmentCaptureSession,
    )
    const unfinishedJobs = jobs.filter(unfinished).length
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
    const backgroundTasks = active.size + preparationTasks + unfinishedJobs
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
        // through unfinished jobs/provider tasks; it is never reported as cancelled.
        networkRequests: 0,
        memoryUnits:
          active.size +
          draining.size +
          jobs.length +
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
    const epoch = generation
    const controller = new AbortController()
    const operation = {
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
    const current = (checkSignal = true) => {
      const now = bindings.readDocument()
      return (
        !disposed &&
        !pauseRequested &&
        !controller.signal.aborted &&
        (!checkSignal || !operation.request.signal?.aborted) &&
        generation === epoch &&
        versions.get(id) === version &&
        bindings.readEmbedProvider() === provider &&
        now.revision === revision &&
        now.documentIdentity.id === documentIdentity.id &&
        now.documentIdentity.epoch === documentIdentity.epoch
      )
    }
    try {
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
    } finally {
      active.delete(operation)
      if (controller.signal.aborted)
        cancelMarkdownEmbedRequest(operation.request)
      else
        forgetMarkdownEmbedRequest(
          operation.request.requestId,
          operation.request,
        )
      draining.add(operation.request)
      collectDraining()
    }
  }
  const refreshEmbeds = (nextNodes: readonly MarkdownEmbedValidNode[]) => {
    if (disposed) throw new Error('editor-session-attachment-embed-disposed')
    cancel()
    nodes = [...nextNodes]
    const ids = new Set(nodes.map(nodeId))
    results = new Map([...results].filter(([id]) => ids.has(id)))
    for (const id of versions.keys()) if (!ids.has(id)) versions.delete(id)
    if (pauseRequested) return
    publish()
    for (const node of nodes) void resolveEmbedNode(node)
  }
  const participant: MarkdownEditorSessionResourceParticipant = Object.freeze({
    ownerRef: 'attachment-embed',
    inspect,
    pause() {
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
      cancel()
    },
  })
  return Object.freeze({
    participant,
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
    acceptsAttachmentResult(result: MarkdownAttachmentProviderResult) {
      if (pauseRequested || disposed || !result.itemId) return false
      const job = bindings
        .readAttachmentJobs()
        .find((candidate) => candidate.itemId === result.itemId)
      const identity = bindings.readDocument().documentIdentity
      return (
        !!job &&
        job.batchId === result.batchId &&
        unfinished(job) &&
        job.documentIdentity?.id === identity.id &&
        job.documentIdentity.epoch === identity.epoch &&
        (!result.documentIdentity ||
          (result.documentIdentity.id === identity.id &&
            result.documentIdentity.epoch === identity.epoch)) &&
        (result.revision === undefined || result.revision === job.revision)
      )
    },
    abort() {
      pauseRequested = true
      stopWatching()
      cancel()
    },
  })
}
