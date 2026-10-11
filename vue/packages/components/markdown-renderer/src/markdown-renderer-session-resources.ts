import type {
  MarkdownEditorSessionResourceInspection,
  MarkdownEditorSessionResourceParticipant,
} from '../../markdown-editor/src/markdown-editor-session-resources'
import type {
  MarkdownRenderChunk,
  MarkdownSafeHtml,
  MarkdownSafeRenderResult,
} from '@element-plus/wasm'
import type {
  FsusRenderPipelineRuntimeResourceInspection,
  useFsusVirtualWindow,
} from '../../../hooks/use-render-pipeline'
import type { MarkdownHeavyFeatureResourceInspection } from '../../../hooks/use-markdown-heavy-feature-lifecycle'
import type {
  MarkdownEditorFrameScheduler,
  MarkdownEditorFrameTask,
} from '../../../hooks/use-markdown-editor-frame-scheduler'
import type { WatchHandle } from 'vue'

export interface MarkdownRendererDocumentState {
  readonly documentIdentity: Readonly<{ id: string; epoch: number | string }>
  readonly revision: number | string
}

/** An opaque ref into this mounted renderer, not a serialized checkpoint. */
export interface MarkdownRendererLastValidRender extends MarkdownRendererDocumentState {
  readonly ref: string
}

export interface MarkdownRendererRetainedProjection {
  readonly html: MarkdownSafeHtml | null
  readonly units: readonly MarkdownRenderChunk[]
  readonly strategy: 'sync' | 'chunked-main' | 'chunked-worker'
}

export interface MarkdownRendererRestoreProof {
  readonly ref: string
  readonly status: 'restored' | 'blocked'
  readonly reason: string | null
}

export interface MarkdownRendererRenderGeneration extends MarkdownRendererDocumentState {
  readonly generation: number
}

// Observe actual retained resources after disposal, without inferring the
// failure cause, successful termination or attribution of shared pool totals.
export const inspectMarkdownRendererWorkerCleanupResidue = (
  pipeline: FsusRenderPipelineRuntimeResourceInspection,
) =>
  Object.freeze({
    ownedScopes: Object.freeze(
      pipeline.workerResources.scopes
        .filter(
          ({ inspection }) =>
            inspection.disposed &&
            (inspection.slots.length > 0 ||
              inspection.tasks.length > 0 ||
              inspection.queueDepth > 0),
        )
        .map(({ inspection }) => inspection),
    ),
    poolContext: Object.freeze(
      pipeline.workerResources.pools.filter(
        ({ disposed, pool, shared }) =>
          disposed &&
          (pool.workerCount > 0 ||
            pool.pendingCount > 0 ||
            pool.queueDepth > 0 ||
            pool.retainCount > 0 ||
            shared.backgroundTimerActive ||
            shared.idleTerminateTimerActive ||
            shared.visibilityListenerCount > 0),
      ),
    ),
  })

// Optional registration fields describe native knowledge, not handle counts.
// A missing legacy field is unavailable, never evidence of no registration.
export const hasUnavailableMarkdownRendererWorkerListenerRegistration = (
  pipeline: FsusRenderPipelineRuntimeResourceInspection,
) => {
  const unavailable = (
    registration: 'none' | 'registered' | 'unknown' | undefined,
  ) => registration !== 'none' && registration !== 'registered'
  return (
    pipeline.workerResources.scopes.some(({ inspection }) =>
      inspection.tasks.some((task) =>
        unavailable(task.abortListenerRegistration),
      ),
    ) ||
    pipeline.workerResources.pools.some(({ shared }) =>
      unavailable(shared.visibilityListenerRegistration),
    )
  )
}

// Preserve the remaining real source gaps; available hook counts are exposed
// separately and never turn opaque adapter/worker/platform state into zero.
export const markdownRendererSessionSourceDependencies = Object.freeze([
  'markdown-runtime:activation-and-gateway-loader-import-network-census',
  'renderer:validated-snapshot-restoration-after-disposal',
  'heavy-feature-runtime:timer-and-network-cancellation-authority',
  'native-vue:renderer-effect-and-flush-resource-census',
  'renderer:owned-event-registration-and-reversible-control',
  'renderer:callback-queue-checkpoint-and-epoch-safe-recreation',
  // Quarantine is source-reviewed; the worker-owner synchronous lifecycle
  // repairs are composed, but independent review/qualification remains pending.
  'render-pipeline-worker:reentrant-enqueue-disposal-cleanup',
  'render-pipeline-worker:retained-task-slot-association',
] as const)

