import { isReactive, isReadonly, ref, watch, toRaw } from 'vue'
import type { Ref, WatchSource, WatchStopHandle } from 'vue'
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

/** Bind the existing editor stores, not computed/custom refs or callback counters. */
export interface MarkdownAttachmentEmbedInputs {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: Ref<number>
  readonly jobs: Ref<MarkdownAttachmentJob[]>
}

const snapshotJobs = (value: readonly MarkdownAttachmentJob[]) => {
  const raw = toRaw(value)
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype)
    return
  const slots = Object.getOwnPropertyDescriptors(raw)
  if (Reflect.ownKeys(slots).length !== raw.length + 1) return
  const jobs: MarkdownAttachmentJob[] = []
  for (let index = 0; index < raw.length; index += 1) {
    const slot = slots[String(index)]
    if (!slot || !('value' in slot) || !slot.value) return
    const job = toRaw(slot.value) as MarkdownAttachmentJob
    if (!isPassiveRecord(job)) return
    jobs.push(job)
  }
  return Object.freeze(jobs)
}
const sameJobs = (
  left: readonly MarkdownAttachmentJob[],
  right: readonly MarkdownAttachmentJob[],
) =>
  left.length === right.length &&
  left.every((job, index) => job === right[index])

const nodeId = (node: MarkdownEmbedValidNode) =>
  `embed:${node.ranges.full.start}:${node.target}:${node.mode}`
const unfinished = (job: MarkdownAttachmentJob) =>
  job.phase === 'pending' || job.phase === 'progress'
const isPassiveRecord = (value: object) => {
  const prototype = Object.getPrototypeOf(value)
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(Object.getOwnPropertyDescriptors(value)).every(
      (descriptor) => 'value' in descriptor,
    )
  )
}
const snapshotPassiveRecord = <T extends object>(
  value: T,
): Readonly<T> | undefined => {
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const entries: [PropertyKey, unknown][] = []
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key as keyof typeof descriptors]
    if (!('value' in descriptor)) return
    entries.push([key, descriptor.value])
  }
  return Object.freeze(Object.fromEntries(entries)) as Readonly<T>
}

