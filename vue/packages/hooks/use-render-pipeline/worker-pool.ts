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
  abortListenerActive: boolean
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

export type FsusWorkerResourceInspection = {
  activeCount: number
  disposed: boolean
  pendingCount: number
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
    abortListenerCount: number
    cancelTimeoutCount: number
    requestTimeoutCount: number
    suspendedTaskCount: number
    taskRetainCount: number
    workerErrorHandlerCount: number
    workerMessageHandlerCount: number
  }
  scope: FsusWorkerTaskScope | null
  shared: {
    attribution: 'unattributable'
    backgroundTimerActive: boolean
    canceledResponseIdCount: number
    generationKeyCount: number
    idleTerminateTimerActive: boolean
    idleWorkerCount: number
    idleWorkerErrorHandlerCount: number
    idleWorkerMessageHandlerCount: number
    retainCount: number
    visibilityListenerCount: number
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
  quarantined: boolean
  worker: Worker
}

type WorkerTask<TRequest, TResponse> = {
  abortCleanup: (() => void) | null
  cloneBytes: number
  generation: number
  hardCancel: boolean
  id: number
  key?: string
  lane: FsusWorkerTaskLane
  queuedAt: number
  release: () => void
  request: TRequest
  resolve: (value: FsusResult<TResponse>) => void
  retryCount: number
  retryOnCrash: boolean
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
  const latestGenerations = new Map<string, number>()
  let taskId = 0
  let workerId = 0
  let retainCount = 0
  let latencyServedBeforeBackground = 0
  let throughputServedBeforeBackground = 0
  let disposed = false
  let idleTerminateTimer: ReturnType<typeof setTimeout> | null = null
  let backgroundTimer: ReturnType<typeof setTimeout> | null = null
  let visibilityListenerActive = false

  const queueDepth = () =>
    lanes.reduce((sum, lane) => sum + queues[lane].length, 0)
  const activeCount = () =>
    slots.filter((slot) => slot.activeTaskId !== null).length

  const isSlotUsable = (slot: WorkerSlot) =>
    slot.alive &&
    !slot.quarantined &&
    slot.messageHandler !== null &&
    slot.errorHandler !== null &&
    slot.worker.onmessage === slot.messageHandler &&
    slot.worker.onerror === slot.errorHandler

  const emit = (
    type: FsusWorkerExecutorEventType,
    event: Partial<
      Omit<FsusWorkerExecutorEvent, 'name' | 'pendingCount' | 'type'>
    > = {},
  ) => {
    options.onEvent?.({
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
    if (!slot.alive) return
    // Retained resources still count, but teardown must stop new dispatch first.
    slot.quarantined = true
    if (slot.worker.onmessage === slot.messageHandler) {
      slot.worker.onmessage = null
    }
    if (slot.worker.onerror === slot.errorHandler) {
      slot.worker.onerror = null
    }
    slot.messageHandler = null
    slot.errorHandler = null
    slot.worker.terminate()
    slot.alive = false
    if (slot.activeTaskId !== null) {
      const cancelTimer = canceledSlotTimers.get(slot.activeTaskId)
      if (cancelTimer) clearTimeout(cancelTimer)
      canceledSlotTimers.delete(slot.activeTaskId)
      canceledIds.delete(slot.activeTaskId)
    }
    slot.activeTaskId = null
    slot.activeTaskIdentity = null
    const index = slots.indexOf(slot)
    if (index >= 0) slots.splice(index, 1)
    emit(type, { error, workerId: slot.id })
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
    idleTerminateTimer = setTimeout(() => {
      idleTerminateTimer = null
      if (retainCount > 0 || pending.size > 0) return
      terminateIdleSlots()
    }, idleTerminateMs)
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
    if (!pending.delete(task.id)) return
    removeQueuedTask(task)
    if (task.timeoutId) clearTimeout(task.timeoutId)
    task.timeoutId = null
    task.abortCleanup?.()
    task.abortCleanup = null
    const slot = slots.find((candidate) => candidate.id === task.slotId)
    if (releaseSlot && slot?.activeTaskId === task.id) {
      slot.activeTaskId = null
      slot.activeTaskIdentity = null
    }

    const completedAt = now()
    const durationMs = completedAt - task.queuedAt
    const queueWaitDurationMs = (task.startedAt ?? completedAt) - task.queuedAt
    task.release()
    task.resolve(result)
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
    if (
      task.key &&
      ![...pending.values()].some((item) => item.key === task.key)
    ) {
      latestGenerations.delete(task.key)
    }
    pump()
    scheduleIdleTerminate()
  }

  const rememberCanceledId = (id: number) => {
    canceledIds.add(id)
    if (canceledIds.size > 1024) {
      const oldest = canceledIds.values().next().value
      if (typeof oldest === 'number') canceledIds.delete(oldest)
    }
  }

  const cancelTask = (
    task: WorkerTask<TRequest, TResponse>,
    type: 'request-abort' | 'request-cancel',
    message: string,
    hardCancel = task.hardCancel,
  ) => {
    if (!pending.has(task.id)) return
    const error = createAbortErrorDetail(message)
    const slot = slots.find((candidate) => candidate.id === task.slotId)
    if (slot) {
      try {
        slot.worker.postMessage({
          generation: task.generation,
          id: task.id,
          key: task.key,
          type: 'cancel',
        } satisfies FsusWorkerCancelMessage)
      } catch {}
      rememberCanceledId(task.id)
      if (hardCancel) terminateSlot(slot)
    }
    if (slot && !hardCancel && slot.activeTaskId === task.id) {
      canceledSlotTimers.set(
        task.id,
        setTimeout(() => {
          canceledSlotTimers.delete(task.id)
          if (slot.alive && slot.activeTaskId === task.id) {
            const timeoutError = createFsusError(
              'timeout',
              'fsus_worker_cancel_timeout',
            )
            terminateSlot(slot, 'worker-error', timeoutError)
            pump()
            scheduleIdleTerminate()
          }
        }, requestTimeoutMs),
      )
    }
    settleTask(
      task,
      fsusErr(error),
      type,
      error,
      undefined,
      !slot || hardCancel,
    )
  }

  const handleWorkerMessage = (slot: WorkerSlot, event: MessageEvent) => {
    const payload = event.data as FsusWorkerResponse<TResponse>
    const task = pending.get(payload?.id)
    if (!task || task.slotId !== slot.id) {
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
      emit('protocol-error', {
        error,
        generation: task.generation,
        id: task.id,
        workerId: slot.id,
      })
      terminateSlot(slot, 'worker-error', error)
      settleTask(task, fsusErr(error), 'request-reject', error)
      return
    }
    if (
      payload.status === 'aborted' ||
      (task.key &&
        (latestGenerations.get(task.key) ?? task.generation) > task.generation)
    ) {
      const error = createAbortErrorDetail('fsus_worker_generation_superseded')
      settleTask(task, fsusErr(error), 'request-cancel', error)
      return
    }
    if (payload.error) {
      const error = normalizeWorkerError(payload.error, options.serializeError)
      settleTask(task, fsusErr(error), 'request-reject', error)
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
    event.preventDefault?.()
    const error = normalizeWorkerError(
      event.error ?? event.message ?? 'fsus_worker_error',
      options.serializeError,
    )
    const task =
      slot.activeTaskId === null ? undefined : pending.get(slot.activeTaskId)
    terminateSlot(slot, 'worker-crash', error)
    emit('worker-error', { error, workerId: slot.id })
    if (task?.retryOnCrash && task.retryCount < 1) {
      task.retryCount += 1
      task.slotId = null
      task.startedAt = null
      queues[task.lane].unshift(task)
      emit('request-retry', {
        generation: task.generation,
        id: task.id,
        key: task.key,
        lane: task.lane,
        retryCount: task.retryCount,
      })
      pump()
      return
    }
    if (task) settleTask(task, fsusErr(error), 'request-reject', error)
    pump()
  }

  const createSlot = () => {
    clearIdleTimer()
    const slot: WorkerSlot = {
      activeTaskId: null,
      activeTaskIdentity: null,
      alive: true,
      errorHandler: null,
      id: ++workerId,
      messageHandler: null,
      quarantined: false,
      worker: createWorker(),
    }
    slot.messageHandler = (event) => handleWorkerMessage(slot, event)
    slot.errorHandler = (event) => handleWorkerCrash(slot, event as ErrorEvent)
    slot.worker.onmessage = slot.messageHandler
    slot.worker.onerror = slot.errorHandler
    slots.push(slot)
    emit('worker-created', { workerId: slot.id })
    return slot
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
      if (isMainThreadBusy()) {
        if (!backgroundTimer) {
          backgroundTimer = setTimeout(() => {
            backgroundTimer = null
            pump()
          }, backgroundDeferMs)
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
    if (pending.get(task.id) !== task) return
    if (disposed || !isSlotUsable(slot) || slot.activeTaskId !== null) {
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
      (latestGenerations.get(task.key) ?? task.generation) > task.generation
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
      const detail = toFsusError(
        error,
        'fsus_worker_post_message_failed',
        'infra',
      )
      settleTask(task, fsusErr(detail), 'request-reject', detail)
    }
  }

  pump = () => {
    if (disposed) return
    clearIdleTimer()
    while (lanes.some((lane) => queues[lane].some((task) => !task.suspended))) {
      if (disposed) return
      let slot = slots.find(
        (candidate) =>
          isSlotUsable(candidate) && candidate.activeTaskId === null,
      )
      if (!slot && slots.length < maxWorkers) {
        try {
          slot = createSlot()
        } catch (error) {
          const task = dequeue()
          if (!task) return
          const detail = toFsusError(
            error,
            'fsus_worker_create_failed',
            'infra',
          )
          settleTask(task, fsusErr(detail), 'request-reject', detail)
          continue
        }
      }
      if (!slot) return
      const task = dequeue()
      if (!task) return
      dispatch(slot, task)
    }
  }

  const dropTask = (task: WorkerTask<TRequest, TResponse>, message: string) => {
    const error = createFsusError('infra', message)
    settleTask(task, fsusErr(error), 'request-drop', error)
  }

  const enqueue = (task: WorkerTask<TRequest, TResponse>) => {
    if (task.key) {
      for (const previous of [...pending.values()]) {
        if (
          previous.key === task.key &&
          previous.id !== task.id &&
          previous.generation <= task.generation
        ) {
          cancelTask(
            previous,
            'request-cancel',
            'fsus_worker_generation_superseded',
          )
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
      dropTask(victim, 'fsus_worker_queue_preempted')
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
    clearIdleTimer()
    try {
      const reusableSlot = slots.find(isSlotUsable)
      if (reusableSlot) emit('worker-reused', { workerId: reusableSlot.id })
      else if (slots.length < maxWorkers) createSlot()
    } catch (error) {
      releaseRetain()
      throw error
    }
    let released = false
    return () => {
      if (released) return
      released = true
      releaseRetain()
    }
  }

  const dispose = () => {
    if (disposed && pending.size === 0 && slots.length === 0) return
    disposed = true
    clearIdleTimer()
    clearBackgroundTimer()
    for (const timer of canceledSlotTimers.values()) clearTimeout(timer)
    canceledSlotTimers.clear()
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
    signalOrOptions?: AbortSignal | FsusWorkerRunOptions,
    additionalOptions: FsusWorkerRunOptions = {},
  ) => {
    const runOptions: FsusWorkerRunOptions = isAbortSignal(signalOrOptions)
      ? { ...additionalOptions, signal: signalOrOptions }
      : { ...(signalOrOptions ?? {}), ...additionalOptions }
    if (disposed) {
      return Promise.resolve(
        fsusErr<TResponse>(
          createFsusError('infra', 'fsus_worker_executor_disposed'),
        ),
      )
    }
    if (runOptions.signal?.aborted) {
      return Promise.resolve(
        fsusErr<TResponse>(
          createAbortErrorDetail('fsus_worker_request_aborted'),
        ),
      )
    }

    const id = ++taskId
    const lane = runOptions.lane ?? 'throughput'
    const generation = runOptions.key
      ? (runOptions.generation ??
        (latestGenerations.get(runOptions.key) ?? 0) + 1)
      : (runOptions.generation ?? 0)
    if (
      runOptions.key &&
      generation < (latestGenerations.get(runOptions.key) ?? generation)
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
    if (runOptions.key) latestGenerations.set(runOptions.key, generation)

    const transfer = runOptions.transfer ?? []
    const transferredBuffers = new Set<ArrayBuffer>()
    for (const item of transfer) {
      if (item instanceof ArrayBuffer) transferredBuffers.add(item)
    }
    const cloneBytes =
      runOptions.cloneBytes ??
      estimateStructuredCloneBytes(request, cloneLimit, transferredBuffers)
    if (cloneBytes > cloneLimit) {
      const error = createFsusError(
        'protocol',
        'fsus_worker_clone_budget_exceeded',
      )
      emit('request-drop', {
        cloneBytes,
        error,
        generation,
        id,
        key: runOptions.key,
        lane,
      })
      return Promise.resolve(fsusErr<TResponse>(error))
    }

    retainCount += 1
    clearIdleTimer()
    return new Promise<FsusResult<TResponse>>((resolve) => {
      let released = false
      const task: WorkerTask<TRequest, TResponse> = {
        abortCleanup: null,
        cloneBytes,
        generation,
        hardCancel: runOptions.hardCancel ?? false,
        id,
        key: runOptions.key,
        lane,
        queuedAt: now(),
        release: () => {
          if (released) return
          released = true
          releaseRetain()
        },
        request,
        resolve,
        retryCount: 0,
        retryOnCrash: runOptions.retryOnCrash ?? false,
        slotId: null,
        startedAt: null,
        suspended: false,
        timeoutId: null,
        transfer,
      }
      task.timeoutId = setTimeout(() => {
        const error = createFsusError('timeout', 'fsus_worker_request_timeout')
        const slot = slots.find((candidate) => candidate.id === task.slotId)
        if (slot) terminateSlot(slot, 'worker-error', error)
        settleTask(task, fsusErr(error), 'request-timeout', error)
      }, requestTimeoutMs)
      if (runOptions.signal) {
        const abort = () =>
          cancelTask(task, 'request-abort', 'fsus_worker_request_aborted')
        runOptions.signal.addEventListener('abort', abort, { once: true })
        task.abortCleanup = () =>
          runOptions.signal?.removeEventListener('abort', abort)
      }
      pending.set(id, task)
      enqueue(task)
    })
  }

  const visibilityHandler = () => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden' &&
      pending.size === 0 &&
      retainCount === 0
    ) {
      terminateIdleSlots()
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', visibilityHandler)
    visibilityListenerActive = true
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

  const matchesScope = (
    identity: { key?: string; generation: number },
    scope?: FsusWorkerTaskScope,
  ) =>
    scope === undefined ||
    (identity.key === scope.key && identity.generation === scope.generation)

  /** Snapshots executor-owned handles only; worker compute/memory is unknown. */
  const inspectResources = (
    scope?: FsusWorkerTaskScope,
  ): FsusWorkerResourceInspection => {
    if (scope !== undefined) validateScope(scope)
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
      cancelTimeoutActive: canceledSlotTimers.has(task.id),
      generation: task.generation,
      id: task.id,
      key: task.key,
      lane: task.lane,
      promiseState: 'pending',
      requestTimeoutActive: task.timeoutId !== null,
      state:
        task.slotId !== null
          ? selectedSlots.some((slot) => slot.id === task.slotId)
            ? 'running'
            : 'settling'
          : task.suspended
            ? 'suspended'
            : 'queued',
      workerId:
        selectedSlots.find((slot) => slot.id === task.slotId)?.id ?? null,
    }))
    for (const slot of selectedSlots) {
      const identity = slot.activeTaskIdentity
      if (!identity || pending.has(identity.id)) continue
      // A settled promise does not establish that the worker stopped.
      tasks.push({
        ...identity,
        abortListenerActive: false,
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
        taskRetainCount: selectedTasks.length,
        workerErrorHandlerCount: selectedSlots.filter(
          (slot) => slot.worker.onerror !== null,
        ).length,
        workerMessageHandlerCount: selectedSlots.filter(
          (slot) => slot.worker.onmessage !== null,
        ).length,
      },
      scope: scope === undefined ? null : { ...scope },
      shared: {
        attribution: 'unattributable',
        backgroundTimerActive: backgroundTimer !== null,
        canceledResponseIdCount: canceledIds.size,
        generationKeyCount: latestGenerations.size,
        idleTerminateTimerActive: idleTerminateTimer !== null,
        idleWorkerCount: slots.filter((slot) => slot.activeTaskId === null)
          .length,
        idleWorkerErrorHandlerCount: slots.filter(
          (slot) => slot.activeTaskId === null && slot.worker.onerror !== null,
        ).length,
        idleWorkerMessageHandlerCount: slots.filter(
          (slot) =>
            slot.activeTaskId === null && slot.worker.onmessage !== null,
        ).length,
        retainCount: retainCount - pending.size,
        visibilityListenerCount: visibilityListenerActive ? 1 : 0,
      },
      slots: selectedSlots.map((slot) => ({
        activeTaskId: slot.activeTaskId,
        alive: slot.alive,
        dispatchable: isSlotUsable(slot) && slot.activeTaskId === null,
        id: slot.id,
        quarantined: slot.quarantined,
        workerErrorHandlerActive: slot.worker.onerror !== null,
        workerMessageHandlerActive: slot.worker.onmessage !== null,
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
    validateScope(scope)
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
      if (!matchesScope(task, scope) || task.slotId !== null) continue
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
    validateScope(scope)
    const affectedTaskIds: number[] = []
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
      affectedTaskIds.push(task.id)
      cancelTask(
        task,
        'request-cancel',
        'fsus_worker_request_canceled',
        cancelOptions.hardCancel ?? task.hardCancel,
      )
    }
    const unavailableTaskIds: number[] = []
    for (const { slot, identity } of selectedSlots) {
      if (!slot.alive || slot.activeTaskId !== identity.id) continue
      if (cancelOptions.hardCancel) {
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
    dispose: () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityHandler)
        visibilityListenerActive = false
      }
      dispose()
    },
    getActiveCount: activeCount,
    getPendingCount: () => pending.size,
    getQueueDepth: queueDepth,
    getWorkerCount: () => slots.length,
    inspectResources,
    cancelTasks,
    resumeTasks: (scope: FsusWorkerTaskScope) =>
      setTasksSuspended(scope, false),
    suspendTasks: (scope: FsusWorkerTaskScope) =>
      setTasksSuspended(scope, true),
    retain,
    run,
  }
}
