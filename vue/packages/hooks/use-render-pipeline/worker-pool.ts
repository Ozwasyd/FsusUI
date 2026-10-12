import {
  createFsusError,
  fsusErr,
  fsusOk,
  toFsusError,
  type FsusErrorDetail,
  type FsusResult,
} from '@element-plus/utils'

export type FsusWorkerTaskLane = 'latency' | 'throughput' | 'background'

export type FsusWorkerExecutorEventType =
  | 'pool-idle-terminate'
  | 'protocol-error'
  | 'request-abort'
  | 'request-cancel'
  | 'request-drop'
  | 'request-queue'
  | 'request-reject'
  | 'request-resolve'
  | 'request-retry'
  | 'request-start'
  | 'request-timeout'
  | 'worker-crash'
  | 'worker-created'
  | 'worker-disposed'
  | 'worker-error'
  | 'worker-idle-terminate'
  | 'worker-reused'

export type FsusWorkerExecutorEvent = {
  activeCount?: number
  cloneBytes?: number
  computeDurationMs?: number
  durationMs?: number
  error?: FsusErrorDetail
  generation?: number
  id?: number
  key?: string
  lane?: FsusWorkerTaskLane
  name: string
  pendingCount: number
  queueDepth?: number
  queueWaitDurationMs?: number
  retryCount?: number
  transferDurationMs?: number
  type: FsusWorkerExecutorEventType
  workerCount?: number
  workerId?: number
}

export type FsusWorkerExecutorOptions = {
  backgroundDeferMs?: number
  idleTerminateMs?: number
  isMainThreadBusy?: () => boolean
  laneQueueLimits?: Partial<Record<FsusWorkerTaskLane, number>>
  maxQueue?: number
  maxWorkers?: number
  name?: string
  /** Cleanup attempts remaining owned work before rethrowing observer errors. */
  onEvent?: (event: FsusWorkerExecutorEvent) => void
  requireGenerationEcho?: boolean
  requestTimeoutMs?: number
  reservedCores?: number
  serializeError?: (error: unknown) => unknown
  structuredCloneLimitBytes?: number
}

export type FsusWorkerRunOptions = {
  cloneBytes?: number
  generation?: number
  hardCancel?: boolean
  key?: string
  lane?: FsusWorkerTaskLane
  retryOnCrash?: boolean
  signal?: AbortSignal
  transfer?: readonly Transferable[]
}

/** Exact original task identity; a shared pool is not an ownership boundary. */
export type FsusWorkerTaskScope = {
  generation: number
  key: string
}

export type FsusWorkerTaskInspection = {
  /** An owned cleanup hook remains; native registration may be unknown. */
  abortListenerActive: boolean
  abortListenerRegistration?: 'none' | 'registered' | 'unknown'
  cancelTimeoutActive: boolean
  generation: number
  id: number
  key?: string
  lane: FsusWorkerTaskLane
  promiseState: 'pending' | 'settled'
  requestTimeoutActive: boolean
  state: 'queued' | 'suspended' | 'running' | 'canceling' | 'settling'
  workerId: number | null
}

/** Actual executor-owned JS resources; native worker internals are unsupported. */
export type FsusWorkerProviderResourceInspection = {
  scope: FsusWorkerTaskScope | null
  local: {
    pendingTaskIds: number[]
    queuedTaskIds: number[]
    suspendedTaskIds: number[]
    settledPromiseTaskIds: number[]
    activeExecutionTaskIds: number[]
    cleanupTaskIds: number[]
    requestTimeoutTaskIds: number[]
    abortCleanupTaskIds: number[]
    cancelTimeoutTaskIds: number[]
    retainedTaskIds: number[]
    preparingScopes: FsusWorkerTaskScope[]
    workerHandles: Array<{
      id: number
      activeTaskId: number | null
      task: { id: number; key?: string; generation: number } | null
      attribution: 'task-associated' | 'unattributable'
      alive: boolean
      quarantined: boolean
      messageCleanupRetained: boolean
      errorCleanupRetained: boolean
    }>
  }
  shared: {
    attribution: 'unattributable'
    otherPendingTaskCount: number
    otherWorkerHandleCount: number
    idleWorkerHandleCount: number
    externalRetainCount: number
    unattributableRetainCount: number
    unattributableAdmissionCount: number
    unidentifiedAdmissionCount: number
    backgroundTimerActive: boolean
    idleTerminateTimerActive: boolean
    visibilityCleanupRetained: boolean
    authorityListenerCount: number
    authorityFailureCount: number
    resourceFailureCount: number
    otherResourceFailureCount: number
    canceledResponseIdCount: number
    generationKeyCount: number
  }
  settlement: {
    /** Only local task/queue/execution/cleanup work, never shared or native work. */
    localTasks: 'pending' | 'settled' | 'unknown'
    /** Enumerated owned handles/hooks/retains/records, not arbitrary heap memory. */
    localResources: 'retained' | 'released' | 'unknown'
    workerInternals: 'unsupported'
  }
  control: {
    queuedSuspension: 'supported'
    queuedResumption: 'supported'
    softCancellation: 'request-only'
    scopedHandleTermination: 'supported'
    runningSuspension: 'unsupported'
  }
  unsupported: Array<
    | 'worker-internal-resources'
    | 'worker-internal-settlement'
    | 'worker-memory'
    | 'worker-compute'
    | 'native-handler-registration-census'
    | 'executor-heap-memory'
  >
  failures: Array<
    Readonly<{
      cause: unknown
      operation: 'cancel-post-message'
      taskId: number
      key?: string
      generation: number
      workerId: number
    }>
  >
}

export type FsusWorkerResourceInspection = {
  activeCount: number
  disposed: boolean
  pendingCount: number
  provider: FsusWorkerProviderResourceInspection
  pool: {
    activeCount: number
    pendingCount: number
    queueDepth: number
    retainCount: number
    workerCount: number
  }
  queueDepth: number
  queues: Record<FsusWorkerTaskLane, number[]>
  resources: {
    /** Owned unresolved abort cleanup hooks, including unknown registration. */
    abortListenerCount: number
    cancelTimeoutCount: number
    requestTimeoutCount: number
    suspendedTaskCount: number
    taskRetainCount: number
    /** Retained own cleanup callbacks; not a native registration census. */
    workerErrorHandlerCount: number
    workerMessageHandlerCount: number
  }
  scope: FsusWorkerTaskScope | null
  shared: {
    attribution: 'unattributable'
    /** Retained real feed failures, including their original callback/cause. */
    authorityFailureCount: number
    /** Producer revocation subscriptions are shared, not task-owned. */
    authorityListenerCount: number
    backgroundTimerActive: boolean
    canceledResponseIdCount: number
    generationKeyCount: number
    idleTerminateTimerActive: boolean
    idleWorkerCount: number
    idleWorkerErrorHandlerCount: number
    idleWorkerMessageHandlerCount: number
    retainCount: number
    /** Owned unresolved visibility cleanup hook; registration may be unknown. */
    visibilityListenerCount: number
    visibilityListenerRegistration?: 'none' | 'registered' | 'unknown'
  }
  slots: Array<{
    activeTaskId: number | null
    /** Retained handle state, not an admission guarantee. */
    alive: boolean
    /** Idle, not quarantined, and still has both installed handlers. */
    dispatchable: boolean
    id: number
    /** Teardown began; reuse remains blocked even when termination throws. */
    quarantined: boolean
    /** Retained own callbacks, not proof of native registration. */
    workerErrorHandlerActive: boolean
    workerMessageHandlerActive: boolean
  }>
  tasks: FsusWorkerTaskInspection[]
  workerCompute: 'unknown'
  workerCount: number
  workerMemoryBytes: 'unknown'
  workerInternalResources: 'unknown'
}

export type FsusWorkerTaskControlResult = {
  affectedTaskIds: number[]
  inspection: FsusWorkerResourceInspection
  /** Application of the control only; inspection reports remaining work. */
  status: 'applied' | 'partial' | 'unavailable' | 'noop'
  unavailableTaskIds: number[]
}

export type FsusWorkerTaskCancelOptions = {
  /** Terminate only slots still executing the exact selected task identity. */
  hardCancel?: boolean
}

export type FsusWorkerRunMessage<TRequest> = {
  generation: number
  id: number
  key?: string
  lane: FsusWorkerTaskLane
  request: TRequest
  type: 'run'
}

export type FsusWorkerCancelMessage = {
  generation: number
  id: number
  key?: string
  type: 'cancel'
}

export type FsusWorkerResponse<TResponse> = {
  error?: unknown
  generation?: number
  id: number
  result?: TResponse
  status?: 'complete' | 'aborted'
  timings?: { computeDurationMs?: number }
}

export type FsusWorkerPoolSizingInput = {
  deviceMemoryGb?: number
  hardwareConcurrency?: number
  maxWorkers?: number
  reservedCores?: number
}

const DEFAULT_WORKER_IDLE_TERMINATE_MS = 30_000
const DEFAULT_WORKER_REQUEST_TIMEOUT_MS = 60_000
const DEFAULT_STRUCTURED_CLONE_LIMIT_BYTES = 8 * 1024 * 1024
const MAX_SAFE_WORKERS = 4
const lanes: readonly FsusWorkerTaskLane[] = [
  'latency',
  'throughput',
  'background',
]

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const positiveInteger = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : fallback