/** One setup-owned lifecycle. Vue supplies reactive reads/writes, never another queue. */
export const createMarkdownAttachmentEmbedResourceOwner = (
  bindings: MarkdownAttachmentEmbedOwnerBindings,
) => {
  // Readonly setup capabilities are captured before this owner is exposed.
  // Later method-property getters cannot revoke admission between check/call.
  const readDocumentBinding = bindings.readDocument
  const readEmbedProviderBinding = bindings.readEmbedProvider
  const readAttachmentJobsBinding = bindings.readAttachmentJobs
  const attachmentBatches = toRaw(bindings.readAttachmentBatches())
  const attachmentItems = toRaw(bindings.readAttachmentItems())
  const publishEmbedResultsBinding = bindings.publishEmbedResults
  const attachmentCaptureSession = bindings.attachmentCaptureSession
  const readDocument: MarkdownAttachmentEmbedOwnerBindings['readDocument'] =
    () => Reflect.apply(readDocumentBinding, bindings, [])
  const readEmbedProvider: MarkdownAttachmentEmbedOwnerBindings['readEmbedProvider'] =
    () => Reflect.apply(readEmbedProviderBinding, bindings, [])
  const readAttachmentJobs: MarkdownAttachmentEmbedOwnerBindings['readAttachmentJobs'] =
    () => Reflect.apply(readAttachmentJobsBinding, bindings, [])
  const mapSize = Object.getOwnPropertyDescriptor(Map.prototype, 'size')!.get!
  const readContainerSize = (container: ReadonlyMap<string, unknown>) => {
    if (Object.getPrototypeOf(container) !== Map.prototype)
      throw new Error('editor-session-attachment-container-unavailable')
    return Reflect.apply(mapSize, container, []) as number
  }
  // Capture the native getter from this Vue instance; custom/computed ref getters
  // are not an observation contract and cannot grant result admission.
  const nativeRefPrototype = Object.getPrototypeOf(ref())
  const nativeRefGetter = Object.getOwnPropertyDescriptor(
    nativeRefPrototype,
    'value',
  )!.get!
  const readNativeRef = <T>(source: Ref<T>): T => {
    if (
      Object.getPrototypeOf(source) !== nativeRefPrototype ||
      Object.hasOwn(source, 'value')
    )
      throw new Error('editor-session-attachment-input-unavailable')
    return Reflect.apply(nativeRefGetter, source, []) as T
  }
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
  // Completion authority is per invocation, never a presentation version.
  const embedAttempts = new Map<string, object>()
  const versions = new Map<string, number>()
  let results = new Map<string, MarkdownEmbedResult>()
  let nodes: readonly MarkdownEmbedValidNode[] = []
  let embedGeneration = 0
  let attachmentGeneration = 0
  let pauseRequested = false
  let disposed = false
  // Detect synchronous owner reentry while consuming external snapshots.
  let boundaryRef: object = Object.freeze({})
  const beginBoundary = (next: object = Object.freeze({})) =>
    (boundaryRef = next)
  let watcherTransitions = 0
  let requestTransitions = 0
  const createOwnedEmbedRequest = (
    input: Parameters<typeof createMarkdownEmbedRequest>[0],
  ) => {
    requestTransitions += 1
    try {
      return createMarkdownEmbedRequest(input)
    } finally {
      requestTransitions -= 1
    }
  }
  let watchInputs:
    | {
        sources: readonly WatchSource[]
        readNodes: () => readonly MarkdownEmbedValidNode[]
      }
    | undefined
  let stopWatcher: WatchStopHandle | undefined
  let attachmentInputs: MarkdownAttachmentEmbedInputs | undefined
  let stopAttachmentWatcher: WatchStopHandle | undefined
  let attachmentObservationRef: object = Object.freeze({})
  const invalidateAttachmentObservation = () => {
    attachmentObservationRef = Object.freeze({})
  }
  const readAttachmentFrame = () => {
    const inputs = attachmentInputs
    const version = attachmentObservationRef
    if (!inputs) throw new Error('editor-session-attachment-input-unavailable')
    const identity = snapshotPassiveRecord(toRaw(inputs.documentIdentity))
    const revision = readNativeRef(inputs.revision)
    const jobs = snapshotJobs(readNativeRef(inputs.jobs))
    if (
      !identity ||
      typeof identity.id !== 'string' ||
      !Number.isSafeInteger(identity.epoch) ||
      !Number.isSafeInteger(revision) ||
      !jobs ||
      version !== attachmentObservationRef
    )
      throw new Error('editor-session-attachment-input-unavailable')
    return Object.freeze({
      version,
      context: Object.freeze({
        id: identity.id,
        epoch: identity.epoch,
        revision,
      }),
      jobs,
    })
  }
  const stopAttachmentWatching = () => {
    invalidateAttachmentObservation()
    const previous = stopAttachmentWatcher
    stopAttachmentWatcher = undefined
    if (!previous) return
    watcherTransitions += 1
    try {
      previous()
    } finally {
      watcherTransitions -= 1
    }
  }
  const startAttachmentWatching = () => {
    if (!attachmentInputs || pauseRequested || disposed) return
    const inputs = attachmentInputs
    const boundary = boundaryRef
    readAttachmentFrame()
    invalidateAttachmentObservation()
    watcherTransitions += 1
    try {
      const watcher = watch(
        [inputs.documentIdentity, inputs.revision, inputs.jobs],
        invalidateAttachmentObservation,
        { flush: 'sync', deep: true },
      )
      if (boundaryRef !== boundary || pauseRequested || disposed) {
        watcher()
        return
      }
      stopAttachmentWatcher = watcher
    } finally {
      watcherTransitions -= 1
    }
  }
  const readDocumentContext = () => {
    const document = readDocument()
    return {
      revision: document.revision,
      id: document.documentIdentity.id,
      epoch: document.documentIdentity.epoch,
    }
  }
  const sameDocumentContext = (
    left: ReturnType<typeof readDocumentContext>,
    right: ReturnType<typeof readDocumentContext>,
  ) =>
    left.revision === right.revision &&
    left.id === right.id &&
    left.epoch === right.epoch
  const readAttachmentObservation = () => {
    if (
      !stopAttachmentWatcher ||
      watcherTransitions !== 0 ||
      pauseRequested ||
      disposed
    )
      throw new Error('editor-session-attachment-observation-unavailable')
    const before = readAttachmentFrame()
    // All supplied callbacks execute inside the real synchronous Vue fence.
    const suppliedDocument = snapshotPassiveRecord(readDocument())
    const suppliedIdentity =
      suppliedDocument &&
      snapshotPassiveRecord(toRaw(suppliedDocument.documentIdentity))
    const suppliedJobs = snapshotJobs(readAttachmentJobs())
    const after = readAttachmentFrame()
    if (
      !suppliedDocument ||
      !suppliedIdentity ||
      !suppliedJobs ||
      before.version !== attachmentObservationRef ||
      before.version !== after.version ||
      !sameDocumentContext(before.context, after.context) ||
      !sameDocumentContext(before.context, {
        id: suppliedIdentity.id,
        epoch: suppliedIdentity.epoch,
        revision: suppliedDocument.revision,
      }) ||
      !sameJobs(before.jobs, after.jobs) ||
      !sameJobs(suppliedJobs, after.jobs) ||
      !stopAttachmentWatcher ||
      pauseRequested ||
      disposed
    )
      throw new Error('editor-session-attachment-observation-invalidated')
    // No consumer read callback follows this immutable observation.
    return after
  }
  const readEmbedContext = () => {
    const provider = readEmbedProvider()
    return { ...readDocumentContext(), provider }
  }
  const sameEmbedContext = (
    left: ReturnType<typeof readEmbedContext>,
    right: ReturnType<typeof readEmbedContext>,
  ) => left.provider === right.provider && sameDocumentContext(left, right)

  const stopWatching = () => {
    const previous = stopWatcher
    stopWatcher = undefined
    if (previous) {
      watcherTransitions += 1
      try {
        previous()
      } finally {
        watcherTransitions -= 1
      }
    }
  }
  const startWatching = () => {
    if (!watchInputs || pauseRequested || disposed) return
    const inputs = watchInputs
    const boundary = boundaryRef
    let watcher: WatchStopHandle | undefined
    const refreshFromInputs = () => {
      if (stopWatcher !== watcher || pauseRequested || disposed) return
      const boundary = boundaryRef
      const context = readEmbedContext()
      const nextNodes = inputs.readNodes()
      const now = readEmbedContext()
      if (
        sameEmbedContext(context, now) &&
        boundaryRef === boundary &&
        stopWatcher === watcher &&
        !pauseRequested &&
        !disposed
      )
        refreshEmbeds(nextNodes)
    }
    watcherTransitions += 1
    try {
      watcher = watch([...inputs.sources], refreshFromInputs)
      if (boundaryRef !== boundary || pauseRequested || disposed) {
        watcher()
        return
      }
      stopWatcher = watcher
    } finally {
      watcherTransitions -= 1
    }
    refreshFromInputs()
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
    embedAttempts.clear()
    const epoch = embedGeneration
    const operations = [...active]
    const retired = [...draining]
    for (const operation of operations) {
      operation.controller.abort()
      cancelMarkdownEmbedRequest(operation.request)
    }
    for (const request of retired) cancelMarkdownEmbedRequest(request)
    return epoch
  }
  const inspect = (): MarkdownEditorSessionResourceInspection => {
    if (watcherTransitions !== 0)
      throw new Error('editor-session-attachment-embed-watcher-transition')
    if (requestTransitions !== 0)
      throw new Error('editor-session-attachment-embed-request-transition')
    const boundary = boundaryRef
    collectDraining()
    const frame = readAttachmentFrame()
    const jobs = frame.jobs
    const currentJobs = new Set(jobs)
    for (const job of currentJobs) observedAttachmentJobs.add(job)
    const attachmentRunning = new Set(attachmentTasks.keys())
    for (const job of observedAttachmentJobs) {
      if (!isPassiveRecord(job))
        throw new Error('editor-session-attachment-job-state-unavailable')
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
    const capture = inspectMarkdownAttachmentCaptureResources(
      attachmentCaptureSession,
    )
    const jobCount = jobs.length
    const batchCount = readContainerSize(attachmentBatches)
    const itemCount = readContainerSize(attachmentItems)
    if (boundaryRef !== boundary || frame.version !== attachmentObservationRef)
      throw new Error('editor-session-attachment-embed-inspection-reentered')
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
        stopAttachmentWatcher === undefined &&
        backgroundTasks === 0 &&
        timers === 0 &&
        retainedListeners === 0,
      // No checkpoint exists for provider results, job ranges/attempts or opaque uploads.
      // Only an empty lifecycle can be reconstructed without inventing restoration proof.
      recoverable:
        backgroundTasks === 0 &&
        jobCount === 0 &&
        observedAttachmentJobs.size === 0 &&
        batchCount === 0 &&
        itemCount === 0 &&
        capture.memoryUnits === 0 &&
        results.size === 0 &&
        embedAttempts.size === 0 &&
        nodes.length === 0 &&
        versions.size === 0,
      retainedListeners,
      usage: Object.freeze({
        editorInstances: 0,
        renderers: 0,
        observers: (stopWatcher ? 1 : 0) + (stopAttachmentWatcher ? 1 : 0),
        timers,
        backgroundTasks,
        // This library performs no network I/O. Opaque consumer work blocks pause
        // through actual dispatch/provider futures; it is never reported as cancelled.
        networkRequests: 0,
        memoryUnits:
          active.size +
          draining.size +
          jobCount +
          observedAttachmentJobs.size +
          attachmentTasks.size +
          batchCount +
          itemCount +
          capture.memoryUnits +
          results.size +
          embedAttempts.size +
          versions.size +
          nodes.length +
          (stopWatcher ? 1 : 0) +
          (stopAttachmentWatcher ? 1 : 0),
      }),
    })
  }
  const publish = () =>
    Reflect.apply(publishEmbedResultsBinding, bindings, [new Map(results)])
  const resolveEmbedAttempt = async (
    node: MarkdownEmbedValidNode,
    admission: object,
  ): Promise<void> => {
    if (pauseRequested || disposed) return
    const boundary = beginBoundary(admission)
    const context = readEmbedContext()
    const id = nodeId(node)
    const target = node.target
    const mode = node.mode
    const now = readEmbedContext()
    if (
      !sameEmbedContext(context, now) ||
      boundaryRef !== boundary ||
      pauseRequested ||
      disposed
    )
      return
    const provider = context.provider
    const documentIdentity = Object.freeze({
      id: context.id,
      epoch: context.epoch,
    })
    const revision = context.revision
    if (!provider) {
      embedAttempts.delete(id)
      return
    }
    const attemptRef = Object.freeze({})
    embedAttempts.set(id, attemptRef)
    const version = (versions.get(id) ?? 0) + 1
    versions.set(id, version)
    const epoch = embedGeneration
    const controller = new AbortController()
    let operation:
      | { controller: AbortController; request: MarkdownEmbedRequest }
      | undefined
    const current = (checkSignal = true) => {
      const now = readEmbedContext()
      return (
        !disposed &&
        !pauseRequested &&
        !controller.signal.aborted &&
        (!checkSignal || !operation?.request.signal?.aborted) &&
        embedGeneration === epoch &&
        embedAttempts.get(id) === attemptRef &&
        sameEmbedContext(context, now)
      )
    }
    try {
      // Admission can refuse capacity before any request handle exists.
      operation = {
        controller,
        request: createOwnedEmbedRequest({
          documentIdentity,
          revision,
          nodeId: id,
          target,
          mode,
          version,
          signal: controller.signal,
        }),
      }
      active.add(operation)
      const subtle = globalThis.crypto?.subtle
      if (!current()) return
      if (subtle) {
        try {
          operation.request = await bindMarkdownEmbedRequestDigest(
            operation.request,
          )
        } catch {
          // Preserve the existing metadata fallback, but never restart cancelled work.
          if (!current(false)) return
          operation.request = createOwnedEmbedRequest({
            documentIdentity,
            revision,
            nodeId: id,
            target,
            mode,
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
      const committed = commitMarkdownEmbedResult(operation.request, result)
      if (!current()) return
      results.set(id, committed)
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
      if (embedAttempts.get(id) === attemptRef) embedAttempts.delete(id)
      if (operation) {
        active.delete(operation)
        draining.add(operation.request)
        try {
          if (controller.signal.aborted)
            cancelMarkdownEmbedRequest(operation.request)
          else
            forgetMarkdownEmbedRequest(
              operation.request.requestId,
              operation.request,
            )
        } finally {
          collectDraining()
        }
      } else controller.abort()
    }
  }
  const resolveEmbedNode = (node: MarkdownEmbedValidNode) =>
    resolveEmbedAttempt(node, Object.freeze({}))
  const refreshEmbeds = (nextNodes: readonly MarkdownEmbedValidNode[]) => {
    if (disposed) throw new Error('editor-session-attachment-embed-disposed')
    if (pauseRequested)
      throw new Error('editor-session-attachment-embed-paused')
    const boundary = beginBoundary()
    const context = readEmbedContext()
    if (boundaryRef !== boundary || pauseRequested || disposed) return
    const epoch = cancel()
    const next = [...nextNodes]
    const ids = new Set(next.map(nodeId))
    const currentRefresh = (expected: object = boundary) => {
      const now = readEmbedContext()
      return (
        sameEmbedContext(context, now) &&
        boundaryRef === expected &&
        embedGeneration === epoch &&
        !pauseRequested &&
        !disposed
      )
    }
    if (!currentRefresh()) return
    nodes = next
    results = new Map([...results].filter(([id]) => ids.has(id)))
    for (const id of versions.keys()) if (!ids.has(id)) versions.delete(id)
    publish()
    if (!currentRefresh()) return
    let expectedBoundary = boundary
    for (const node of next) {
      if (!currentRefresh(expectedBoundary)) return
      expectedBoundary = Object.freeze({})
      void resolveEmbedAttempt(node, expectedBoundary)
    }
  }
  const participant: MarkdownEditorSessionResourceParticipant = Object.freeze({
    ownerRef: 'attachment-embed',
    inspect,
    pause() {
      const boundary = beginBoundary()
      attachmentGeneration += 1
      pauseRequested = true
      stopWatching()
      stopAttachmentWatching()
      if (boundaryRef === boundary) cancel()
      return inspect()
    },
    resume() {
      if (disposed) throw new Error('editor-session-attachment-embed-disposed')
      beginBoundary()
      const wasPaused = pauseRequested
      pauseRequested = false
      if (wasPaused) {
        startAttachmentWatching()
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
      beginBoundary()
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
    const boundary = boundaryRef
    let observation: ReturnType<typeof readAttachmentObservation>
    try {
      observation = readAttachmentObservation()
    } catch {
      return false
    }
    const context = observation.context
    const ownsJob = observation.jobs.includes(proof.job)
    const job = snapshotPassiveRecord(proof.job)
    const delivered = snapshotPassiveRecord(result)
    if (!ownsJob || !job || !delivered) return false
    const jobIdentity =
      job.documentIdentity && snapshotPassiveRecord(job.documentIdentity)
    const resultIdentity =
      delivered.documentIdentity &&
      snapshotPassiveRecord(delivered.documentIdentity)
    const matches =
      job.itemId === delivered.itemId &&
      job.batchId === delivered.batchId &&
      unfinished(job) &&
      jobIdentity?.id === context.id &&
      jobIdentity.epoch === context.epoch &&
      (!delivered.documentIdentity ||
        (resultIdentity?.id === context.id &&
          resultIdentity.epoch === context.epoch)) &&
      (delivered.revision === undefined || delivered.revision === job.revision)
    const dispatch = inspectMarkdownAttachmentDispatch(proof.job)
    return (
      matches &&
      boundaryRef === boundary &&
      observation.version === attachmentObservationRef &&
      !pauseRequested &&
      !disposed &&
      dispatch?.dispatchRef === proof.dispatchRef &&
      attachmentGeneration === proof.generation &&
      dispatch.attempt === proof.attempt &&
      job.attempt === proof.attempt &&
      (proof.kind === 'progress'
        ? delivered.status === 'progress' && !dispatch.settled
        : delivered.status !== 'progress' && dispatch.settled)
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
      const boundary = beginBoundary()
      const epoch = attachmentGeneration
      const observation = readAttachmentObservation()
      const context = observation.context
      const ownedJob = toRaw(job)
      const jobSnapshot = snapshotPassiveRecord(ownedJob)
      const jobIdentity =
        jobSnapshot?.documentIdentity &&
        snapshotPassiveRecord(toRaw(jobSnapshot.documentIdentity))
      if (!jobSnapshot || !observation.jobs.includes(ownedJob))
        throw new Error('editor-session-attachment-dispatch-job-unavailable')
      const ownsDocument =
        jobIdentity?.id === context.id && jobIdentity.epoch === context.epoch
      if (
        !ownsDocument ||
        observation.version !== attachmentObservationRef ||
        boundaryRef !== boundary ||
        attachmentGeneration !== epoch ||
        disposed ||
        pauseRequested
      )
        throw new Error('editor-session-attachment-dispatch-admission-blocked')
      observedAttachmentJobs.add(ownedJob)
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
            attachmentResults.set(
              result,
              Object.freeze({
                job: ownedJob,
                dispatchRef: state.dispatchRef,
                attempt: state.attempt,
                generation: epoch,
                kind,
              }),
            )
            return acceptsAttachmentResult(result)
          }
          bindSettlement = (result) => {
            // Snapshot actual settled data; no caller can upgrade a progress object.
            const snapshot = { ...result }
            const settled = Object.freeze({
              ...snapshot,
              ...(snapshot.documentIdentity
                ? {
                    documentIdentity: Object.freeze({
                      ...snapshot.documentIdentity,
                    }),
                  }
                : {}),
              ...(snapshot.status === 'resolved'
                ? { payload: Object.freeze({ ...snapshot.payload }) }
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
              current.settled ||
              !isPassiveRecord(progress) ||
              (progress.documentIdentity &&
                !isPassiveRecord(progress.documentIdentity))
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
    bindAttachmentInputs(inputs: MarkdownAttachmentEmbedInputs) {
      if (disposed || attachmentInputs)
        throw new Error(
          'editor-session-attachment-input-already-bound-or-disposed',
        )
      const boundary = beginBoundary()
      const captured = Object.freeze({
        documentIdentity: inputs.documentIdentity,
        revision: inputs.revision,
        jobs: inputs.jobs,
      })
      if (
        !isReactive(captured.documentIdentity) ||
        isReadonly(captured.documentIdentity) ||
        toRaw(captured.documentIdentity) === captured.documentIdentity ||
        boundary !== boundaryRef ||
        disposed ||
        attachmentInputs
      )
        throw new Error('editor-session-attachment-input-unavailable')
      attachmentInputs = captured
      try {
        readAttachmentFrame()
        startAttachmentWatching()
      } catch (error) {
        stopAttachmentWatching()
        attachmentInputs = undefined
        throw error
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
      const boundary = beginBoundary()
      const inputs = { sources: [...sources], readNodes }
      if (boundaryRef !== boundary || disposed || watchInputs)
        throw new Error('editor-session-attachment-embed-watch-bind-reentered')
      watchInputs = inputs
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
      const boundary = beginBoundary()
      attachmentGeneration += 1
      pauseRequested = true
      stopWatching()
      stopAttachmentWatching()
      if (boundaryRef === boundary) cancel()
    },
  })
}