export const createMarkdownRendererSessionResourceOwner = (options: {
  readonly ownerKey: string
  readonly readDocumentState: () => MarkdownRendererDocumentState
  readonly readProjection: () => MarkdownRendererRetainedProjection
  readonly readPipelineResources: () => FsusRenderPipelineRuntimeResourceInspection
  readonly readHeavyResources: () => MarkdownHeavyFeatureResourceInspection
  readonly readVirtualWindowResources: () => ReturnType<
    ReturnType<typeof useFsusVirtualWindow>['inspectResources']
  >
  readonly readProjectionResources: () => {
    readonly renderers: number
    readonly observers: number
    readonly backgroundTasks: number
    readonly memoryUnits: number
    readonly retainedListeners: number
  }
}) => {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const frames = new Map<number, () => void>()
  const scheduledFrames = new Map<string, () => void>()
  const jobs = new Set<symbol>()
  const listeners = new Set<() => void>()
  let generation = 0
  let disposed = false
  let sequence = 0
  let renderWatchHandle: WatchHandle | null = null
  let stoppingRenderWatch = false
  let renderWatchCleanupFailure: Readonly<{
    phase: 'render-watch-stop'
    error: unknown
  }> | null = null
  let retained: {
    readonly capture: MarkdownRendererLastValidRender
    readonly result: MarkdownSafeRenderResult
    readonly projection: MarkdownRendererRetainedProjection
  } | null = null

  const sameDocument = (
    a: MarkdownRendererDocumentState,
    b: MarkdownRendererDocumentState,
  ) =>
    a.documentIdentity.id === b.documentIdentity.id &&
    a.documentIdentity.epoch === b.documentIdentity.epoch

  const readDocumentState = (): MarkdownRendererDocumentState => {
    const state = options.readDocumentState()
    return Object.freeze({
      documentIdentity: Object.freeze({ ...state.documentIdentity }),
      revision: state.revision,
    })
  }
  const stopRenderWatch = () => {
    const handle = renderWatchHandle
    if (!handle || stoppingRenderWatch) return
    stoppingRenderWatch = true
    try {
      handle.stop()
      // Release only the actual owned handle after its own stop returns.
      if (renderWatchHandle === handle) {
        renderWatchHandle = null
        renderWatchCleanupFailure = null
      }
    } catch (error) {
      renderWatchCleanupFailure = Object.freeze({
        phase: 'render-watch-stop',
        error,
      })
      throw error
    } finally {
      stoppingRenderWatch = false
    }
  }
  const bindRenderWatchHandle = (handle: WatchHandle) => {
    if (renderWatchHandle && renderWatchHandle !== handle)
      throw new Error('markdown-renderer-render-watch-already-owned')
    renderWatchHandle = handle
    // Immediate watch setup may have reentered ordinary unmount before binding.
    if (disposed) stopRenderWatch()
  }
  const beginRender = (): MarkdownRendererRenderGeneration =>
    Object.freeze({ ...readDocumentState(), generation: ++generation })
  const isCurrent = (token: MarkdownRendererRenderGeneration) => {
    const current = options.readDocumentState()
    return (
      !disposed &&
      token.generation === generation &&
      sameDocument(token, current) &&
      token.revision === current.revision
    )
  }
  const captureLastValidRender = (): MarkdownRendererLastValidRender | null => {
    if (disposed || !retained) return null
    if (!sameDocument(retained.capture, options.readDocumentState())) {
      retained = null
      return null
    }
    return retained.capture
  }
  const retainLastValidRender = (
    token: MarkdownRendererRenderGeneration,
    result: MarkdownSafeRenderResult,
  ) => {
    if (!isCurrent(token)) return false
    // The component calls this only at an authorized, identity-matched commit.
    // Keep the actual immutable result in the sole owner, never reconstruct it
    // from HTML, a source digest or a fabricated success receipt.
    retained = Object.freeze({
      capture: Object.freeze({
        documentIdentity: token.documentIdentity,
        revision: token.revision,
        ref: `${options.ownerKey}:render:${++sequence}`,
      }),
      result,
      projection: Object.freeze({ ...options.readProjection() }),
    })
    return true
  }
  const readRetainedRender = (ref: string) => {
    const capture = captureLastValidRender()
    if (
      !capture ||
      capture.ref !== ref ||
      jobs.size > 0 ||
      capture.revision !== options.readDocumentState().revision
    )
      return null
    return retained
  }
  const trackJob = () => {
    const job = Symbol('renderer-job')
    jobs.add(job)
    return () => jobs.delete(job)
  }
  const setTimer = (run: () => void, delay: number) => {
    const handle = setTimeout(() => {
      timers.delete(handle)
      if (!disposed) run()
    }, delay)
    timers.add(handle)
    return handle
  }
  const clearTimer = (handle: ReturnType<typeof setTimeout>) => {
    clearTimeout(handle)
    timers.delete(handle)
  }
  const afterFrame = () =>
    new Promise<void>((resolve) => {
      if (disposed || typeof requestAnimationFrame !== 'function') {
        resolve()
        return
      }
      const handle = requestAnimationFrame(() => {
        frames.delete(handle)
        resolve()
      })
      frames.set(handle, resolve)
    })
  const scheduleFrame = (
    scheduler: MarkdownEditorFrameScheduler,
    task: MarkdownEditorFrameTask,
    onCancel: () => void = () => undefined,
  ) => {
    if (disposed) {
      onCancel()
      return false
    }
    const key = `${options.ownerKey}:${task.key}`
    scheduledFrames.get(key)?.()
    const cancel = () => {
      scheduler.cancel(key)
      scheduledFrames.delete(key)
      onCancel()
    }
    const accepted = scheduler.schedule({
      ...task,
      key,
      postPaint: () => {
        scheduledFrames.delete(key)
        task.postPaint?.()
      },
    })
    if (accepted) scheduledFrames.set(key, cancel)
    else onCancel()
    return accepted
  }
  const cancelFrames = () => {
    for (const cancel of scheduledFrames.values()) cancel()
    for (const [handle, resolve] of frames) {
      cancelAnimationFrame(handle)
      resolve()
    }
    frames.clear()
  }
  const listenForAbort = (signal: AbortSignal, run: () => void) => {
    const remove = () => {
      signal.removeEventListener('abort', abort)
      listeners.delete(remove)
    }
    const abort = () => {
      remove()
      run()
    }
    signal.addEventListener('abort', abort, { once: true })
    listeners.add(remove)
    return remove
  }
  const inspectOwnedResources = () => {
    const projection = options.readProjectionResources()
    const pipeline = options.readPipelineResources()
    const viewport = options.readVirtualWindowResources()
    const heavy = options.readHeavyResources()
    const workerCleanupResidue =
      inspectMarkdownRendererWorkerCleanupResidue(pipeline)
    const workerScopes = pipeline.workerResources.scopes.map(
      ({ inspection }) => inspection,
    )
    const missingSourceDependencies: string[] = [
      ...markdownRendererSessionSourceDependencies,
    ]
    if (renderWatchCleanupFailure) {
      missingSourceDependencies.push('renderer:native-watch-cleanup-settlement')
    }
    if (hasUnavailableMarkdownRendererWorkerListenerRegistration(pipeline)) {
      missingSourceDependencies.push(
        'render-pipeline-worker:listener-native-registration-unknown-or-unavailable',
      )
    }
    if (
      workerCleanupResidue.ownedScopes.length > 0 ||
      workerCleanupResidue.poolContext.length > 0
    ) {
      missingSourceDependencies.push(
        'render-pipeline-worker:disposed-resource-cleanup',
      )
    }
    if (pipeline.pendingWorkerCallbackFailureNotification) {
      missingSourceDependencies.push(
        'render-pipeline-runtime:worker-callback-failure-notification-settlement',
      )
    }
    if (pipeline.workerCallbackFailure) {
      missingSourceDependencies.push(
        'render-pipeline-runtime:worker-callback-failure-recovery',
      )
    }
    if (pipeline.adapterResources === 'unknown') {
      missingSourceDependencies.push(
        'markdown-runtime:adapter-internal-resource-census',
      )
    }
    if (
      workerScopes.some((scope) => scope.workerInternalResources === 'unknown')
    ) {
      missingSourceDependencies.push(
        'render-pipeline-worker:internal-resource-census',
      )
    }
    if (
      pipeline.workerResources.pools.some(
        ({ shared }) => shared.attribution === 'unattributable',
      )
    ) {
      missingSourceDependencies.push(
        'render-pipeline-worker:pool-context-attribution',
      )
    }
    if (viewport.observerInternalCallbacks === 'unknown') {
      missingSourceDependencies.push(
        'virtual-window:platform-observer-callback-qualification',
      )
    }
    if (typeof heavy.usage.timers !== 'number') {
      missingSourceDependencies.push(
        `heavy-feature-runtime:timers-${heavy.usage.timers}`,
      )
    }
    if (typeof heavy.usage.networkRequests !== 'number') {
      missingSourceDependencies.push(
        `heavy-feature-runtime:network-${heavy.usage.networkRequests}`,
      )
    }
    // Count measurable handles only. Unknown fields remain verbatim under
    // sources/unknownUsage; this subtotal is never a participant inspection.
    let knownTimers = timers.size + pipeline.timers + viewport.timers
    let knownNetworkRequests: number | null = null
    if (typeof heavy.usage.timers === 'number')
      knownTimers += heavy.usage.timers
    if (typeof heavy.usage.networkRequests === 'number')
      knownNetworkRequests = heavy.usage.networkRequests
    for (const scope of workerScopes) {
      knownTimers +=
        scope.resources.requestTimeoutCount + scope.resources.cancelTimeoutCount
    }
    return Object.freeze({
      complete: false as const,
      measuredUsageOnly: true as const,
      missingSourceDependencies: Object.freeze(missingSourceDependencies),
      sources: Object.freeze({
        rendererNative: Object.freeze({
          renderWatchHandleRetained: renderWatchHandle !== null,
          stoppingRenderWatch,
          // One retained WatchHandle is not the native component effect/queue.
          effectCensus: 'unknown' as const,
          flushJobCensus: 'unknown' as const,
        }),
        renderPipeline: pipeline,
        virtualWindow: viewport,
        heavyFeatures: heavy,
      }),
      diagnostics: Object.freeze({
        renderWatchCleanupFailure,
        workerCleanupResidue,
        // Preserve the actual retained failure; its cumulative count is not
        // an active task count or evidence that cleanup/recovery succeeded.
        workerCallbackFailure: pipeline.workerCallbackFailure,
        pendingWorkerCallbackFailureNotification:
          pipeline.pendingWorkerCallbackFailureNotification,
      }),
      unknownUsage: Object.freeze({
        vueEffects: 'unknown' as const,
        vueFlushJobs: 'unknown' as const,
        timers:
          typeof heavy.usage.timers === 'number' ? null : heavy.usage.timers,
        networkRequests:
          typeof heavy.usage.networkRequests === 'number'
            ? null
            : heavy.usage.networkRequests,
        workerInternals: Object.freeze(
          workerScopes.map((scope) => scope.workerInternalResources),
        ),
        poolAttribution: Object.freeze(
          pipeline.workerResources.pools.map(
            ({ shared }) => shared.attribution,
          ),
        ),
        // Preserve unknown and absent optional fields verbatim, not as zero.
        workerAbortListenerRegistration: Object.freeze(
          workerScopes.flatMap((scope) =>
            scope.tasks.map((task) => task.abortListenerRegistration),
          ),
        ),
        workerVisibilityListenerRegistration: Object.freeze(
          pipeline.workerResources.pools.map(
            ({ shared }) => shared.visibilityListenerRegistration,
          ),
        ),
      }),
      // No aggregate-shaped network zero is emitted when this field is unknown.
      knownNetworkRequests,
      inspection: Object.freeze({
        ownerRef: 'renderer-projection',
        paused: false,
        recoverable: false,
        retainedListeners:
          listeners.size +
          projection.retainedListeners +
          pipeline.retainedListeners +
          pipeline.hardware.retainedListeners +
          viewport.retainedListeners +
          heavy.usage.listeners +
          workerScopes.reduce(
            (count, scope) =>
              count +
              scope.resources.abortListenerCount +
              scope.resources.workerErrorHandlerCount +
              scope.resources.workerMessageHandlerCount,
            0,
          ),
        usage: Object.freeze({
          editorInstances: 0,
          renderers:
            (disposed ? 0 : 1) +
            projection.renderers +
            heavy.usage.runtimes +
            workerScopes.reduce((count, scope) => count + scope.workerCount, 0),
          observers:
            projection.observers + viewport.observers + heavy.usage.observers,
          timers: knownTimers,
          backgroundTasks:
            jobs.size +
            (stoppingRenderWatch ? 1 : 0) +
            frames.size +
            scheduledFrames.size +
            projection.backgroundTasks +
            pipeline.pendingRenders +
            pipeline.pendingRenderAdmissions +
            pipeline.pendingControlTransitions +
            pipeline.pendingAdapterJobs +
            pipeline.rafHandles +
            pipeline.idleHandles +
            pipeline.hardware.rafHandles +
            pipeline.hardware.pendingBatteryQueries +
            viewport.rafHandles +
            viewport.idleHandles +
            viewport.pendingViewportTicks +
            viewport.pendingMeasurements +
            heavy.usage.tasks +
            workerScopes.reduce(
              (count, scope) =>
                count +
                scope.tasks.filter(
                  (task) =>
                    task.promiseState === 'pending' ||
                    scope.slots.some(
                      (slot) =>
                        slot.alive &&
                        slot.id === task.workerId &&
                        slot.activeTaskId === task.id,
                    ),
                ).length,
              0,
            ),
          // Direct component requests only. The measured heavy count is exposed
          // separately; an unknown heavy count is never coerced into this zero.
          networkRequests: 0,
          memoryUnits:
            projection.memoryUnits +
            (renderWatchHandle ? 1 : 0) +
            (renderWatchCleanupFailure ? 1 : 0) +
            (retained ? 1 : 0) +
            timers.size +
            frames.size +
            scheduledFrames.size +
            jobs.size +
            listeners.size +
            viewport.indexedUnits +
            viewport.retainedElements +
            viewport.measuredSizes +
            viewport.pendingMeasurements +
            pipeline.retainedSharedOwners +
            (pipeline.workerCallbackFailure ? 1 : 0) +
            // A pending notification can hold an older, distinct real snapshot.
            (pipeline.pendingWorkerCallbackFailureNotification &&
            pipeline.pendingWorkerCallbackFailureNotification !==
              pipeline.workerCallbackFailure
              ? 1
              : 0) +
            pipeline.pendingRenderAdmissions +
            pipeline.pendingControlTransitions +
            heavy.usage.pendingImports +
            heavy.usage.scheduledContinuations +
            workerScopes.reduce(
              (count, scope) =>
                count + scope.resources.taskRetainCount + scope.slots.length,
              0,
            ),
        }),
      } satisfies MarkdownEditorSessionResourceInspection),
    })
  }
  const requireSourceCensus = (): never => {
    throw new Error(
      `markdown-renderer-session-resource-source-unavailable:${inspectOwnedResources().missingSourceDependencies.join(',')}`,
    )
  }
  const participant: MarkdownEditorSessionResourceParticipant = Object.freeze({
    ownerRef: 'renderer-projection',
    inspect: requireSourceCensus,
    // Refuse before mutation: cancelling the known component handles alone
    // cannot suspend the hidden hook resources, or justify a successful ack.
    pause: requireSourceCensus,
    resume: requireSourceCensus,
    dispose(_snapshotRef: string) {
      throw new Error('markdown-renderer-session-checkpoint-not-recoverable')
    },
  })
  const disposeOnUnmount = () => {
    disposed = true
    generation += 1
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    cancelFrames()
    for (const remove of listeners) remove()
    stopRenderWatch()
    retained = null
    // Promises remain in the census until their real finally blocks settle.
  }
  return Object.freeze({
    afterFrame,
    bindRenderWatchHandle,
    beginRender,
    captureLastValidRender,
    clearTimer,
    disposeOnUnmount,
    inspectOwnedResources,
    invalidate: () => {
      generation += 1
      cancelFrames()
      captureLastValidRender()
    },
    isCurrent,
    listenForAbort,
    participant,
    readRetainedRender,
    retainLastValidRender,
    scheduleFrame,
    setTimer,
    trackJob,
  })
}
