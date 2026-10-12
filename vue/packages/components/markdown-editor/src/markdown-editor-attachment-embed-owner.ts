import { isReactive, isReadonly, isShallow, ref, watch, toRaw } from 'vue'
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
import {
  bindMarkdownAttachmentConsumerRequest,
  inspectMarkdownAttachmentCaptureResources,
} from './markdown-editor-attachment'
import type {
  MarkdownAttachmentConsumerRequest,
  MarkdownAttachmentConsumerRequestBinding,
  MarkdownAttachmentConsumerCleanupObservation,
  MarkdownAttachmentProviderResult,
  MarkdownAttachmentCaptureSession,
  MarkdownAttachmentBatchIntent,
  MarkdownAttachmentItemIntent,
  MarkdownAttachmentCaptureObservation,
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
    | MarkdownAttachmentBatchIntent
    | {
        readonly batch: MarkdownAttachmentBatchIntent
        readonly capture?: MarkdownAttachmentCaptureObservation
        readonly files: ReadonlyMap<
          MarkdownAttachmentItemIntent,
          {
            readonly file: File
            readonly controller: AbortController
          }
        >
      }
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
  const mapValues = Map.prototype.values
  const readContainerValues = <T>(
    container: ReadonlyMap<unknown, T>,
  ): IterableIterator<T> => Reflect.apply(mapValues, container, [])
  const readContainerSize = (container: ReadonlyMap<unknown, unknown>) => {
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
  type CleanupFuture = {
    readonly work: unknown
    state: 'absent' | 'pending' | 'fulfilled' | 'rejected' | 'unknown'
    cause?: unknown
  }
  type ConsumerCleanup = {
    readonly snapshot: MarkdownAttachmentConsumerCleanupObservation
    readonly work: CleanupFuture
    readonly observer: CleanupFuture
    readonly monitor?: Promise<void>
    done: boolean
  }
  type ConsumerEntry = {
    readonly dispatchRef: object
    readonly job: MarkdownAttachmentJob
    readonly attempt: number
    readonly generation: number
    returned: unknown
    binding?: MarkdownAttachmentConsumerRequestBinding
    unknown?: string
    cause?: unknown
    readonly cleanup: ConsumerCleanup[]
    unknownObserverWork?: Promise<void>
  }
  const consumers = new Map<object, ConsumerEntry>()
  // Binding chains are not global ownership: this owner deduplicates originals.
  const consumerRequests = new WeakSet<object>()
  const consumerFutures = new WeakSet<object>()
  let consumerControlDepth = 0
  const consumerControl = <T>(control: () => T): T => {
    consumerControlDepth += 1
    try {
      return control()
    } finally {
      consumerControlDepth -= 1
    }
  }
  const consumerFuture = (work: unknown): work is PromiseLike<void> => {
    if (
      (typeof work !== 'object' || work === null) &&
      typeof work !== 'function'
    )
      return false
    let value: object | null = work as object
    const seen = new Set<object>()
    while (value && !seen.has(value)) {
      seen.add(value)
      const then = Object.getOwnPropertyDescriptor(value, 'then')
      if (then) return 'value' in then && typeof then.value === 'function'
      value = Object.getPrototypeOf(value)
    }
    return false
  }
  const retainCleanup = (entry: ConsumerEntry) => {
    const binding = entry.binding
    if (!binding) return
    for (const snapshot of binding.inspectCleanup()) {
      if (
        entry.cleanup.some(
          (record) =>
            record.snapshot.operation === snapshot.operation &&
            record.snapshot.status === snapshot.status &&
            record.snapshot.work === snapshot.work &&
            record.snapshot.observerWork === snapshot.observerWork &&
            record.snapshot.checkpoint === snapshot.checkpoint &&
            record.snapshot.cause === snapshot.cause &&
            record.snapshot.observationCause === snapshot.observationCause,
        )
      )
        continue
      const work: CleanupFuture = {
        work: snapshot.work,
        state: snapshot.work === undefined ? 'absent' : 'pending',
      }
      const observer: CleanupFuture = {
        work: snapshot.observerWork,
        state: snapshot.observerWork === undefined ? 'absent' : 'pending',
      }
      const record = {
        snapshot,
        work,
        observer,
        done: false,
      } as ConsumerCleanup
      const observe = async (future: CleanupFuture) => {
        if (future.state === 'absent') return
        if (!consumerFuture(future.work)) {
          future.state = 'unknown'
          return
        }
        try {
          await future.work
          future.state = 'fulfilled'
        } catch (cause) {
          future.state = 'rejected'
          future.cause = cause
        }
      }
      // Await the TWO original futures. The binder's status is not observer settlement.
      if (work.state === 'absent' && observer.state === 'absent')
        record.done = true
      else
        Object.assign(record, {
          monitor: (async () => {
            await Promise.all([observe(work), observe(observer)])
            record.done = true
          })(),
        })
      entry.cleanup.push(record)
    }
  }
  const cancelConsumers = (reason: string) => {
    const failures: unknown[] = []
    for (const entry of [...consumers.values()]) {
      if (!entry.binding) {
        failures.push(
          new Error(entry.unknown ?? 'attachment-consumer-request-unavailable'),
        )
        continue
      }
      try {
        consumerControl(() => retainCleanup(entry))
      } catch (cause) {
        entry.cause = cause
        failures.push(cause)
        continue
      }
      if (entry.cleanup.some((record) => !record.done)) continue // Existing actual cancellation/observer remains pending.
      try {
        consumerControl(() => {
          try {
            entry.binding!.cancelLocal(reason)
          } finally {
            retainCleanup(entry)
          }
        })
      } catch (cause) {
        entry.cause = cause
        failures.push(cause)
      }
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        'editor-session-attachment-consumer-cancel-failed',
      )
  }
  const inspectConsumers = () => {
    const counts = {
      backgroundTasks: 0,
      timers: 0,
      observers: 0,
      retainedListeners: 0,
      networkRequests: 0,
      memoryUnits: 0,
    }
    for (const entry of [...consumers.values()]) {
      if (!entry.binding || entry.unknown)
        throw new Error(
          entry.unknown ?? 'editor-session-attachment-consumer-unavailable',
        )
      const binding = entry.binding
      consumerControl(() => retainCleanup(entry))
      const local = inspectMarkdownAttachmentDispatch(entry.job)
      if (
        local?.dispatchRef !== entry.dispatchRef ||
        local.attempt !== entry.attempt ||
        local.localSettlement === 'unknown'
      )
        throw new Error(
          'editor-session-attachment-consumer-settlement-unavailable',
        )
      const resource = consumerControl(() => binding.inspectLocalResources())
      if (resource.supported === false) {
        entry.cause = resource
        throw new Error(resource.reason)
      }
      const pending = entry.cleanup.filter((record) => !record.done).length
      if (
        entry.cleanup.some(
          (record) =>
            record.work.state === 'unknown' ||
            record.observer.state === 'unknown',
        )
      )
        throw new Error(
          'editor-session-attachment-consumer-cleanup-unobservable',
        )
      const checkpoint = binding.getRetainedCheckpoint()
      const empty = Object.values(resource.value).every((count) => count === 0)
      if (
        empty &&
        local.settled &&
        local.localSettlement === 'fulfilled' &&
        !pending &&
        !checkpoint
      ) {
        consumerControl(() => binding.retire())
        consumers.delete(entry.dispatchRef)
        continue
      }
      for (const key of Object.keys(counts) as (keyof typeof counts)[])
        counts[key] += resource.value[key]
      counts.backgroundTasks += pending
      // These actual retained records/future/checkpoint references outlive callbacks.
      counts.memoryUnits +=
        2 +
        entry.cleanup.reduce(
          (sum, record) =>
            sum +
            1 +
            (record.snapshot.work !== undefined ? 1 : 0) +
            (record.snapshot.observerWork !== undefined ? 1 : 0) +
            (record.snapshot.checkpoint ? 1 : 0) +
            (record.snapshot.cause !== undefined ? 1 : 0) +
            (record.snapshot.observationCause !== undefined ? 1 : 0),
          0,
        ) +
        (checkpoint ? 1 : 0)
    }
    return counts
  }
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
  let lifecycleTransition: object | undefined
  const ownedWatchers = new Set<WatchStopHandle>()
  const failedWatcherStops = new Map<WatchStopHandle, unknown>()
  let watcherConstructionFailure: { readonly error: unknown } | undefined
  const assertLifecycleIdle = (cleanupOnly = false) => {
    if (
      lifecycleTransition ||
      watcherTransitions !== 0 ||
      requestTransitions !== 0 ||
      consumerControlDepth !== 0
    )
      throw new Error('editor-session-attachment-embed-lifecycle-transition')
    if (!cleanupOnly && (failedWatcherStops.size || watcherConstructionFailure))
      throw new Error('editor-session-attachment-embed-watcher-unavailable')
  }
  const withLifecycleTransition = <T>(
    action: (transition: object) => T,
    cleanupOnly = false,
  ): T => {
    // Reject before boundary/generation/phase or any native handle changes.
    assertLifecycleIdle(cleanupOnly)
    const transition = Object.freeze({})
    lifecycleTransition = transition
    try {
      return action(transition)
    } finally {
      lifecycleTransition = undefined
    }
  }
  const assertLifecycleTransition = (transition: object) => {
    if (lifecycleTransition !== transition)
      throw new Error('editor-session-attachment-embed-lifecycle-transition')
  }
  const createOwnedWatcher = (create: () => WatchStopHandle) => {
    watcherTransitions += 1
    try {
      const watcher = create()
      ownedWatchers.add(watcher)
      return watcher
    } catch (error) {
      // Native construction did not return a cleanup capability. Never infer zero.
      watcherConstructionFailure = Object.freeze({ error })
      throw error
    } finally {
      watcherTransitions -= 1
    }
  }
  const stopOwnedWatcher = (watcher: WatchStopHandle) => {
    watcherTransitions += 1
    try {
      watcher()
      ownedWatchers.delete(watcher)
    } catch (error) {
      // A later idempotent stop cannot prove a throwing cleanup completed.
      failedWatcherStops.set(watcher, error)
      throw error
    } finally {
      watcherTransitions -= 1
    }
  }
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
    const liveJobs = readNativeRef(inputs.jobs)
    const jobs = snapshotJobs(liveJobs)
    // The existing deep ref must really proxy every mutable job. A shallow or
    // markRaw replacement cannot provide synchronous mutation invalidation.
    const reactiveJobs =
      isReactive(liveJobs) &&
      !isShallow(inputs.jobs) &&
      jobs?.every((_, index) => isReactive(liveJobs[index]))
    if (
      !identity ||
      typeof identity.id !== 'string' ||
      !Number.isSafeInteger(identity.epoch) ||
      !Number.isSafeInteger(revision) ||
      !jobs ||
      !reactiveJobs ||
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
  const startAttachmentWatching = (transition: object) => {
    assertLifecycleTransition(transition)
    if (!attachmentInputs || pauseRequested || disposed) return
    if (stopAttachmentWatcher)
      throw new Error('editor-session-attachment-watch-already-running')
    const inputs = attachmentInputs
    const boundary = boundaryRef
    readAttachmentFrame()
    invalidateAttachmentObservation()
    const watcher = createOwnedWatcher(() =>
      watch(
        [inputs.documentIdentity, inputs.revision, inputs.jobs],
        invalidateAttachmentObservation,
        { flush: 'sync', deep: true },
      ),
    )
    if (boundaryRef !== boundary || pauseRequested || disposed) {
      stopOwnedWatcher(watcher)
      return
    }
    stopAttachmentWatcher = watcher
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
      lifecycleTransition !== undefined ||
      failedWatcherStops.size !== 0 ||
      watcherConstructionFailure !== undefined ||
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

  const stopAllWatching = (transition: object) => {
    assertLifecycleTransition(transition)
    invalidateAttachmentObservation()
    // Detach both handles before either native stop can invoke consumer cleanup.
    // The owned set retains them until each actual stop returns successfully.
    const previous = [stopWatcher, stopAttachmentWatcher]
    stopWatcher = undefined
    stopAttachmentWatcher = undefined
    const failures: unknown[] = []
    for (const watcher of previous) {
      if (!watcher) continue
      try {
        stopOwnedWatcher(watcher)
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        'editor-session-attachment-embed-watcher-stop-failed',
      )
  }
  const startWatching = (transition: object) => {
    assertLifecycleTransition(transition)
    if (!watchInputs || pauseRequested || disposed) return
    if (stopWatcher)
      throw new Error('editor-session-embed-watch-already-running')
    const inputs = watchInputs
    const boundary = boundaryRef
    let watcher: WatchStopHandle | undefined
    const refreshFromInputs = (admission?: object) => {
      if (lifecycleTransition && lifecycleTransition !== admission) return
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
    watcher = createOwnedWatcher(() =>
      watch([...inputs.sources], () => refreshFromInputs()),
    )
    if (boundaryRef !== boundary || pauseRequested || disposed) {
      stopOwnedWatcher(watcher)
      return
    }
    stopWatcher = watcher
    refreshFromInputs(transition)
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
    const operations = [...active].map(({ controller, request }) => ({
      controller,
      request,
    }))
    const retired = [...draining]
    const failures: unknown[] = []
    for (const operation of operations) {
      try {
        operation.controller.abort()
      } catch (error) {
        failures.push(error)
      }
      // Abort failure must not skip this request's original cleanup capability.
      try {
        cancelMarkdownEmbedRequest(operation.request)
      } catch (error) {
        failures.push(error)
      }
    }
    for (const request of retired) {
      try {
        cancelMarkdownEmbedRequest(request)
      } catch (error) {
        failures.push(error)
      }
    }
    // References and async ownership remain until their actual settlement/cleanup.
    if (failures.length)
      throw new AggregateError(
        failures,
        'editor-session-attachment-embed-cancel-failed',
      )
    return epoch
  }
  const inspectState = (
    transition?: object,
  ): MarkdownEditorSessionResourceInspection => {
    if (lifecycleTransition && lifecycleTransition !== transition)
      throw new Error('editor-session-attachment-embed-lifecycle-transition')
    if (failedWatcherStops.size || watcherConstructionFailure)
      throw new Error('editor-session-attachment-embed-watcher-unavailable')
    if (consumerControlDepth)
      throw new Error('editor-session-attachment-consumer-control-transition')
    if (watcherTransitions !== 0)
      throw new Error('editor-session-attachment-embed-watcher-transition')
    if (requestTransitions !== 0)
      throw new Error('editor-session-attachment-embed-request-transition')
    const boundary = boundaryRef
    collectDraining()
    const frame = readAttachmentFrame()
    const consumer = inspectConsumers()
    if (frame.version !== attachmentObservationRef || boundaryRef !== boundary)
      throw new Error(
        'editor-session-attachment-consumer-inspection-invalidated',
      )
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
    // Read the actual revocable records from the same original batch Map.
    // Metadata-only owners have no File loans; native records retain their own
    // File/controller entries and accepted capture placements until revocation.
    let fileMemoryUnits = 0
    for (const value of readContainerValues(attachmentBatches)) {
      const record = snapshotPassiveRecord(value)
      if (!record)
        throw new Error('editor-session-attachment-file-record-unavailable')
      if ('files' in record) {
        fileMemoryUnits += 1 + readContainerSize(record.files) * 2
        if (record.capture)
          fileMemoryUnits += 1 + record.capture.placements.length
      }
    }
    if (boundaryRef !== boundary || frame.version !== attachmentObservationRef)
      throw new Error('editor-session-attachment-embed-inspection-reentered')
    const requests = new Set([...active].map((operation) => operation.request))
    for (const request of draining) requests.add(request)
    let timers = consumer.timers
    let retainedListeners = consumer.retainedListeners
    let preparationTasks = 0
    for (const request of requests) {
      const resources = inspectMarkdownEmbedRequestResources(request)
      timers += resources.timers
      retainedListeners += resources.retainedListeners
      preparationTasks += resources.backgroundTasks
    }
    const backgroundTasks =
      active.size +
      preparationTasks +
      attachmentRunning.size +
      consumer.backgroundTasks
    return Object.freeze({
      ownerRef: 'attachment-embed',
      paused:
        pauseRequested &&
        stopWatcher === undefined &&
        stopAttachmentWatcher === undefined &&
        ownedWatchers.size === 0 &&
        consumer.observers === 0 &&
        consumer.networkRequests === 0 &&
        backgroundTasks === 0 &&
        timers === 0 &&
        retainedListeners === 0,
      // No checkpoint exists for provider results, job ranges/attempts or opaque uploads.
      // Only an empty lifecycle can be reconstructed without inventing restoration proof.
      recoverable:
        backgroundTasks === 0 &&
        jobCount === 0 &&
        observedAttachmentJobs.size === 0 &&
        consumers.size === 0 &&
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
        observers: ownedWatchers.size + consumer.observers,
        timers,
        backgroundTasks,
        // Scope-reported native requests; this is not all-business-work qualification.
        networkRequests: consumer.networkRequests,
        memoryUnits:
          active.size +
          draining.size +
          jobCount +
          observedAttachmentJobs.size +
          attachmentTasks.size +
          batchCount +
          itemCount +
          fileMemoryUnits +
          capture.memoryUnits +
          results.size +
          embedAttempts.size +
          versions.size +
          nodes.length +
          ownedWatchers.size +
          consumer.memoryUnits,
      }),
    })
  }
  const inspect = () => inspectState()
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
  const resolveEmbedNode = (node: MarkdownEmbedValidNode) => {
    assertLifecycleIdle()
    return resolveEmbedAttempt(node, Object.freeze({}))
  }
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
  const pauseLifecycle = (transition: object) => {
    assertLifecycleTransition(transition)
    const boundary = beginBoundary()
    attachmentGeneration += 1
    pauseRequested = true
    const failures: unknown[] = []
    try {
      stopAllWatching(transition)
    } catch (error) {
      failures.push(error)
    }
    try {
      cancelConsumers('editor-session-pause')
    } catch (cause) {
      failures.push(cause)
    }
    try {
      if (boundaryRef === boundary) cancel()
    } catch (error) {
      failures.push(error)
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        'editor-session-attachment-embed-pause-failed',
      )
  }
  const participant: MarkdownEditorSessionResourceParticipant = Object.freeze({
    ownerRef: 'attachment-embed',
    inspect,
    pause() {
      return withLifecycleTransition((transition) => {
        pauseLifecycle(transition)
        return inspectState(transition)
      }, true)
    },
    resume() {
      return withLifecycleTransition((transition) => {
        if (disposed)
          throw new Error('editor-session-attachment-embed-disposed')
        beginBoundary()
        const wasPaused = pauseRequested
        pauseRequested = false
        if (wasPaused) {
          startAttachmentWatching(transition)
          if (watchInputs) startWatching(transition)
          else refreshEmbeds(nodes)
        }
        return inspectState(transition)
      })
    },
    dispose(snapshotRef: string) {
      return withLifecycleTransition((transition) => {
        const state = inspectState(transition)
        if (!snapshotRef || !state.paused || !state.recoverable)
          throw new Error(
            'editor-session-attachment-embed-checkpoint-not-recoverable',
          )
        beginBoundary()
        disposed = true
        attachmentGeneration += 1
        cancel()
      })
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
  const runAttachmentDispatch = async (
    job: MarkdownAttachmentJob,
    dispatch: (
      admitProgress: (result: MarkdownAttachmentProviderResult) => boolean,
    ) => unknown,
    requireConsumer: boolean,
  ): Promise<MarkdownAttachmentProviderResult> => {
    assertLifecycleIdle()
    if (disposed || pauseRequested)
      throw new Error('editor-session-attachment-dispatch-admission-blocked')
    const boundary = beginBoundary()
    const epoch = attachmentGeneration
    const observation = readAttachmentObservation()
    const context = observation.context
    const ownedJob = toRaw(job)
    if ([...consumers.values()].some((entry) => entry.job === ownedJob))
      throw new Error(
        'editor-session-attachment-consumer-previous-attempt-retained',
      )
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
        const consumer: ConsumerEntry = {
          dispatchRef,
          job: ownedJob,
          attempt: state.attempt,
          generation: epoch,
          returned: undefined,
          unknown: 'consumer-dispatch-not-returned',
          cleanup: [],
        }
        consumers.set(dispatchRef, consumer)
        let work: unknown
        try {
          work = dispatch((progress) => {
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
        } catch (cause) {
          consumer.cause = cause
          consumer.unknown = 'consumer-dispatch-failed'
          throw cause
        }
        consumer.returned = work
        let capability
        try {
          capability = consumerControl(() =>
            bindMarkdownAttachmentConsumerRequest(work),
          )
        } catch (cause) {
          consumer.cause = cause
          consumer.unknown = 'consumer-binding-failed'
          throw cause
        }
        if (capability.supported) {
          const binding = capability.value
          if (
            binding.request !== work ||
            consumerRequests.has(binding.request) ||
            consumerFutures.has(binding.result as object) ||
            consumerFutures.has(binding.settled as object)
          ) {
            consumer.unknown = 'consumer-request-or-future-reused'
            throw new Error(consumer.unknown)
          }
          consumerRequests.add(binding.request)
          consumerFutures.add(binding.result as object)
          consumerFutures.add(binding.settled as object)
          consumer.binding = binding
          consumer.unknown = undefined
          // Forward the TWO actual original futures; never start another service.
          return Object.freeze({
            result: binding.result,
            settled: binding.settled,
          })
        }
        consumer.unknown = capability.reason
        if (requireConsumer) {
          if (consumerFuture(work)) {
            consumerFutures.add(work as object)
            // Observe actual unknown returned work without claiming all-work settlement.
            consumer.unknownObserverWork = (async () => {
              try {
                await work
              } catch (cause) {
                consumer.cause = cause
              }
            })()
          }
          throw new Error(capability.reason)
        }
        // Legacy content can consume its real result, but its opaque scope stays unknown.
        // An event emission or terminal label is not a settlement future.
        if (!consumerFuture(work)) {
          throw new Error(
            'editor-session-attachment-dispatch-settlement-unavailable',
          )
        }
        consumerFutures.add(work as object)
        return work as unknown as PromiseLike<MarkdownAttachmentProviderResult>
      })
      // Ledger settlement happens before final provenance is issued.
      return bindSettlement!(result)
    } catch (cause) {
      const retained = dispatchRef && consumers.get(dispatchRef)
      if (retained) retained.cause = cause
      throw cause
    } finally {
      if (dispatchRef) attachmentTasks.delete(dispatchRef)
    }
  }
  return Object.freeze({
    participant,
    runAttachmentDispatch(
      job: MarkdownAttachmentJob,
      dispatch: (
        admitProgress: (result: MarkdownAttachmentProviderResult) => boolean,
      ) => PromiseLike<MarkdownAttachmentProviderResult>,
    ) {
      return runAttachmentDispatch(job, dispatch, false)
    },
    runAttachmentConsumerRequest(
      job: MarkdownAttachmentJob,
      dispatch: (
        admitProgress: (result: MarkdownAttachmentProviderResult) => boolean,
      ) => MarkdownAttachmentConsumerRequest | unknown,
    ) {
      return runAttachmentDispatch(job, dispatch, true)
    },
    readAttachmentConsumerSource() {
      if (consumerControlDepth || lifecycleTransition)
        throw new Error('editor-session-attachment-consumer-control-transition')
      return Object.freeze({
        complete: false as const,
        sourceReview: 'unqualified' as const,
        producerHead: 'acdafdb18ee4668d6db8705837ff5e73c83a2f6e',
        businessCoverage: 'not-proven' as const,
        requests: Object.freeze(
          [...consumers.values()].map((entry) =>
            Object.freeze({
              dispatchRef: entry.dispatchRef,
              job: entry.job,
              attempt: entry.attempt,
              generation: entry.generation,
              returned: entry.returned,
              request: entry.binding?.request,
              result: entry.binding?.result,
              settled: entry.binding?.settled,
              unknown: entry.unknown,
              cause: entry.cause,
              unknownObserverWork: entry.unknownObserverWork,
              cleanup: Object.freeze(
                entry.cleanup.map((record) =>
                  Object.freeze({
                    snapshot: record.snapshot,
                    monitor: record.monitor,
                    done: record.done,
                    work: Object.freeze({ ...record.work }),
                    observer: Object.freeze({ ...record.observer }),
                  }),
                ),
              ),
            }),
          ),
        ),
      })
    },
    bindAttachmentInputs(inputs: MarkdownAttachmentEmbedInputs) {
      return withLifecycleTransition((transition) => {
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
          startAttachmentWatching(transition)
        } catch (error) {
          // A constructed/failed handle remains owned; no silent rollback to zero.
          if (
            !stopAttachmentWatcher &&
            !watcherConstructionFailure &&
            !failedWatcherStops.size
          )
            attachmentInputs = undefined
          throw error
        }
      })
    },
    bindEmbedInputs(
      sources: readonly WatchSource[],
      readNodes: () => readonly MarkdownEmbedValidNode[],
    ) {
      return withLifecycleTransition((transition) => {
        if (disposed || watchInputs)
          throw new Error(
            'editor-session-attachment-embed-watch-already-bound-or-disposed',
          )
        const boundary = beginBoundary()
        const inputs = { sources: [...sources], readNodes }
        if (boundaryRef !== boundary || disposed || watchInputs)
          throw new Error(
            'editor-session-attachment-embed-watch-bind-reentered',
          )
        watchInputs = inputs
        startWatching(transition)
      })
    },
    resolveEmbedNode,
    refreshEmbeds(nextNodes: readonly MarkdownEmbedValidNode[]) {
      assertLifecycleIdle()
      return refreshEmbeds(nextNodes)
    },
    readEmbedResults: () =>
      new Map(results) as ReadonlyMap<string, MarkdownEmbedResult>,
    readEmbedRequestVersions: () =>
      new Map(versions) as ReadonlyMap<string, number>,
    acceptsAttachmentResult,
    abort() {
      return withLifecycleTransition(pauseLifecycle, true)
    },
  })
}