const readHardwareConcurrency = () =>
  typeof navigator !== 'undefined'
    ? positiveInteger(navigator.hardwareConcurrency, 2)
    : 2

const readDeviceMemory = () => {
  if (typeof navigator === 'undefined') return undefined
  const value = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

export const resolveFsusWorkerPoolSize = (
  input: FsusWorkerPoolSizingInput = {},
) => {
  const hardwareConcurrency = positiveInteger(
    input.hardwareConcurrency,
    readHardwareConcurrency(),
  )
  const defaultReserved = hardwareConcurrency >= 8 ? 2 : 1
  const reservedCores = Math.min(
    Math.max(1, hardwareConcurrency - 1),
    positiveInteger(input.reservedCores, defaultReserved),
  )
  const available = Math.max(1, hardwareConcurrency - reservedCores)
  const deviceMemoryGb = input.deviceMemoryGb ?? readDeviceMemory()
  const memoryLimit =
    deviceMemoryGb !== undefined && deviceMemoryGb <= 2
      ? 1
      : deviceMemoryGb !== undefined && deviceMemoryGb <= 4
        ? 2
        : MAX_SAFE_WORKERS

  return Math.max(
    1,
    Math.min(
      available,
      memoryLimit,
      MAX_SAFE_WORKERS,
      positiveInteger(input.maxWorkers, MAX_SAFE_WORKERS),
    ),
  )
}

const createAbortErrorDetail = (message: string) =>
  createFsusError('aborted', message)

const normalizeWorkerError = (
  error: unknown,
  serializeError?: (error: unknown) => unknown,
) => {
  const serialized = serializeError ? serializeError(error) : error
  if (
    serialized &&
    typeof serialized === 'object' &&
    'code' in serialized &&
    'message' in serialized
  ) {
    return toFsusError(serialized, 'fsus_worker_error', 'infra')
  }
  if (serialized instanceof Error) {
    return toFsusError(serialized, 'fsus_worker_error', 'infra')
  }
  if (serialized && typeof serialized === 'object') {
    const payload = serialized as { message?: unknown; name?: unknown }
    return createFsusError('infra', 'fsus_worker_error', {
      cause: payload,
      details:
        typeof payload.message === 'string' ? payload.message : undefined,
    })
  }
  return createFsusError(
    'infra',
    typeof serialized === 'string' ? serialized : 'fsus_worker_error',
    { cause: serialized },
  )
}

const isAbortSignal = (value: unknown): value is AbortSignal =>
  Boolean(
    value &&
    typeof value === 'object' &&
    'aborted' in value &&
    typeof (value as AbortSignal).addEventListener === 'function',
  )

const estimateStructuredCloneBytes = (
  value: unknown,
  limit: number,
  transfers: ReadonlySet<ArrayBuffer>,
) => {
  const visited = new WeakSet<object>()
  const visit = (current: unknown): number => {
    if (current === null || current === undefined) return 0
    if (typeof current === 'boolean') return 4
    if (typeof current === 'number' || typeof current === 'bigint') return 8
    if (typeof current === 'string') return current.length * 2
    if (typeof current !== 'object') return 0
    if (current instanceof ArrayBuffer) {
      return transfers.has(current) ? 0 : current.byteLength
    }
    if (ArrayBuffer.isView(current)) {
      return transfers.has(current.buffer as ArrayBuffer)
        ? 0
        : current.byteLength
    }
    if (visited.has(current)) return 0
    visited.add(current)

    let bytes = 0
    if (Array.isArray(current)) {
      for (const item of current) {
        bytes += visit(item)
        if (bytes > limit) return bytes
      }
      return bytes
    }
    for (const [key, item] of Object.entries(current)) {
      bytes += key.length * 2 + visit(item)
      if (bytes > limit) return bytes
    }
    return bytes
  }

  return visit(value)
}

type WorkerSlot = {
  activeTaskId: number | null
  activeTaskIdentity: {
    generation: number
    id: number
    key?: string
    lane: FsusWorkerTaskLane
  } | null
  alive: boolean
  errorHandler: Worker['onerror']
  id: number
  messageHandler: Worker['onmessage']
  installingHandlers: boolean
  quarantined: boolean
  terminating: boolean
  worker: Worker
}

type GenerationAuthority = { generation: number; preparing: boolean }
type WorkerAdmission = {
  scope: FsusWorkerTaskScope | null
  identified: boolean
}

type WorkerTask<TRequest, TResponse> = {
  abortCleanup: (() => void) | null
  abortListenerRegistration: 'none' | 'registered' | 'unknown'
  cloneBytes: number
  generation: number
  generationAuthority: GenerationAuthority
  hardCancel: boolean
  installingAbortListener: boolean
  id: number
  key?: string
  lane: FsusWorkerTaskLane
  queuedAt: number
  release: () => void
  retained: boolean
  request: TRequest
  reject: (reason: unknown) => void
  resolve: (value: FsusResult<TResponse>) => void
  retryCount: number
  retryOnCrash: boolean
  signal?: AbortSignal
  settled: boolean
  settling: boolean
  slotId: number | null
  startedAt: number | null
  suspended: boolean
  timeoutId: ReturnType<typeof setTimeout> | null
  transfer: readonly Transferable[]
}

export const createFsusWorkerExecutor = <TRequest, TResponse>(
  createWorker: () => Worker,
  options: FsusWorkerExecutorOptions = {},
) => {
  const name = options.name ?? 'fsus-worker'
  const maxWorkers = resolveFsusWorkerPoolSize(options)
  const maxQueue = positiveInteger(options.maxQueue, maxWorkers * 16)
  const laneLimits: Record<FsusWorkerTaskLane, number> = {
    background: positiveInteger(
      options.laneQueueLimits?.background,
      Math.max(2, maxWorkers * 2),
    ),
    latency: positiveInteger(
      options.laneQueueLimits?.latency,
      Math.max(4, maxWorkers * 4),
    ),
    throughput: positiveInteger(
      options.laneQueueLimits?.throughput,
      Math.max(8, maxWorkers * 8),
    ),
  }
  const idleTerminateMs = positiveInteger(
    options.idleTerminateMs,
    DEFAULT_WORKER_IDLE_TERMINATE_MS,
  )
  const requestTimeoutMs = positiveInteger(
    options.requestTimeoutMs,
    DEFAULT_WORKER_REQUEST_TIMEOUT_MS,
  )
  const cloneLimit = positiveInteger(
    options.structuredCloneLimitBytes,
    DEFAULT_STRUCTURED_CLONE_LIMIT_BYTES,
  )
  const backgroundDeferMs = positiveInteger(options.backgroundDeferMs, 16)
  const queues: Record<
    FsusWorkerTaskLane,
    Array<WorkerTask<TRequest, TResponse>>
  > = {
    background: [],
    latency: [],
    throughput: [],
  }
  const pending = new Map<number, WorkerTask<TRequest, TResponse>>()
  const slots: WorkerSlot[] = []
  const canceledIds = new Set<number>()
  const canceledSlotTimers = new Map<number, ReturnType<typeof setTimeout>>()
  const resourceFailures: FsusWorkerProviderResourceInspection['failures'] = []
  const latestGenerations = new Map<string, GenerationAuthority>()
  const preparingAdmissions = new Set<WorkerAdmission>()
  let taskId = 0
  let workerId = 0
  let retainCount = 0
  let externalRetainCount = 0
  let latencyServedBeforeBackground = 0
  let throughputServedBeforeBackground = 0
  let disposed = false
  let disposing = false
  let idleTerminateTimer: ReturnType<typeof setTimeout> | null = null
  let backgroundTimer: ReturnType<typeof setTimeout> | null = null
  let visibilityListenerActive = false
  let visibilityListenerRegistration: 'none' | 'registered' | 'unknown' = 'none'
  let removingVisibilityListener = false
  const visibilityDocument =
    typeof document === 'undefined' ? undefined : document

  let authorityTicket: object | null = null
  let authorityDepth = 0
  let authorityFeedUnavailable = false
  const authorityListeners = new Set<{ id: symbol; listener: () => void }>()
  const authorityFeedFailures: Array<
    Readonly<{
      attribution: 'unattributable'
      cause: unknown
      listener: () => void
      subscriptionId: symbol
    }>
  > = []

  // Revoke before external reads/callbacks, including native callback entry.
  // Nested calls cannot issue tickets, so one synchronous feed per outer entry
  // covers the whole operation without introducing another scheduler.
  const withAuthorityChange = <T>(action: () => T): T => {
    authorityDepth += 1
    authorityTicket = null
    try {
      if (authorityDepth === 1) {
        for (const subscription of [...authorityListeners]) {
          if (!authorityListeners.has(subscription)) continue
          try {
            const listener = subscription.listener
            listener()
          } catch (cause) {
            // A broken custody feed cannot safely issue another ticket. Keep
            // attempting the other feeds and actual resource cleanup.
            authorityFeedUnavailable = true
            authorityFeedFailures.push(
              Object.freeze({
                attribution: 'unattributable' as const,
                cause,
                listener: subscription.listener,
                subscriptionId: subscription.id,
              }),
            )
          }
        }
      }
      return action()
    } finally {
      authorityDepth -= 1
    }
  }

  const authorityBoundary =
    <TArgs extends unknown[], TResult>(action: (...args: TArgs) => TResult) =>
    (...args: TArgs): TResult =>
      withAuthorityChange(() => action(...args))

  // This proves only producer-owned JS custody. It says nothing about native
  // worker internals, readiness, memory, or another owner's shared-pool work.
  const authority = Object.freeze({
    // Keep original causes and subscription ownership even after unsubscribe
    // or disposal; a later cleanup error must not erase an earlier feed error.
    getFailures: () => [...authorityFeedFailures],
    issueTicket: (): object | null => {
      if (disposed || authorityDepth > 0 || authorityFeedUnavailable)
        return null
      authorityTicket ??= {}
      return authorityTicket
    },
    isCurrent: (ticket: unknown): boolean =>
      !disposed &&
      authorityDepth === 0 &&
      !authorityFeedUnavailable &&
      authorityTicket !== null &&
      ticket === authorityTicket,
    subscribe: (listener: () => void): (() => void) =>
      withAuthorityChange(() => {
        if (disposed) throw new Error('fsus_worker_executor_disposed')
        if (typeof listener !== 'function')
          throw new TypeError('fsus_worker_authority_listener_invalid')
        const subscription = {
          id: Symbol('fsus-worker-authority-subscription'),
          listener,
        }
        authorityListeners.add(subscription)
        return () => {
          if (!authorityListeners.has(subscription)) return
          withAuthorityChange(() => authorityListeners.delete(subscription))
        }
      }),
  })

  const queueDepth = () =>
    lanes.reduce((sum, lane) => sum + queues[lane].length, 0)
  const activeCount = () =>
    slots.filter((slot) => slot.activeTaskId !== null).length

  const isSlotUsable = (slot: WorkerSlot) => {
    const messageHandler = slot.messageHandler
    const errorHandler = slot.errorHandler
    if (
      !slot.alive ||
      slot.quarantined ||
      slot.installingHandlers ||
      !messageHandler ||
      !errorHandler
    )
      return false
    const actualMessageHandler = slot.worker.onmessage
    const actualErrorHandler = slot.worker.onerror
    return (
      slot.alive &&
      !slot.quarantined &&
      !slot.installingHandlers &&
      slots.includes(slot) &&
      slot.messageHandler === messageHandler &&
      slot.errorHandler === errorHandler &&
      actualMessageHandler === messageHandler &&
      actualErrorHandler === errorHandler
    )
  }

  const emit = (
    type: FsusWorkerExecutorEventType,
    event: Partial<
      Omit<FsusWorkerExecutorEvent, 'name' | 'pendingCount' | 'type'>
    > = {},
    callback = options.onEvent,
  ) => {
    callback?.call(options, {
      activeCount: activeCount(),
      name,
      pendingCount: pending.size,
      queueDepth: queueDepth(),
      type,
      workerCount: slots.length,
      ...event,
    })
  }

  const clearIdleTimer = () => {
    if (!idleTerminateTimer) return
    clearTimeout(idleTerminateTimer)
    idleTerminateTimer = null
  }

  const clearBackgroundTimer = () => {
    if (!backgroundTimer) return
    clearTimeout(backgroundTimer)
    backgroundTimer = null
  }

  const runCleanup = (actions: Array<() => void>) => {
    const errors: unknown[] = []
    for (const action of actions) {
      try {
        action()
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) {
      throw new AggregateError(errors, 'fsus_worker_cleanup_failed')
    }
  }

  const terminateSlot = (
    slot: WorkerSlot,
    type: FsusWorkerExecutorEventType = 'worker-disposed',
    error?: FsusErrorDetail,
  ) => {
    if (slot.terminating) return
    // Retained resources still count, but teardown must stop new dispatch first.
    slot.quarantined = true
    slot.terminating = true
    try {
      runCleanup([
        () => {
          const handler = slot.messageHandler
          if (!handler) return
          if (slot.worker.onmessage === handler) slot.worker.onmessage = null
          if (!slot.installingHandlers) {
            if (slot.worker.onmessage === handler)
              throw new Error('fsus_worker_message_detach_unavailable')
            slot.messageHandler = null
          }
        },
        () => {
          const handler = slot.errorHandler
          if (!handler) return
          if (slot.worker.onerror === handler) slot.worker.onerror = null
          if (!slot.installingHandlers) {
            if (slot.worker.onerror === handler)
              throw new Error('fsus_worker_error_detach_unavailable')
            slot.errorHandler = null
          }
        },
        () => {
          if (!slot.alive) return
          slot.worker.terminate()
          slot.alive = false
          if (slot.activeTaskId !== null) {
            const id = slot.activeTaskId
            const cancelTimer = canceledSlotTimers.get(id)
            if (cancelTimer) clearTimeout(cancelTimer)
            canceledSlotTimers.delete(id)
            canceledIds.delete(id)
            const task = pending.get(id)
            if (task?.slotId === slot.id) task.slotId = null
          }
          slot.activeTaskId = null
          slot.activeTaskIdentity = null
        },
        () => {
          // Late installation and failed detachment keep the real handle owned.
          if (
            slot.alive ||
            slot.installingHandlers ||
            slot.messageHandler ||
            slot.errorHandler
          )
            return
          const index = slots.indexOf(slot)
          if (index < 0) return
          slots.splice(index, 1)
          emit(type, { error, workerId: slot.id })
        },
      ])
    } finally {
      slot.terminating = false
    }
  }

  const terminateIdleSlots = () => {
    const selectedSlots = slots.map((slot) => ({
      activeTaskId: slot.activeTaskId,
      slot,
    }))
    runCleanup([
      ...selectedSlots.map(({ slot, activeTaskId }) => () => {
        if (
          pending.size === 0 &&
          retainCount === 0 &&
          slot.activeTaskId === activeTaskId
        ) {
          terminateSlot(slot, 'worker-idle-terminate')
        }
      }),
      () => {
        if (slots.length === 0) emit('pool-idle-terminate')
      },
    ])
  }

  const scheduleIdleTerminate = () => {
    if (disposed || retainCount > 0 || pending.size > 0 || slots.length === 0)
      return
    clearIdleTimer()
    idleTerminateTimer = setTimeout(
      authorityBoundary(() => {
        idleTerminateTimer = null
        if (retainCount > 0 || pending.size > 0) return
        terminateIdleSlots()
      }),
      idleTerminateMs,
    )
  }

  const releaseRetain = () => {
    retainCount = Math.max(0, retainCount - 1)
    scheduleIdleTerminate()
  }

  const removeQueuedTask = (task: WorkerTask<TRequest, TResponse>) => {
    const queue = queues[task.lane]
    const index = queue.indexOf(task)
    if (index >= 0) queue.splice(index, 1)
  }

  let pump = () => undefined

  const settleTask = (
    task: WorkerTask<TRequest, TResponse>,
    result: FsusResult<TResponse>,
    type: FsusWorkerExecutorEventType,
    error?: FsusErrorDetail,
    timings?: { computeDurationMs?: number },
    releaseSlot = true,
  ) => {
    if (pending.get(task.id) !== task || task.settling) return
    task.settling = true
    removeQueuedTask(task)
    if (task.timeoutId) clearTimeout(task.timeoutId)
    task.timeoutId = null
    const slot = slots.find((candidate) => candidate.id === task.slotId)
    if (releaseSlot && !task.settled && slot?.activeTaskId === task.id) {
      slot.activeTaskId = null
      slot.activeTaskIdentity = null
    }
    if (!slot || slot.activeTaskId !== task.id) task.slotId = null

    try {
      runCleanup([
        () => {
          // Installation can reenter teardown before addEventListener returns.
          if (task.installingAbortListener) return
          if (task.abortCleanup) {
            task.abortListenerRegistration = 'unknown'
            task.abortCleanup()
          }
          task.abortCleanup = null
          task.abortListenerRegistration = 'none'
        },
        () => {
          // Failed detachment retains the original cleanup and task retain.
          if (task.abortCleanup || task.installingAbortListener) return
          pending.delete(task.id)
          task.release()
        },
        () => {
          if (task.settled) return
          task.settled = true
          task.resolve(result)
          const completedAt = now()
          const durationMs = completedAt - task.queuedAt
          const queueWaitDurationMs =
            (task.startedAt ?? completedAt) - task.queuedAt
          emit(type, {
            cloneBytes: task.cloneBytes,
            computeDurationMs: timings?.computeDurationMs,
            durationMs,
            error,
            generation: task.generation,
            id: task.id,
            key: task.key,
            lane: task.lane,
            queueWaitDurationMs,
            retryCount: task.retryCount,
            transferDurationMs:
              timings?.computeDurationMs === undefined
                ? undefined
                : Math.max(
                    0,
                    completedAt -
                      (task.startedAt ?? task.queuedAt) -
                      timings.computeDurationMs,
                  ),
            workerId: task.slotId ?? undefined,
          })
        },
        () => {
          if (
            task.key &&
            !latestGenerations.get(task.key)?.preparing &&
            ![...pending.values()].some((item) => item.key === task.key)
          ) {
            latestGenerations.delete(task.key)
          }
          pump()
          scheduleIdleTerminate()
        },
      ])
    } finally {
      task.settling = false
    }
  }

  const rememberCanceledId = (id: number) => {
    canceledIds.add(id)
    if (canceledIds.size > 1024) {
      const oldest = canceledIds.values().next().value
      if (typeof oldest === 'number') canceledIds.delete(oldest)
    }
  }

  const scheduleCanceledSlotTermination = (slot: WorkerSlot, id: number) => {
    if (!slot.alive || slot.activeTaskId !== id || canceledSlotTimers.has(id))
      return
    canceledSlotTimers.set(
      id,
      setTimeout(
        authorityBoundary(() => {
          canceledSlotTimers.delete(id)
          if (slot.alive && slot.activeTaskId === id) {
            const error = createFsusError(
              'timeout',
              'fsus_worker_cancel_timeout',
            )
            runCleanup([
              () => terminateSlot(slot, 'worker-error', error),
              () => pump(),
              () => scheduleIdleTerminate(),
            ])
          }
        }),
        requestTimeoutMs,
      ),
    )
  }

  const cancelTask = (
    task: WorkerTask<TRequest, TResponse>,
    type: 'request-abort' | 'request-cancel',
    message: string,
    hardCancel = task.hardCancel,
  ) => {
    if (pending.get(task.id) !== task || task.settling) return
    const error = createAbortErrorDetail(message)
    const slot = slots.find((candidate) => candidate.id === task.slotId)
    if (task.settled) {
      runCleanup([
        () => {
          if (hardCancel && slot?.alive && slot.activeTaskId === task.id)
            terminateSlot(slot)
        },
        () => settleTask(task, fsusErr(error), type, error, undefined, false),
      ])
      return
    }
    runCleanup([
      () => {
        if (slot) {
          try {
            slot.worker.postMessage({
              generation: task.generation,
              id: task.id,
              key: task.key,
              type: 'cancel',
            } satisfies FsusWorkerCancelMessage)
          } catch (cause) {
            resourceFailures.push(
              Object.freeze({
                cause,
                operation: 'cancel-post-message' as const,
                taskId: task.id,
                key: task.key,
                generation: task.generation,
                workerId: slot.id,
              }),
            )
          }
          if (
            pending.get(task.id) === task &&
            slot.alive &&
            slot.activeTaskId === task.id
          ) {
            rememberCanceledId(task.id)
            if (hardCancel) terminateSlot(slot)
          }
        }
      },
      () => {
        if (pending.get(task.id) !== task) return
        if (slot) scheduleCanceledSlotTermination(slot, task.id)
        settleTask(
          task,
          fsusErr(error),
          type,
          error,
          undefined,
          !slot || !slot.alive,
        )
      },
    ])
  }

  const rejectTaskOnException = (
    task: WorkerTask<TRequest, TResponse>,
    error: unknown,
  ) => {
    if (pending.get(task.id) !== task || task.settling) return
    if (!task.settled) {
      task.settled = true
      task.reject(error)
    }
    const detail = createFsusError(
      'infra',
      'fsus_worker_request_setup_failed',
      { cause: error },
    )
    const slot = slots.find(
      (slot) => slot.id === task.slotId && slot.activeTaskId === task.id,
    )
    runCleanup([
      () => {
        if (slot?.alive) {
          rememberCanceledId(task.id)
          terminateSlot(slot, 'worker-error', detail)
        }
      },
      () => {
        if (slot) scheduleCanceledSlotTermination(slot, task.id)
      },
      () =>
        settleTask(
          task,
          fsusErr(detail),
          'request-reject',
          detail,
          undefined,
          false,
        ),
    ])
  }

  const reportSharedException = (
    error: unknown,
    task?: WorkerTask<TRequest, TResponse>,
  ) => {
    const context = task
      ? {
          generation: task.generation,
          id: task.id,
          key: task.key,
          lane: task.lane,
        }
      : {}
    const detail = createFsusError('infra', 'fsus_worker_callback_failed', {
      cause: error,
      details: task
        ? 'task-owned callback failure'
        : 'unattributable shared pool failure',
    })
    // Error reporting is a notification, not admission into the caller's task.
    const fallback = (reportError?: unknown) => {
      try {
        console.error('fsus_worker_callback_failed', {
          name,
          ...context,
          error,
          reportError,
        })
      } catch {
        // A failed task still rejects its own Promise even if both reporters fail.
      }
    }
    try {
      const callback = options.onEvent
      if (callback)
        emit('worker-error', { ...context, error: detail }, callback)
      else fallback()
    } catch (reportError) {
      fallback(reportError)
    }
  }

  const handleTaskException = (
    task: WorkerTask<TRequest, TResponse>,
    error: unknown,
  ) => {
    let reportedError = error
    try {
      rejectTaskOnException(task, error)
    } catch (cleanupError) {
      reportedError = new AggregateError(
        [error, cleanupError],
        'fsus_worker_task_cleanup_failed',
      )
    }
    reportSharedException(reportedError, task)
  }

  const handleWorkerMessage = (slot: WorkerSlot, event: MessageEvent) => {
    const payload = event.data as FsusWorkerResponse<TResponse>
    const task = pending.get(payload?.id)
    if (!task || task.settled || task.slotId !== slot.id) {
      if (
        slot.alive &&
        slot.activeTaskId === payload?.id &&
        canceledIds.has(payload?.id) &&
        (payload.generation === undefined
          ? !options.requireGenerationEcho
          : payload.generation === slot.activeTaskIdentity?.generation)
      ) {
        canceledIds.delete(payload.id)
        const cancelTimer = canceledSlotTimers.get(payload.id)
        if (cancelTimer) clearTimeout(cancelTimer)
        canceledSlotTimers.delete(payload.id)
        slot.activeTaskId = null
        slot.activeTaskIdentity = null
        if (task?.settled) task.slotId = null
        pump()
        scheduleIdleTerminate()
        return
      }
      emit('protocol-error', {
        error: createFsusError('protocol', 'fsus_worker_unknown_response'),
        id: payload?.id,
        workerId: slot.id,
      })
      return
    }
    if (
      options.requireGenerationEcho &&
      payload.generation !== task.generation
    ) {
      const error = createFsusError(
        'protocol',
        'fsus_worker_generation_mismatch',
      )
      if (slot.alive && slot.activeTaskId === task.id)
        rememberCanceledId(task.id)
      runCleanup([
        () =>
          emit('protocol-error', {
            error,
            generation: task.generation,
            id: task.id,
            workerId: slot.id,
          }),
        () => terminateSlot(slot, 'worker-error', error),
        () =>
          settleTask(
            task,
            fsusErr(error),
            'request-reject',
            error,
            undefined,
            !slot.alive,
          ),
      ])
      return
    }
    if (
      payload.status === 'aborted' ||
      (task.key &&
        (latestGenerations.get(task.key)?.generation ?? task.generation) >
          task.generation)
    ) {
      const error = createAbortErrorDetail('fsus_worker_generation_superseded')
      settleTask(task, fsusErr(error), 'request-cancel', error)
      return
    }
    if (payload.error) {
      let error = createFsusError('infra', 'fsus_worker_error')
      runCleanup([
        () => {
          error = normalizeWorkerError(payload.error, options.serializeError)
        },
        () => settleTask(task, fsusErr(error), 'request-reject', error),
      ])
      return
    }
    settleTask(
      task,
      fsusOk(payload.result as TResponse),
      'request-resolve',
      undefined,
      payload.timings,
    )
  }

  const handleWorkerCrash = (slot: WorkerSlot, event: ErrorEvent) => {
    const task =
      slot.activeTaskId === null ? undefined : pending.get(slot.activeTaskId)
    let error = createFsusError('infra', 'fsus_worker_error')
    runCleanup([
      () => {
        event.preventDefault?.()
        error = normalizeWorkerError(
          event.error ?? event.message ?? 'fsus_worker_error',
          options.serializeError,
        )
      },
      () => {
        if (
          task &&
          pending.get(task.id) === task &&
          slot.alive &&
          slot.activeTaskId === task.id
        )
          rememberCanceledId(task.id)
        terminateSlot(slot, 'worker-crash', error)
      },
      () => emit('worker-error', { error, workerId: slot.id }),
      () => {
        if (
          task?.retryOnCrash &&
          task.retryCount < 1 &&
          !slot.alive &&
          !task.settled &&
          !task.settling &&
          !disposed &&
          pending.get(task.id) === task
        ) {
          task.retryCount += 1
          task.slotId = null
          task.startedAt = null
          queues[task.lane].unshift(task)
          runCleanup([
            () =>
              emit('request-retry', {
                generation: task.generation,
                id: task.id,
                key: task.key,
                lane: task.lane,
                retryCount: task.retryCount,
              }),
            () => pump(),
          ])
          return
        }
        if (task)
          settleTask(
            task,
            fsusErr(error),
            'request-reject',
            error,
            undefined,
            !slot.alive,
          )
        pump()
      },
    ])
  }

  const createSlot = () => {
    clearIdleTimer()
    const worker = createWorker()
    if (slots.some((slot) => slot.worker === worker)) {
      throw new Error('fsus_worker_duplicate_handle')
    }
    const slot: WorkerSlot = {
      activeTaskId: null,
      activeTaskIdentity: null,
      alive: true,
      errorHandler: null,
      id: ++workerId,
      messageHandler: null,
      installingHandlers: false,
      quarantined: false,
      terminating: false,
      worker,
    }
    // The returned handle must be visible to teardown before external setters.
    slots.push(slot)
    const messageHandler: Worker['onmessage'] = (event) =>
      withAuthorityChange(() => handleWorkerMessage(slot, event))
    const errorHandler: Worker['onerror'] = (event) =>
      withAuthorityChange(() => handleWorkerCrash(slot, event as ErrorEvent))
    try {
      if (disposed) throw new Error('fsus_worker_executor_disposed')
      if (slots.length > maxWorkers)
        throw new Error('fsus_worker_capacity_changed')
      slot.messageHandler = messageHandler
      slot.errorHandler = errorHandler
      slot.installingHandlers = true
      try {
        slot.worker.onmessage = messageHandler
        if (disposed || !slot.alive)
          throw new Error('fsus_worker_executor_disposed')
        slot.worker.onerror = errorHandler
        if (disposed || !slot.alive)
          throw new Error('fsus_worker_executor_disposed')
      } finally {
        slot.installingHandlers = false
      }
      emit('worker-created', { workerId: slot.id })
      if (disposed) throw new Error('fsus_worker_executor_disposed')
      return slot
    } catch (error) {
      runCleanup([
        () => {
          throw error
        },
        () => terminateSlot(slot),
      ])
      throw error
    }
  }

  const isMainThreadBusy = () => {
    if (options.isMainThreadBusy) return options.isMainThreadBusy()
    if (typeof navigator === 'undefined') return false
    const scheduling = (
      navigator as Navigator & {
        scheduling?: { isInputPending?: () => boolean }
      }
    ).scheduling
    return scheduling?.isInputPending?.() ?? false
  }

  const dequeue = () => {
    const hasRunnable = (lane: FsusWorkerTaskLane) =>
      queues[lane].some((task) => !task.suspended)
    const take = (lane: FsusWorkerTaskLane) => {
      const index = queues[lane].findIndex((task) => !task.suspended)
      return index < 0 ? undefined : queues[lane].splice(index, 1)[0]
    }
    if (hasRunnable('background')) {
      const busy = isMainThreadBusy()
      if (disposed) return undefined
      if (busy) {
        if (hasRunnable('background') && !backgroundTimer) {
          backgroundTimer = setTimeout(
            authorityBoundary(() => {
              backgroundTimer = null
              pump()
            }),
            backgroundDeferMs,
          )
        }
      } else {
        if (hasRunnable('latency') && latencyServedBeforeBackground < 4) {
          latencyServedBeforeBackground += 1
          return take('latency')
        }
        if (hasRunnable('throughput') && throughputServedBeforeBackground < 2) {
          throughputServedBeforeBackground += 1
          return take('throughput')
        }
        latencyServedBeforeBackground = 0
        throughputServedBeforeBackground = 0
        return take('background')
      }
    }
    if (hasRunnable('latency')) {
      latencyServedBeforeBackground += 1
      return take('latency')
    }
    if (hasRunnable('throughput')) {
      latencyServedBeforeBackground = 0
      throughputServedBeforeBackground = 0
      return take('throughput')
    }
    return undefined
  }

  const dispatch = (
    slot: WorkerSlot,
    task: WorkerTask<TRequest, TResponse>,
  ) => {
    try {
      if (!admitTask(task)) return
      const slotUsable = isSlotUsable(slot)
      if (pending.get(task.id) !== task || task.settled || task.settling) return
      if (
        disposed ||
        !slotUsable ||
        slot.activeTaskId !== null ||
        task.suspended
      ) {
        if (!admitTask(task)) return
        queues[task.lane].unshift(task)
        return
      }
      slot.activeTaskId = task.id
      slot.activeTaskIdentity = {
        generation: task.generation,
        id: task.id,
        key: task.key,
        lane: task.lane,
      }
      task.slotId = slot.id
      task.startedAt = now()
      emit('request-start', {
        cloneBytes: task.cloneBytes,
        generation: task.generation,
        id: task.id,
        key: task.key,
        lane: task.lane,
        queueWaitDurationMs: task.startedAt - task.queuedAt,
        workerId: slot.id,
      })
      // request-start listeners can synchronously cancel, supersede or dispose.
      if (!admitTask(task)) return
      if (
        disposed ||
        !isSlotUsable(slot) ||
        !slots.includes(slot) ||
        pending.get(task.id) !== task ||
        canceledIds.has(task.id) ||
        task.slotId !== slot.id ||
        slot.activeTaskId !== task.id ||
        slot.activeTaskIdentity?.id !== task.id ||
        slot.activeTaskIdentity.key !== task.key ||
        slot.activeTaskIdentity.generation !== task.generation
      ) {
        return
      }
      if (
        task.key &&
        (latestGenerations.get(task.key)?.generation ?? task.generation) >
          task.generation
      ) {
        cancelTask(task, 'request-cancel', 'fsus_worker_generation_superseded')
        return
      }
      const message: FsusWorkerRunMessage<TRequest> = {
        generation: task.generation,
        id: task.id,
        key: task.key,
        lane: task.lane,
        request: task.request,
        type: 'run',
      }
      try {
        slot.worker.postMessage(message, [...task.transfer])
      } catch (error) {
        let detail = createFsusError('infra', 'fsus_worker_post_message_failed')
        runCleanup([
          () => {
            detail = toFsusError(
              error,
              'fsus_worker_post_message_failed',
              'infra',
            )
          },
          () => settleTask(task, fsusErr(detail), 'request-reject', detail),
        ])
      }
    } catch (error) {
      handleTaskException(task, error)
    }
  }

  pump = () => {
    try {
      if (disposed) return
      clearIdleTimer()
      while (
        lanes.some((lane) => queues[lane].some((task) => !task.suspended))
      ) {
        if (disposed) return
        let slot = slots.find(
          (candidate) =>
            isSlotUsable(candidate) && candidate.activeTaskId === null,
        )
        if (disposed) return
        if (!slot && slots.length < maxWorkers) {
          try {
            slot = createSlot()
          } catch (factoryError) {
            const causes: unknown[] = [factoryError]
            let task: WorkerTask<TRequest, TResponse> | undefined
            let delivered = false
            try {
              task = dequeue()
            } catch (dequeueError) {
              causes.push(dequeueError)
            }
            if (task) {
              let detail = createFsusError(
                'infra',
                'fsus_worker_create_failed',
                { cause: factoryError },
              )
              try {
                detail = toFsusError(
                  factoryError,
                  'fsus_worker_create_failed',
                  'infra',
                )
              } catch (normalizationError) {
                causes.push(normalizationError)
              }
              // Finish the batch before reporting: getters may settle the task.
              if (
                pending.get(task.id) === task &&
                !task.settled &&
                !task.settling
              ) {
                try {
                  settleTask(task, fsusErr(detail), 'request-reject', detail)
                } catch (settlementError) {
                  causes.push(settlementError)
                }
                delivered = task.settled
              }
            }
            if (!delivered || causes.length > 1) {
              reportSharedException(
                causes.length === 1
                  ? factoryError
                  : new AggregateError(
                      causes,
                      'fsus_worker_factory_attempt_failed',
                    ),
                task,
              )
            }
            if (!task) return
            continue
          }
        }
        if (!slot) return
        const task = dequeue()
        if (!task) return
        dispatch(slot, task)
      }
    } catch (error) {
      // Selection/factory/scheduling failures have no selected request owner.
      reportSharedException(error)
    }
  }

  const dropTask = (task: WorkerTask<TRequest, TResponse>, message: string) => {
    const error = createFsusError('infra', message)
    settleTask(task, fsusErr(error), 'request-drop', error)
  }

  const admissionError = (
    signal?: AbortSignal,
    disposedMessage = 'fsus_worker_executor_disposed',
  ) => {
    if (disposed) return createFsusError('infra', disposedMessage)
    const aborted = signal?.aborted
    // Reading an externally supplied signal can itself dispose the executor.
    if (disposed) return createFsusError('infra', disposedMessage)
    return aborted
      ? createAbortErrorDetail('fsus_worker_request_aborted')
      : undefined
  }

  const admitTask = (task: WorkerTask<TRequest, TResponse>) => {
    if (pending.get(task.id) !== task || task.settled || task.settling)
      return false
    const error = admissionError(task.signal, 'fsus_worker_disposed')
    if (pending.get(task.id) !== task || task.settled || task.settling)
      return false
    if (error) {
      if (error.code === 'aborted') {
        cancelTask(task, 'request-abort', error.message)
      } else {
        settleTask(task, fsusErr(error), 'request-reject', error)
      }
      return false
    }
    return true
  }

  const enqueue = (task: WorkerTask<TRequest, TResponse>) => {
    const isCurrent = () => admitTask(task)
    if (!isCurrent()) return
    if (task.key) {
      for (const previous of [...pending.values()]) {
        if (
          previous.key === task.key &&
          previous.id !== task.id &&
          previous.generation <= task.generation
        ) {
          try {
            cancelTask(
              previous,
              'request-cancel',
              'fsus_worker_generation_superseded',
            )
          } catch (error) {
            handleTaskException(previous, error)
          }
          if (!isCurrent()) return
        }
      }
    }

    if (queues[task.lane].length >= laneLimits[task.lane]) {
      dropTask(task, 'fsus_worker_lane_queue_full')
      return
    }
    if (queueDepth() >= maxQueue) {
      const incomingPriority = lanes.indexOf(task.lane)
      let victim: WorkerTask<TRequest, TResponse> | undefined
      for (let index = lanes.length - 1; index > incomingPriority; index -= 1) {
        victim = queues[lanes[index]]?.[0]
        if (victim) break
      }
      if (!victim) {
        dropTask(task, 'fsus_worker_queue_full')
        return
      }
      try {
        dropTask(victim, 'fsus_worker_queue_preempted')
      } catch (error) {
        handleTaskException(victim, error)
      }
    }
    // Cancellation and preemption observers may settle this task or refill lanes.
    if (!isCurrent()) return
    if (
      task.key &&
      (latestGenerations.get(task.key)?.generation ?? task.generation) >
        task.generation
    ) {
      cancelTask(task, 'request-cancel', 'fsus_worker_generation_superseded')
      return
    }
    if (queues[task.lane].length >= laneLimits[task.lane]) {
      dropTask(task, 'fsus_worker_lane_queue_full')
      return
    }
    if (queueDepth() >= maxQueue) {
      dropTask(task, 'fsus_worker_queue_full')
      return
    }
    queues[task.lane].push(task)
    emit('request-queue', {
      cloneBytes: task.cloneBytes,
      generation: task.generation,
      id: task.id,
      key: task.key,
      lane: task.lane,
    })
    pump()
  }

  const retain = () => {
    if (disposed) throw new Error('fsus_worker_executor_disposed')
    retainCount += 1
    externalRetainCount += 1
    clearIdleTimer()
    try {
      const reusableSlot = slots.find(isSlotUsable)
      if (disposed) throw new Error('fsus_worker_executor_disposed')
      if (reusableSlot) emit('worker-reused', { workerId: reusableSlot.id })
      else if (slots.length < maxWorkers) createSlot()
      if (disposed) throw new Error('fsus_worker_executor_disposed')
    } catch (error) {
      externalRetainCount -= 1
      releaseRetain()
      throw error
    }
    let released = false
    return authorityBoundary(() => {
      if (released) return
      released = true
      externalRetainCount -= 1
      releaseRetain()
    })
  }

  const dispose = () => {
    disposed = true
    clearIdleTimer()
    clearBackgroundTimer()
    for (const timer of canceledSlotTimers.values()) clearTimeout(timer)
    canceledSlotTimers.clear()
    if (pending.size === 0 && slots.length === 0) return
    const error = createFsusError('infra', 'fsus_worker_disposed')
    runCleanup([
      ...[...pending.values()].map((task) => () => {
        try {
          // Retain the active identity until its worker actually terminates.
          settleTask(
            task,
            fsusErr(error),
            'request-reject',
            error,
            undefined,
            false,
          )
        } finally {
          if (
            task.key &&
            !latestGenerations.get(task.key)?.preparing &&
            ![...pending.values()].some((item) => item.key === task.key)
          ) {
            latestGenerations.delete(task.key)
          }
        }
      }),
      ...[...slots].map((slot) => () => terminateSlot(slot)),
    ])
  }

  const run = (
    request: TRequest,
    signalOrOptions: AbortSignal | FsusWorkerRunOptions | undefined,
    additionalOptions: FsusWorkerRunOptions,
    admission: WorkerAdmission,
  ) => {
    const runOptions: FsusWorkerRunOptions = isAbortSignal(signalOrOptions)
      ? { ...additionalOptions, signal: signalOrOptions }
      : { ...(signalOrOptions ?? {}), ...additionalOptions }
    const signal = runOptions.signal
    const initialError = admissionError(signal)
    if (initialError) return Promise.resolve(fsusErr<TResponse>(initialError))

    const id = ++taskId
    const lane = runOptions.lane ?? 'throughput'
    const generation = runOptions.key
      ? (runOptions.generation ??
        (latestGenerations.get(runOptions.key)?.generation ?? 0) + 1)
      : (runOptions.generation ?? 0)
    admission.scope = runOptions.key
      ? { key: runOptions.key, generation }
      : null
    admission.identified = true
    if (
      runOptions.key &&
      generation <
        (latestGenerations.get(runOptions.key)?.generation ?? generation)
    ) {
      const error = createAbortErrorDetail('fsus_worker_generation_stale')
      emit('request-drop', {
        error,
        generation,
        id,
        key: runOptions.key,
        lane,
      })
      return Promise.resolve(fsusErr<TResponse>(error))
    }
    const previousAuthority = runOptions.key
      ? latestGenerations.get(runOptions.key)
      : undefined
    const generationAuthority = { generation, preparing: true }
    if (runOptions.key)
      latestGenerations.set(runOptions.key, generationAuthority)
    const releasePreparation = () => {
      if (
        !runOptions.key ||
        latestGenerations.get(runOptions.key) !== generationAuthority
      )
        return
      if (
        !disposed &&
        previousAuthority &&
        (previousAuthority.preparing ||
          [...pending.values()].some((task) => task.key === runOptions.key))
      ) {
        latestGenerations.set(runOptions.key, previousAuthority)
      } else {
        latestGenerations.delete(runOptions.key)
      }
    }

    let transfer: Transferable[]
    let cloneBytes: number
    let queuedAt: number
    try {
      // Snapshot the iterable before admission; dispatch must not run it again.
      transfer = [...(runOptions.transfer ?? [])]
      const transferredBuffers = new Set<ArrayBuffer>()
      for (const item of transfer) {
        if (item instanceof ArrayBuffer) transferredBuffers.add(item)
      }
      cloneBytes =
        runOptions.cloneBytes ??
        estimateStructuredCloneBytes(request, cloneLimit, transferredBuffers)
      queuedAt = now()
      const preparationError = admissionError(signal)
      if (preparationError) {
        releasePreparation()
        return Promise.resolve(fsusErr<TResponse>(preparationError))
      }
    } catch (error) {
      releasePreparation()
      throw error
    }
    if (
      runOptions.key &&
      generation <
        (latestGenerations.get(runOptions.key)?.generation ?? generation)
    ) {
      const error = createAbortErrorDetail('fsus_worker_generation_stale')
      releasePreparation()
      return Promise.resolve(fsusErr<TResponse>(error))
    }
    if (cloneBytes > cloneLimit) {
      const error = createFsusError(
        'protocol',
        'fsus_worker_clone_budget_exceeded',
      )
      try {
        emit('request-drop', {
          cloneBytes,
          error,
          generation,
          id,
          key: runOptions.key,
          lane,
        })
      } finally {
        releasePreparation()
      }
      return Promise.resolve(fsusErr<TResponse>(error))
    }

    retainCount += 1
    clearIdleTimer()
    return new Promise<FsusResult<TResponse>>((resolve, reject) => {
      const task: WorkerTask<TRequest, TResponse> = {
        abortCleanup: null,
        abortListenerRegistration: 'none',
        cloneBytes,
        generation,
        generationAuthority,
        hardCancel: runOptions.hardCancel ?? false,
        installingAbortListener: false,
        id,
        key: runOptions.key,
        lane,
        queuedAt,
        release: () => {
          if (!task.retained) return
          task.retained = false
          releaseRetain()
        },
        retained: true,
        request,
        reject,
        resolve,
        retryCount: 0,
        retryOnCrash: runOptions.retryOnCrash ?? false,
        signal,
        settled: false,
        settling: false,
        slotId: null,
        startedAt: null,
        suspended: false,
        timeoutId: null,
        transfer,
      }
      pending.set(id, task)
      generationAuthority.preparing = false
      try {
        task.timeoutId = setTimeout(
          authorityBoundary(() => {
            const error = createFsusError(
              'timeout',
              'fsus_worker_request_timeout',
            )
            const slot = slots.find((candidate) => candidate.id === task.slotId)
            if (slot?.alive && slot.activeTaskId === task.id)
              rememberCanceledId(task.id)
            runCleanup([
              () => {
                if (slot) terminateSlot(slot, 'worker-error', error)
              },
              () =>
                settleTask(
                  task,
                  fsusErr(error),
                  'request-timeout',
                  error,
                  undefined,
                  !slot?.alive,
                ),
            ])
          }),
          requestTimeoutMs,
        )
        if (signal) {
          const abort = authorityBoundary(() =>
            cancelTask(task, 'request-abort', 'fsus_worker_request_aborted'),
          )
          const cleanup = () => signal.removeEventListener('abort', abort)
          task.abortCleanup = cleanup
          task.abortListenerRegistration = 'unknown'
          task.installingAbortListener = true
          let setupFailed = false
          let setupError: unknown
          try {
            signal.addEventListener('abort', abort, { once: true })
            task.abortListenerRegistration = 'registered'
          } catch (error) {
            setupFailed = true
            setupError = error
          } finally {
            task.installingAbortListener = false
          }
          if (setupFailed) {
            let detail = createFsusError(
              'infra',
              'fsus_worker_abort_setup_failed',
            )
            runCleanup([
              () => {
                detail = toFsusError(
                  setupError,
                  'fsus_worker_abort_setup_failed',
                  'infra',
                )
              },
              () => settleTask(task, fsusErr(detail), 'request-reject', detail),
            ])
            return
          }
          if (task.settled) {
            const error = createAbortErrorDetail('fsus_worker_request_aborted')
            settleTask(task, fsusErr(error), 'request-abort', error)
            return
          }
        }
        enqueue(task)
      } catch (error) {
        rejectTaskOnException(task, error)
      }
    })
  }

  const visibilityHandler = authorityBoundary(() => {
    if (
      visibilityDocument?.visibilityState === 'hidden' &&
      pending.size === 0 &&
      retainCount === 0
    ) {
      terminateIdleSlots()
    }
  })
  if (visibilityDocument) {
    visibilityListenerActive = true
    visibilityListenerRegistration = 'unknown'
    try {
      visibilityDocument.addEventListener('visibilitychange', visibilityHandler)
      visibilityListenerRegistration = 'registered'
    } catch (error) {
      runCleanup([
        () => {
          throw error
        },
        () => {
          visibilityDocument.removeEventListener(
            'visibilitychange',
            visibilityHandler,
          )
          visibilityListenerActive = false
          visibilityListenerRegistration = 'none'
        },
      ])
    }
  }

  const validateScope = (scope: FsusWorkerTaskScope) => {
    if (
      !scope ||
      typeof scope.key !== 'string' ||
      scope.key.length === 0 ||
      typeof scope.generation !== 'number' ||
      !Number.isFinite(scope.generation)
    ) {
      throw new Error('fsus_worker_invalid_task_scope')
    }
  }

  const snapshotScope = (scope: FsusWorkerTaskScope) => {
    const snapshot = { key: scope?.key, generation: scope?.generation }
    validateScope(snapshot)
    return snapshot
  }

  const matchesScope = (
    identity: { key?: string; generation: number },
    scope?: FsusWorkerTaskScope,
  ) =>
    scope === undefined ||
    (identity.key === scope.key && identity.generation === scope.generation)

  const inspectProviderResources = (
    scope?: FsusWorkerTaskScope,
  ): FsusWorkerProviderResourceInspection => {
    if (scope !== undefined) scope = snapshotScope(scope)
    const selectedTasks = [...pending.values()].filter((task) =>
      matchesScope(task, scope),
    )
    const selectedSlots = slots.filter(
      (slot) =>
        scope === undefined ||
        (slot.activeTaskIdentity &&
          matchesScope(slot.activeTaskIdentity, scope)),
    )
    const activeExecutionTaskIds = selectedSlots.flatMap((slot) =>
      slot.activeTaskId === null ? [] : [slot.activeTaskId],
    )
    const settledPromiseTaskIds = new Set(
      selectedTasks.filter((task) => task.settled).map((task) => task.id),
    )
    for (const id of activeExecutionTaskIds) {
      if (!pending.has(id)) settledPromiseTaskIds.add(id)
    }
    const preparingScopes = [...preparingAdmissions].flatMap(
      ({ scope: admissionScope }) =>
        admissionScope && matchesScope(admissionScope, scope)
          ? [{ ...admissionScope }]
          : [],
    )
    const unidentifiedAdmissionCount = [...preparingAdmissions].filter(
      (admission) => !admission.identified,
    ).length
    const selectedIds = new Set([
      ...selectedTasks.map((task) => task.id),
      ...activeExecutionTaskIds,
    ])
    const cancelTimeoutTaskIds = [...canceledSlotTimers.keys()].filter(
      (id) => scope === undefined || selectedIds.has(id),
    )
    const selectedFailures = resourceFailures.filter((failure) =>
      matchesScope(failure, scope),
    )
    const localTaskWork =
      selectedTasks.length > 0 ||
      activeExecutionTaskIds.length > 0 ||
      cancelTimeoutTaskIds.length > 0 ||
      preparingScopes.length > 0 ||
      (scope === undefined && preparingAdmissions.size > 0)
    const localResourcesRetained =
      localTaskWork ||
      selectedSlots.length > 0 ||
      selectedFailures.length > 0 ||
      (scope === undefined &&
        (retainCount > 0 ||
          idleTerminateTimer !== null ||
          backgroundTimer !== null ||
          visibilityListenerActive ||
          authorityListeners.size > 0 ||
          authorityFeedFailures.length > 0 ||
          canceledIds.size > 0 ||
          latestGenerations.size > 0))
    return {
      scope: scope === undefined ? null : { ...scope },
      local: {
        pendingTaskIds: selectedTasks.map((task) => task.id),
        queuedTaskIds: lanes.flatMap((lane) =>
          queues[lane]
            .filter((task) => matchesScope(task, scope))
            .map((task) => task.id),
        ),
        suspendedTaskIds: selectedTasks
          .filter((task) => task.suspended)
          .map((task) => task.id),
        settledPromiseTaskIds: [...settledPromiseTaskIds],
        activeExecutionTaskIds,
        cleanupTaskIds: selectedTasks
          .filter((task) => task.settled || task.settling)
          .map((task) => task.id),
        requestTimeoutTaskIds: selectedTasks
          .filter((task) => task.timeoutId !== null)
          .map((task) => task.id),
        abortCleanupTaskIds: selectedTasks
          .filter((task) => task.abortCleanup !== null)
          .map((task) => task.id),
        cancelTimeoutTaskIds,
        retainedTaskIds: selectedTasks
          .filter((task) => task.retained)
          .map((task) => task.id),
        preparingScopes,
        workerHandles: selectedSlots.map((slot) => ({
          id: slot.id,
          activeTaskId: slot.activeTaskId,
          task: slot.activeTaskIdentity
            ? {
                id: slot.activeTaskIdentity.id,
                key: slot.activeTaskIdentity.key,
                generation: slot.activeTaskIdentity.generation,
              }
            : null,
          attribution: slot.activeTaskIdentity
            ? 'task-associated'
            : 'unattributable',
          alive: slot.alive,
          quarantined: slot.quarantined,
          messageCleanupRetained: slot.messageHandler !== null,
          errorCleanupRetained: slot.errorHandler !== null,
        })),
      },
      shared: {
        attribution: 'unattributable',
        otherPendingTaskCount: pending.size - selectedTasks.length,
        otherWorkerHandleCount: slots.length - selectedSlots.length,
        idleWorkerHandleCount: slots.filter(
          (slot) => slot.activeTaskId === null,
        ).length,
        externalRetainCount,
        unattributableRetainCount:
          retainCount -
          externalRetainCount -
          [...pending.values()].filter((task) => task.retained).length,
        unattributableAdmissionCount: [...preparingAdmissions].filter(
          (admission) => admission.scope === null,
        ).length,
        unidentifiedAdmissionCount,
        backgroundTimerActive: backgroundTimer !== null,
        idleTerminateTimerActive: idleTerminateTimer !== null,
        visibilityCleanupRetained: visibilityListenerActive,
        authorityListenerCount: authorityListeners.size,
        authorityFailureCount: authorityFeedFailures.length,
        resourceFailureCount: resourceFailures.length,
        otherResourceFailureCount:
          resourceFailures.length - selectedFailures.length,
        canceledResponseIdCount: canceledIds.size,
        generationKeyCount: latestGenerations.size,
      },
      settlement: {
        localTasks: localTaskWork
          ? 'pending'
          : unidentifiedAdmissionCount > 0
            ? 'unknown'
            : 'settled',
        localResources: localResourcesRetained
          ? 'retained'
          : unidentifiedAdmissionCount > 0
            ? 'unknown'
            : 'released',
        workerInternals: 'unsupported',
      },
      control: {
        queuedSuspension: 'supported',
        queuedResumption: 'supported',
        softCancellation: 'request-only',
        scopedHandleTermination: 'supported',
        runningSuspension: 'unsupported',
      },
      unsupported: [
        'worker-internal-resources',
        'worker-internal-settlement',
        'worker-memory',
        'worker-compute',
        'native-handler-registration-census',
        'executor-heap-memory',
      ],
      failures: selectedFailures,
    }
  }

  /** Snapshots executor-owned handles only; worker compute/memory is unknown. */
  const inspectResources = (
    scope?: FsusWorkerTaskScope,
  ): FsusWorkerResourceInspection => {
    if (scope !== undefined) scope = snapshotScope(scope)
    const selectedTasks = [...pending.values()].filter((task) =>
      matchesScope(task, scope),
    )
    const selectedSlots = slots.filter(
      (slot) =>
        scope === undefined ||
        (slot.activeTaskIdentity &&
          matchesScope(slot.activeTaskIdentity, scope)),
    )
    const tasks: FsusWorkerTaskInspection[] = selectedTasks.map((task) => ({
      abortListenerActive: task.abortCleanup !== null,
      abortListenerRegistration: task.abortListenerRegistration,
      cancelTimeoutActive: canceledSlotTimers.has(task.id),
      generation: task.generation,
      id: task.id,
      key: task.key,
      lane: task.lane,
      promiseState: task.settled ? 'settled' : 'pending',
      requestTimeoutActive: task.timeoutId !== null,
      state:
        task.settled || task.settling
          ? 'settling'
          : task.slotId !== null
            ? selectedSlots.some((slot) => slot.id === task.slotId)
              ? 'running'
              : 'settling'
            : task.suspended
              ? 'suspended'
              : 'queued',
      workerId:
        selectedSlots.find(
          (slot) => slot.id === task.slotId && slot.activeTaskId === task.id,
        )?.id ?? null,
    }))
    for (const slot of selectedSlots) {
      const identity = slot.activeTaskIdentity
      if (!identity || pending.has(identity.id)) continue
      // A settled promise does not establish that the worker stopped.
      tasks.push({
        ...identity,
        abortListenerActive: false,
        abortListenerRegistration: 'none',
        cancelTimeoutActive: canceledSlotTimers.has(identity.id),
        promiseState: 'settled',
        requestTimeoutActive: false,
        state: 'canceling',
        workerId: slot.id,
      })
    }
    const selectedQueues = Object.fromEntries(
      lanes.map((lane) => [
        lane,
        queues[lane]
          .filter((task) => matchesScope(task, scope))
          .map((task) => task.id),
      ]),
    ) as Record<FsusWorkerTaskLane, number[]>
    return {
      activeCount:
        scope === undefined
          ? activeCount()
          : selectedSlots.filter((slot) => slot.activeTaskId !== null).length,
      disposed,
      pendingCount: selectedTasks.length,
      provider: inspectProviderResources(scope),
      pool: {
        activeCount: activeCount(),
        pendingCount: pending.size,
        queueDepth: queueDepth(),
        retainCount,
        workerCount: slots.length,
      },
      queueDepth:
        scope === undefined
          ? queueDepth()
          : lanes.reduce((sum, lane) => sum + selectedQueues[lane].length, 0),
      queues: selectedQueues,
      resources: {
        abortListenerCount: tasks.filter((task) => task.abortListenerActive)
          .length,
        cancelTimeoutCount: tasks.filter((task) => task.cancelTimeoutActive)
          .length,
        requestTimeoutCount: tasks.filter((task) => task.requestTimeoutActive)
          .length,
        suspendedTaskCount: tasks.filter((task) => task.state === 'suspended')
          .length,
        taskRetainCount: selectedTasks.filter((task) => task.retained).length,
        workerErrorHandlerCount: selectedSlots.filter(
          (slot) => slot.errorHandler !== null,
        ).length,
        workerMessageHandlerCount: selectedSlots.filter(
          (slot) => slot.messageHandler !== null,
        ).length,
      },
      scope: scope === undefined ? null : { ...scope },
      shared: {
        attribution: 'unattributable',
        authorityFailureCount: authorityFeedFailures.length,
        authorityListenerCount: authorityListeners.size,
        backgroundTimerActive: backgroundTimer !== null,
        canceledResponseIdCount: canceledIds.size,
        generationKeyCount: latestGenerations.size,
        idleTerminateTimerActive: idleTerminateTimer !== null,
        idleWorkerCount: slots.filter((slot) => slot.activeTaskId === null)
          .length,
        idleWorkerErrorHandlerCount: slots.filter(
          (slot) => slot.activeTaskId === null && slot.errorHandler !== null,
        ).length,
        idleWorkerMessageHandlerCount: slots.filter(
          (slot) => slot.activeTaskId === null && slot.messageHandler !== null,
        ).length,
        retainCount:
          retainCount -
          [...pending.values()].filter((task) => task.retained).length,
        visibilityListenerCount: visibilityListenerActive ? 1 : 0,
        visibilityListenerRegistration,
      },
      slots: selectedSlots.map((slot) => ({
        activeTaskId: slot.activeTaskId,
        alive: slot.alive,
        dispatchable: isSlotUsable(slot) && slot.activeTaskId === null,
        id: slot.id,
        quarantined: slot.quarantined,
        workerErrorHandlerActive: slot.errorHandler !== null,
        workerMessageHandlerActive: slot.messageHandler !== null,
      })),
      tasks,
      workerCompute: 'unknown',
      workerCount: scope === undefined ? slots.length : selectedSlots.length,
      workerMemoryBytes: 'unknown',
      workerInternalResources: 'unknown',
    }
  }

  const controlResult = (
    scope: FsusWorkerTaskScope,
    affectedTaskIds: number[],
    unavailableTaskIds: number[],
    noTasksUnavailable = false,
  ): FsusWorkerTaskControlResult => ({
    affectedTaskIds,
    inspection: inspectResources(scope),
    status:
      unavailableTaskIds.length > 0
        ? affectedTaskIds.length > 0
          ? 'partial'
          : 'unavailable'
        : affectedTaskIds.length > 0
          ? 'applied'
          : noTasksUnavailable
            ? 'unavailable'
            : 'noop',
    unavailableTaskIds,
  })

  // Pause admission in the original queues. Running work cannot be suspended,
  // and suspended requests retain their original deadline and abort listener.
  const setTasksSuspended = (
    scope: FsusWorkerTaskScope,
    suspended: boolean,
  ) => {
    scope = snapshotScope(scope)
    const before = inspectResources(scope)
    const affectedTaskIds: number[] = []
    const unavailableTaskIds = before.tasks
      .filter(
        (task) =>
          task.state === 'running' ||
          task.state === 'canceling' ||
          task.state === 'settling',
      )
      .map((task) => task.id)
    for (const task of [...pending.values()]) {
      if (
        !matchesScope(task, scope) ||
        task.slotId !== null ||
        task.settled ||
        task.settling
      )
        continue
      if (task.suspended === suspended) continue
      task.suspended = suspended
      affectedTaskIds.push(task.id)
    }
    if (!suspended && affectedTaskIds.length > 0) pump()
    return controlResult(
      scope,
      affectedTaskIds,
      unavailableTaskIds,
      before.tasks.length === 0,
    )
  }

  const cancelTasks = (
    scope: FsusWorkerTaskScope,
    cancelOptions: FsusWorkerTaskCancelOptions = {},
  ): FsusWorkerTaskControlResult => {
    scope = snapshotScope(scope)
    const hardCancel = cancelOptions.hardCancel
    const affectedTaskIds: number[] = []
    const unavailableTaskIds: number[] = []
    // Snapshot identities so reentrant event handlers cannot select new work.
    const selectedTasks = [...pending.values()].filter((task) =>
      matchesScope(task, scope),
    )
    const selectedSlots = slots.flatMap((slot) =>
      slot.activeTaskIdentity &&
      matchesScope(slot.activeTaskIdentity, scope) &&
      !pending.has(slot.activeTaskIdentity.id)
        ? [{ slot, identity: { ...slot.activeTaskIdentity } }]
        : [],
    )
    for (const task of selectedTasks) {
      if (!pending.has(task.id)) continue
      if (task.settling) {
        unavailableTaskIds.push(task.id)
        continue
      }
      affectedTaskIds.push(task.id)
      const failureCount = resourceFailures.length
      cancelTask(
        task,
        'request-cancel',
        'fsus_worker_request_canceled',
        hardCancel ?? task.hardCancel,
      )
      if (
        !(hardCancel ?? task.hardCancel) &&
        resourceFailures
          .slice(failureCount)
          .some((failure) => failure.taskId === task.id)
      )
        unavailableTaskIds.push(task.id)
    }
    for (const { slot, identity } of selectedSlots) {
      if (!slot.alive || slot.activeTaskId !== identity.id) continue
      if (hardCancel) {
        affectedTaskIds.push(identity.id)
        terminateSlot(slot)
      } else {
        unavailableTaskIds.push(identity.id)
      }
    }
    if (affectedTaskIds.length > 0) {
      pump()
      scheduleIdleTerminate()
    }
    return controlResult(scope, affectedTaskIds, unavailableTaskIds)
  }

  return {
    authority,
    dispose: () => {
      // Close admission before any externally supplied cleanup method runs.
      disposed = true
      if (disposing) return
      disposing = true
      try {
        withAuthorityChange(() =>
          runCleanup([
            () => {
              if (
                !visibilityDocument ||
                !visibilityListenerActive ||
                removingVisibilityListener
              )
                return
              removingVisibilityListener = true
              visibilityListenerRegistration = 'unknown'
              try {
                visibilityDocument.removeEventListener(
                  'visibilitychange',
                  visibilityHandler,
                )
                visibilityListenerActive = false
                visibilityListenerRegistration = 'none'
              } finally {
                removingVisibilityListener = false
              }
            },
            () => dispose(),
          ]),
        )
      } finally {
        disposing = false
        // Retiring executors still own their feed until real teardown finishes.
        // A failed native cleanup is not evidence that the resources vanished.
        if (
          !visibilityListenerActive &&
          pending.size === 0 &&
          slots.length === 0 &&
          retainCount === 0 &&
          idleTerminateTimer === null &&
          backgroundTimer === null &&
          canceledSlotTimers.size === 0
        )
          authorityListeners.clear()
      }
    },
    getActiveCount: activeCount,
    getPendingCount: () => pending.size,
    getQueueDepth: queueDepth,
    getWorkerCount: () => slots.length,
    inspectProviderResources: authorityBoundary(inspectProviderResources),
    inspectResources: authorityBoundary(inspectResources),
    cancelTasks: authorityBoundary(cancelTasks),
    resumeTasks: authorityBoundary((scope: FsusWorkerTaskScope) =>
      setTasksSuspended(scope, false),
    ),
    suspendTasks: authorityBoundary((scope: FsusWorkerTaskScope) =>
      setTasksSuspended(scope, true),
    ),
    retain: authorityBoundary(retain),
    run: authorityBoundary(
      (
        request: TRequest,
        signalOrOptions?: AbortSignal | FsusWorkerRunOptions,
        additionalOptions: FsusWorkerRunOptions = {},
      ) => {
        const admission: WorkerAdmission = { scope: null, identified: false }
        preparingAdmissions.add(admission)
        try {
          return run(request, signalOrOptions, additionalOptions, admission)
        } finally {
          preparingAdmissions.delete(admission)
        }
      },
    ),
  }
}
