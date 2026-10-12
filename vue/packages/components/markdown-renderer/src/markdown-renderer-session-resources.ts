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
import type {
  MarkdownHeavyFeatureResourceInspection,
  MarkdownHeavyFeatureDocumentAuthority,
  MarkdownHeavyFeatureDocumentAuthorityRetirementHandle,
} from '../../../hooks/use-markdown-heavy-feature-lifecycle'
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

/** An actual pinned renderer-state record; native recovery remains unavailable. */
export interface MarkdownRendererOwnedCheckpoint extends MarkdownRendererDocumentState {
  readonly ref: string
  readonly lastValidRenderRef: string
  readonly scope: 'renderer-owned-state'
  readonly nativeRecovery: 'unavailable'
}

/** Exact producer-held custody tokens, not complete host/recovery receipts. */
export interface MarkdownRendererCheckpointPreparation {
  readonly checkpoint: MarkdownRendererOwnedCheckpoint
  readonly baseCheckpointRef: string | null
  readonly scope: 'renderer-custody-only'
  readonly complete: false
  readonly recoverable: false
}

export interface MarkdownRendererCheckpointPublication extends MarkdownRendererCheckpointPreparation {
  readonly authority: 'captured-renderer-only'
}

export interface MarkdownRendererRetainedProjection {
  readonly html: MarkdownSafeHtml | null
  readonly units: readonly MarkdownRenderChunk[]
  readonly strategy: 'sync' | 'chunked-main' | 'chunked-worker'
}

type MarkdownRendererRetainedRender = Readonly<{
  capture: MarkdownRendererLastValidRender
  result: MarkdownSafeRenderResult
  projection: MarkdownRendererRetainedProjection
}>

export interface MarkdownRendererCleanupAction {
  readonly phase: string
  readonly resource: unknown
  readonly run: () => void
}

type MarkdownRendererFrameFinalizer = {
  readonly run: () => void
  state: 'pending' | 'running' | 'completed'
  selected: boolean
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
export const markdownRendererCheckpointSealSourceDependencies = Object.freeze([
  'renderer:document-source-synchronous-authority-ticket',
  'render-pipeline:complete-synchronous-authority-revocation-ticket',
  'renderer:projection-deactivation-cleanup-seal-revocation-coverage',
] as const)

export const markdownRendererSessionSourceDependencies = Object.freeze([
  'markdown-runtime:activation-and-gateway-loader-import-network-census',
  'renderer:validated-snapshot-restoration-after-disposal',
  'heavy-feature-runtime:timer-and-network-cancellation-authority',
  'native-vue:renderer-effect-and-flush-resource-census',
  'renderer:owned-event-registration-and-reversible-control',
  'renderer:callback-queue-checkpoint-and-epoch-safe-recreation',
  'renderer:callback-free-live-authority-attestation-for-full-host-refset',
  ...markdownRendererCheckpointSealSourceDependencies,
  // Quarantine is source-reviewed; the worker-owner synchronous lifecycle
  // repairs are composed, but independent review/qualification remains pending.
  'render-pipeline-worker:reentrant-enqueue-disposal-cleanup',
  'render-pipeline-worker:retained-task-slot-association',
] as const)

export const createMarkdownRendererSessionResourceOwner = <
  State extends object,
>(options: {
  readonly ownerKey: string
  readonly readDocumentState: () => MarkdownRendererDocumentState
  readonly readProjection: () => MarkdownRendererRetainedProjection
  readonly readOwnedCheckpointState: () => {
    readonly state: Readonly<State>
    readonly retainedCollectionEntries: number
  }
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
  readonly readComponentCleanupPending: () => number
  readonly readDocumentAuthority: () => MarkdownHeavyFeatureDocumentAuthority | null
}) => {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const frames = new Map<number, () => void>()
  const scheduledFrames = new Map<string, () => void>()
  const jobs = new Set<symbol>()
  const listeners = new Set<() => void>()
  const installingListeners = new Set<() => void>()
  const pendingFrameFinalizers = new Map<
    () => void,
    MarkdownRendererFrameFinalizer
  >()
  const installations = new Map<
    object,
    { phase: string; state: 'installing' | 'unknown'; error?: unknown }
  >()
  const pendingComponentCleanups = new Map<string, Map<unknown, () => void>>()
  const controlledFrameKeys = new Set<string>()
  const cleanupFailures = new Map<string, Map<unknown, Set<unknown>>>()
  const runningCleanups = new Map<string, Set<unknown>>()
  let disposingOnUnmount = false
  let generation = 0
  let checkpointAuthorityGeneration = 0
  let checkpointAuthorityOverflowed = false
  let checkpointDeactivated = false
  let checkpointAuthorityCallbackDepth = 0
  let lastCheckpointAuthorityRetirement: string | null = null
  let documentRetirement: {
    readonly source: MarkdownHeavyFeatureDocumentAuthority
    readonly handle: MarkdownHeavyFeatureDocumentAuthorityRetirementHandle
  } | null = null
  let documentRetirementUnknown = false
  let bindingDocumentRetirement = false
  const retireCheckpointAuthority = (reason: string) => {
    // Same producer's private retirement version, not a document/pipeline ticket.
    if (checkpointAuthorityGeneration === Number.MAX_SAFE_INTEGER)
      checkpointAuthorityOverflowed = true
    else checkpointAuthorityGeneration += 1
    lastCheckpointAuthorityRetirement = reason
  }
  const runCheckpointAuthorityCallback = <T>(
    reason: string,
    run: () => T,
    resource: unknown = run,
    failurePhase = `checkpoint-callback:${reason}`,
  ): T => {
    retireCheckpointAuthority(reason)
    checkpointAuthorityCallbackDepth += 1
    try {
      return run()
    } catch (error) {
      retireCheckpointAuthority('callback-failure')
      let resources = cleanupFailures.get(failurePhase)
      if (!resources) {
        resources = new Map()
        cleanupFailures.set(failurePhase, resources)
      }
      let causes = resources.get(resource)
      if (!causes) {
        causes = new Set()
        resources.set(resource, causes)
      }
      causes.add(error)
      throw error
    } finally {
      retireCheckpointAuthority('callback-completion')
      checkpointAuthorityCallbackDepth -= 1
    }
  }
  let disposed = false
  let sequence = 0
  let checkpointSequence = 0
  let capturingCheckpoint = false
  let renderWatchHandle: WatchHandle | null = null
  let stoppingRenderWatch = false
  let renderWatchCleanupFailure: Readonly<{
    phase: 'render-watch-stop'
    error: unknown
  }> | null = null
  let retained: MarkdownRendererRetainedRender | null = null
  type CheckpointRecord = {
    readonly capture: MarkdownRendererOwnedCheckpoint
    readonly render: MarkdownRendererRetainedRender
    readonly state: Readonly<State>
    readonly retainedCollectionEntries: number
  }
  let checkpoint: CheckpointRecord | null = null
  let preparedCheckpoint: {
    readonly record: CheckpointRecord
    readonly base: CheckpointRecord | null
    readonly generation: number
    readonly authorityGeneration: number
    readonly preparation: MarkdownRendererCheckpointPreparation
    readonly publication: MarkdownRendererCheckpointPublication
    validated: boolean
  } | null = null

  const beginInstallation = (phase: string) => {
    if (disposed) throw new Error('markdown-renderer-resource-owner-disposed')
    retireCheckpointAuthority('resource-admission')
    const token = {}
    installations.set(token, { phase, state: 'installing' })
    return Object.freeze({
      complete: () => {
        if (installations.has(token))
          retireCheckpointAuthority('resource-settlement')
        return installations.delete(token)
      },
      fail: (error: unknown) => {
        retireCheckpointAuthority('cleanup-failure')
        installations.set(token, { phase, state: 'unknown', error })
      },
    })
  }
  const finalizeFrame = (
    key: () => void,
    finalizer: MarkdownRendererFrameFinalizer,
  ) => {
    if (finalizer.state !== 'pending') return
    finalizer.selected = true
    finalizer.state = 'running'
    pendingFrameFinalizers.set(key, finalizer)
    try {
      finalizer.run()
      finalizer.state = 'completed'
      if (pendingFrameFinalizers.get(key) === finalizer)
        pendingFrameFinalizers.delete(key)
    } catch (error) {
      finalizer.state = 'pending'
      throw error
    }
  }

  const runCleanupBatch = (
    actions: readonly MarkdownRendererCleanupAction[],
  ) => {
    const errors: unknown[] = []
    for (const { phase, resource, run } of actions) {
      let running = runningCleanups.get(phase)
      if (running?.has(resource)) continue
      if (!running) {
        running = new Set()
        runningCleanups.set(phase, running)
      }
      running.add(resource)
      retireCheckpointAuthority('cleanup-selected')
      try {
        runCheckpointAuthorityCallback(phase, run, resource, phase)
      } catch (error) {
        retireCheckpointAuthority('cleanup-failure')
        errors.push(error)
        let resources = cleanupFailures.get(phase)
        if (!resources) {
          resources = new Map()
          cleanupFailures.set(phase, resources)
        }
        let causes = resources.get(resource)
        if (!causes) {
          causes = new Set()
          resources.set(resource, causes)
        }
        causes.add(error)
      } finally {
        running.delete(resource)
        if (running.size === 0) runningCleanups.delete(phase)
      }
    }
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1)
      throw new AggregateError(errors, 'markdown-renderer-cleanup-batch-failed')
  }

  const registerComponentCleanups = (
    actions: readonly MarkdownRendererCleanupAction[],
  ) => {
    for (const { phase, resource, run } of actions) {
      let records = pendingComponentCleanups.get(phase)
      if (!records) {
        records = new Map()
        pendingComponentCleanups.set(phase, records)
      }
      if (!records.has(resource)) records.set(resource, run)
    }
  }
  const componentCleanupActions = () =>
    [...pendingComponentCleanups].flatMap(([phase, records]) =>
      [...records].map(([resource, run]) => ({
        phase,
        resource,
        run: () => {
          run()
          if (records.get(resource) === run) records.delete(resource)
          if (records.size === 0) pendingComponentCleanups.delete(phase)
        },
      })),
    )
  const cleanupComponentResources = (
    actions: readonly MarkdownRendererCleanupAction[],
  ) => {
    registerComponentCleanups(actions)
    runCleanupBatch(componentCleanupActions())
  }
  const releaseDocumentRetirement = () => {
    const record = documentRetirement
    if (!record) return
    runCheckpointAuthorityCallback(
      'document-retirement-unsubscribe',
      () => {
        retireCheckpointAuthority('document-retirement-release')
        // Native source calls this same receiver before removing registration.
        record.handle.unsubscribe()
        if (record.handle.hasCustody()) {
          const cause = record.handle.failureCause()
          if (cause !== undefined) throw cause
          throw new Error(
            'markdown-renderer-document-retirement-still-retained',
          )
        }
        if (documentRetirement === record) documentRetirement = null
      },
      record.handle,
      'document-retirement-unsubscribe',
    )
  }
  const bindDocumentAuthorityReceiver = (): boolean =>
    runCheckpointAuthorityCallback(
      'document-retirement-bind',
      () => {
        if (bindingDocumentRetirement || documentRetirementUnknown)
          throw new Error(
            'markdown-renderer-document-retirement-registration-pending',
          )
        const installation = beginInstallation(
          'document-retirement-registration',
        )
        bindingDocumentRetirement = true
        let creationUnknown = false
        try {
          const source = options.readDocumentAuthority()
          if (!source) return false
          if (documentRetirement) {
            if (documentRetirement.source !== source)
              throw new Error(
                'markdown-renderer-document-retirement-source-changed',
              )
            return documentRetirement.handle.hasCustody()
          }
          let handle: MarkdownHeavyFeatureDocumentAuthorityRetirementHandle
          try {
            handle = source.subscribeRetirement(() =>
              retireCheckpointAuthority('document-source-retirement'),
            )
          } catch (cause) {
            creationUnknown = true
            documentRetirementUnknown = true
            installation.fail(cause)
            throw cause
          }
          documentRetirement = { source, handle }
          if (disposed) {
            releaseDocumentRetirement()
            return false
          }
          if (!handle.hasCustody())
            throw new Error(
              'markdown-renderer-document-retirement-not-registered',
            )
          return true
        } finally {
          bindingDocumentRetirement = false
          if (!creationUnknown) installation.complete()
        }
      },
      bindDocumentAuthorityReceiver,
    )

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
    retireCheckpointAuthority('watch-stop')
    try {
      handle.stop()
      // Release only the actual owned handle after its own stop returns.
      if (renderWatchHandle === handle) {
        renderWatchHandle = null
        renderWatchCleanupFailure = null
      }
    } catch (error) {
      retireCheckpointAuthority('cleanup-failure')
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
    retireCheckpointAuthority('watch-binding')
    renderWatchHandle = handle
    // Immediate watch setup may have reentered ordinary unmount before binding.
    if (disposed) stopRenderWatch()
  }
  const beginRender = (): MarkdownRendererRenderGeneration =>
    runCheckpointAuthorityCallback(
      'render-admission',
      () => Object.freeze({ ...readDocumentState(), generation: ++generation }),
      readDocumentState,
    )
  const isCurrent = (token: MarkdownRendererRenderGeneration) =>
    runCheckpointAuthorityCallback(
      'current-document-read',
      () => {
        const current = options.readDocumentState()
        return (
          !disposed &&
          token.generation === generation &&
          sameDocument(token, current) &&
          token.revision === current.revision
        )
      },
      readDocumentState,
    )
  const captureLastValidRender = (): MarkdownRendererLastValidRender | null => {
    if (disposed || !retained) return null
    if (!sameDocument(retained.capture, options.readDocumentState())) {
      retireCheckpointAuthority('document-mismatch')
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
    retireCheckpointAuthority('retained-projection')
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
  const prepareRendererOwnedCheckpoint =
    (): MarkdownRendererCheckpointPreparation | null => {
      if (
        disposed ||
        capturingCheckpoint ||
        checkpointAuthorityCallbackDepth > 0 ||
        runningCleanups.size > 0 ||
        preparedCheckpoint !== null ||
        stoppingRenderWatch ||
        jobs.size > 0 ||
        timers.size > 0 ||
        frames.size > 0 ||
        scheduledFrames.size > 0 ||
        pendingFrameFinalizers.size > 0 ||
        installations.size > 0 ||
        pendingComponentCleanups.size > 0
      )
        return null
      const checkpointGeneration = generation
      const authorityGeneration = checkpointAuthorityGeneration
      const base = checkpoint
      capturingCheckpoint = true
      try {
        const capture = captureLastValidRender()
        const render = capture ? readRetainedRender(capture.ref) : null
        if (!capture || !render) return null
        const owned = options.readOwnedCheckpointState()
        const state = owned.state
        const retainedCollectionEntries = owned.retainedCollectionEntries
        if (
          !Number.isSafeInteger(retainedCollectionEntries) ||
          retainedCollectionEntries < 0
        )
          throw new Error(
            'markdown-renderer-checkpoint-owned-entry-census-invalid',
          )
        const current = options.readDocumentState()
        const projection = options.readProjection()
        if (
          disposed ||
          generation !== checkpointGeneration ||
          checkpointAuthorityCallbackDepth > 0 ||
          runningCleanups.size > 0 ||
          checkpointAuthorityGeneration !== authorityGeneration ||
          retained !== render ||
          jobs.size > 0 ||
          timers.size > 0 ||
          frames.size > 0 ||
          scheduledFrames.size > 0 ||
          pendingFrameFinalizers.size > 0 ||
          installations.size > 0 ||
          pendingComponentCleanups.size > 0 ||
          !sameDocument(capture, current) ||
          capture.revision !== current.revision ||
          projection.html !== render.projection.html ||
          projection.units !== render.projection.units ||
          projection.strategy !== render.projection.strategy
        )
          return null
        const nextCapture: MarkdownRendererOwnedCheckpoint = Object.freeze({
          ...capture,
          ref: `${options.ownerKey}:checkpoint:${++checkpointSequence}`,
          lastValidRenderRef: capture.ref,
          scope: 'renderer-owned-state',
          nativeRecovery: 'unavailable',
        })
        const record: CheckpointRecord = Object.freeze({
          capture: nextCapture,
          render,
          state,
          retainedCollectionEntries,
        })
        const preparation: MarkdownRendererCheckpointPreparation =
          Object.freeze({
            checkpoint: nextCapture,
            baseCheckpointRef: base?.capture.ref ?? null,
            scope: 'renderer-custody-only',
            complete: false,
            recoverable: false,
          })
        // Allocate every publication object before changing the published pin.
        preparedCheckpoint = {
          record,
          base,
          generation: checkpointGeneration,
          authorityGeneration,
          preparation,
          publication: Object.freeze({
            ...preparation,
            authority: 'captured-renderer-only',
          }),
          validated: false,
        }
        return preparation
      } finally {
        capturingCheckpoint = false
      }
    }
  const hasCurrentCheckpointCustody = () => {
    const candidate = preparedCheckpoint
    return (
      candidate !== null &&
      !disposed &&
      !capturingCheckpoint &&
      checkpointAuthorityCallbackDepth === 0 &&
      runningCleanups.size === 0 &&
      !stoppingRenderWatch &&
      generation === candidate.generation &&
      retained === candidate.record.render &&
      checkpoint === candidate.base &&
      jobs.size === 0 &&
      timers.size === 0 &&
      frames.size === 0 &&
      scheduledFrames.size === 0 &&
      pendingFrameFinalizers.size === 0 &&
      controlledFrameKeys.size === 0 &&
      installations.size === 0 &&
      pendingComponentCleanups.size === 0
    )
  }
  const validatePreparedRendererOwnedCheckpoint = (
    preparation: MarkdownRendererCheckpointPreparation,
  ): MarkdownRendererCheckpointPublication | null => {
    const candidate = preparedCheckpoint
    // Compare producer identity only; never read caller token properties/getters.
    if (
      !candidate ||
      candidate.preparation !== preparation ||
      !hasCurrentCheckpointCustody()
    )
      return null
    candidate.validated = true
    return candidate.publication
  }
  const publishPreparedRendererOwnedCheckpoint = (
    publication: MarkdownRendererCheckpointPublication,
  ): MarkdownRendererOwnedCheckpoint | null => {
    const candidate = preparedCheckpoint
    if (
      !candidate ||
      candidate.publication !== publication ||
      !candidate.validated ||
      !hasCurrentCheckpointCustody()
    )
      return null
    // Pure local custody publication: no producer callbacks, reactive/native
    // writes, allocation, cleanup, or claims about live external authority.
    checkpoint = candidate.record
    preparedCheckpoint = null
    return checkpoint.capture
  }
  const cancelPreparedRendererOwnedCheckpoint = (
    preparation: MarkdownRendererCheckpointPreparation,
  ) => {
    const candidate = preparedCheckpoint
    if (!candidate || candidate.preparation !== preparation) return false
    preparedCheckpoint = null
    // Only the pending pin is released. Native handles/jobs/failure proofs remain.
    return true
  }
  const captureRendererOwnedCheckpoint = () => {
    const preparation = prepareRendererOwnedCheckpoint()
    if (!preparation) return null
    try {
      const publication = validatePreparedRendererOwnedCheckpoint(preparation)
      return publication
        ? publishPreparedRendererOwnedCheckpoint(publication)
        : null
    } finally {
      cancelPreparedRendererOwnedCheckpoint(preparation)
    }
  }
  const sealPreparedRendererOwnedCheckpoint = (
    preparation: MarkdownRendererCheckpointPreparation,
  ): MarkdownRendererCheckpointPublication | null => {
    const candidate = preparedCheckpoint
    if (
      !candidate ||
      candidate.preparation !== preparation ||
      !hasCurrentCheckpointCustody() ||
      checkpointDeactivated ||
      checkpointAuthorityOverflowed ||
      cleanupFailures.size > 0 ||
      renderWatchCleanupFailure !== null ||
      candidate.authorityGeneration !== checkpointAuthorityGeneration
    )
      return null
    // The original context has getters, and pipeline diagnostics omit control
    // and resource transitions. Neither supplies a synchronous revocation ticket.
    // Refuse before changing validation, published custody, or real resources.
    throw new Error(
      `markdown-renderer-checkpoint-seal-source-unavailable:${markdownRendererCheckpointSealSourceDependencies.join(',')}`,
    )
  }
  // No original issuer can currently create a live ticket. These pure refusal
  // ports cannot promote a captured-only publication to sealed live authority.
  const hasSealedRendererOwnedCheckpointCustody = (
    _publication: MarkdownRendererCheckpointPublication,
  ): boolean => false
  const publishSealedRendererOwnedCheckpoint = (
    _publication: MarkdownRendererCheckpointPublication,
  ): MarkdownRendererOwnedCheckpoint | null => null
  const trackJob = () => {
    if (disposed) throw new Error('markdown-renderer-resource-owner-disposed')
    retireCheckpointAuthority('job-admission')
    const job = Symbol('renderer-job')
    jobs.add(job)
    return () => {
      if (jobs.has(job)) retireCheckpointAuthority('job-settlement')
      return jobs.delete(job)
    }
  }
  const finalizeRenderJob = (
    finishJob: () => void,
    readCurrent: () => boolean,
    finishOwnedFlag: () => void,
  ) =>
    runCheckpointAuthorityCallback(
      'render-finalization',
      () => {
        // Enter before the final job is released; every remaining action is tried
        // even when a live getter or owned flag setter throws.
        runCleanupBatch([
          {
            phase: 'render-job-settlement',
            resource: finishJob,
            run: finishJob,
          },
          {
            phase: 'render-final-current-read',
            resource: readCurrent,
            run: readCurrent,
          },
          {
            phase: 'render-final-owned-flag',
            resource: finishOwnedFlag,
            run: finishOwnedFlag,
          },
        ])
      },
      finishJob,
    )
  const setTimer = (run: () => void, delay: number) => {
    const installation = beginInstallation('timer')
    let handle: ReturnType<typeof setTimeout> | undefined
    let fired = false
    try {
      handle = setTimeout(
        () =>
          runCheckpointAuthorityCallback(
            'timer-callback',
            () => {
              fired = true
              if (handle !== undefined) timers.delete(handle)
              if (!disposed) run()
            },
            handle ?? run,
          ),
        delay,
      )
    } catch (error) {
      installation.fail(error)
      throw error
    }
    const ownedHandle = handle
    if (!fired) timers.add(ownedHandle)
    try {
      if (disposed)
        runCleanupBatch([
          {
            phase: 'late-timer-clear',
            resource: ownedHandle,
            run: () => clearTimer(ownedHandle),
          },
        ])
    } finally {
      installation.complete()
    }
    return handle
  }
  const clearTimer = (handle: ReturnType<typeof setTimeout>) => {
    if (!timers.has(handle)) return
    runCheckpointAuthorityCallback(
      'timer-clear',
      () => {
        clearTimeout(handle)
        timers.delete(handle)
      },
      handle,
      'timer-clear',
    )
  }
  const afterFrame = () =>
    new Promise<void>((resolve) => {
      if (disposed || typeof requestAnimationFrame !== 'function') {
        resolve()
        return
      }
      const installation = beginInstallation('animation-frame')
      let handle: number | undefined
      let fired = false
      try {
        handle = requestAnimationFrame(() =>
          runCheckpointAuthorityCallback(
            'frame-callback',
            () => {
              fired = true
              if (handle !== undefined) frames.delete(handle)
              resolve()
            },
            handle ?? resolve,
          ),
        )
      } catch (error) {
        installation.fail(error)
        throw error
      }
      if (!fired) frames.set(handle, resolve)
      try {
        if (disposed) cancelFrames()
      } finally {
        installation.complete()
      }
    })
  const scheduleFrame = (
    scheduler: MarkdownEditorFrameScheduler,
    task: MarkdownEditorFrameTask,
    onCancel: () => void = () => undefined,
  ) => {
    const finalizer: MarkdownRendererFrameFinalizer = {
      run: onCancel,
      state: 'pending',
      selected: false,
    }
    let key = ''
    let postPaintCompleted = false
    let cancellationSelected = false
    const cancel = () => {
      cancellationSelected = true
      runCleanupBatch([
        {
          phase: 'keyed-frame-cancel',
          resource: cancel,
          run: () => {
            if (scheduledFrames.get(key) !== cancel) return
            const alreadyControlled = controlledFrameKeys.has(key)
            controlledFrameKeys.add(key)
            try {
              scheduler.cancel(key)
            } finally {
              if (!alreadyControlled) controlledFrameKeys.delete(key)
            }
            if (scheduledFrames.get(key) === cancel) scheduledFrames.delete(key)
          },
        },
        {
          phase: 'keyed-frame-finalize',
          resource: cancel,
          run: () => finalizeFrame(cancel, finalizer),
        },
      ])
    }
    const finish = () =>
      runCleanupBatch([
        {
          phase: 'keyed-frame-finalize',
          resource: cancel,
          run: () => finalizeFrame(cancel, finalizer),
        },
      ])
    if (disposed) {
      finish()
      return false
    }
    const installation = beginInstallation('keyed-frame')
    let accepted: boolean
    let controlsKey = false
    try {
      key = `${options.ownerKey}:${task.key}`
      if (controlledFrameKeys.has(key)) {
        finish()
        installation.complete()
        return false
      }
      controlledFrameKeys.add(key)
      controlsKey = true
      scheduledFrames.get(key)?.()
      if (disposed) {
        finish()
        controlledFrameKeys.delete(key)
        installation.complete()
        return false
      }
      scheduledFrames.set(key, cancel)
      const queuedTask = {
        ...task,
        key,
        postPaint: () =>
          runCheckpointAuthorityCallback('frame-postpaint', () => {
            if (scheduledFrames.get(key) === cancel) scheduledFrames.delete(key)
            task.postPaint?.()
            postPaintCompleted = true
            if (!finalizer.selected) finalizer.state = 'completed'
            if (
              finalizer.state === 'completed' &&
              pendingFrameFinalizers.get(cancel) === finalizer
            )
              pendingFrameFinalizers.delete(cancel)
          }),
      }
      for (const phase of ['measure', 'mutate'] as const) {
        const run = queuedTask[phase]
        if (run)
          queuedTask[phase] = () =>
            runCheckpointAuthorityCallback(`frame-${phase}`, () =>
              run.call(queuedTask),
            )
      }
      const guard = queuedTask.guard
      if (guard)
        queuedTask.guard = () =>
          runCheckpointAuthorityCallback('frame-guard', () =>
            guard.call(queuedTask),
          )
      if (disposed) {
        if (scheduledFrames.get(key) === cancel) scheduledFrames.delete(key)
        finish()
        controlledFrameKeys.delete(key)
        installation.complete()
        return false
      }
      accepted = scheduler.schedule(queuedTask)
    } catch (error) {
      installation.fail(error)
      try {
        runCleanupBatch([
          {
            phase: 'keyed-frame-install',
            resource: cancel,
            run: () => {
              throw error
            },
          },
          { phase: 'late-keyed-frame-cleanup', resource: cancel, run: cancel },
        ])
      } finally {
        if (controlsKey) controlledFrameKeys.delete(key)
      }
      return false
    }
    try {
      if (accepted && !postPaintCompleted) {
        const current = scheduledFrames.get(key)
        if (current && current !== cancel)
          throw new Error('markdown-renderer-frame-owner-superseded')
        scheduledFrames.set(key, cancel)
        // An accepted native return cannot revive an already cancelled creation.
        // Keep this binding only until its real late cleanup returns; failure
        // retains the exact obligation and never reruns a completed finalizer.
        if (cancellationSelected || disposed) cancel()
      } else {
        if (scheduledFrames.get(key) === cancel) scheduledFrames.delete(key)
        if (!postPaintCompleted) finish()
      }
    } finally {
      if (controlsKey) controlledFrameKeys.delete(key)
      installation.complete()
    }
    return accepted && !cancellationSelected
  }
  const cancelFrames = () => {
    runCleanupBatch([
      ...[...scheduledFrames.values()].map((cancel) => ({
        phase: 'owned-keyed-frame',
        resource: cancel,
        run: cancel,
      })),
      ...[...pendingFrameFinalizers].map(([key, finalize]) => ({
        phase: 'keyed-frame-finalize',
        resource: key,
        run: () => {
          if (pendingFrameFinalizers.get(key) !== finalize) return
          finalizeFrame(key, finalize)
        },
      })),
      ...[...frames].map(([handle, resolve]) => ({
        phase: 'animation-frame-cancel',
        resource: handle,
        run: () => {
          if (frames.get(handle) !== resolve) return
          cancelAnimationFrame(handle)
          if (frames.get(handle) === resolve) frames.delete(handle)
          resolve()
        },
      })),
    ])
  }
  const listenForAbort = (signal: AbortSignal, run: () => void) => {
    if (disposed) throw new Error('markdown-renderer-resource-owner-disposed')
    retireCheckpointAuthority('abort-listener-admission')
    let removing = false
    const remove = () => {
      if (removing || !listeners.has(remove)) return
      removing = true
      try {
        signal.removeEventListener('abort', abort)
        if (!installingListeners.has(remove)) listeners.delete(remove)
      } finally {
        removing = false
      }
    }
    const abort = () => {
      runCleanupBatch([
        { phase: 'abort-listener-remove', resource: remove, run: remove },
        { phase: 'abort-listener-callback', resource: remove, run },
      ])
    }
    listeners.add(remove)
    installingListeners.add(remove)
    let setupFailed = false
    let setupError: unknown
    try {
      signal.addEventListener('abort', abort, { once: true })
    } catch (error) {
      setupFailed = true
      setupError = error
    } finally {
      installingListeners.delete(remove)
    }
    if (disposed || setupFailed)
      runCleanupBatch([
        {
          phase: 'abort-listener-install',
          resource: remove,
          run: () => {
            if (setupFailed) throw setupError
          },
        },
        { phase: 'late-abort-listener-remove', resource: remove, run: remove },
      ])
    return remove
  }
  const inspectOwnedResources = () => {
    const documentRegistration = documentRetirement
      ? documentRetirement.handle.hasCustody()
      : false
    const documentFailure = documentRetirement?.handle.failureCause()
    const documentListeners = documentRegistration ? 1 : 0
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
    if (cleanupFailures.size > 0)
      missingSourceDependencies.push('renderer:failed-native-cleanup-proof')
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
        rendererOwnedCheckpoint: checkpoint?.capture ?? null,
        rendererCheckpointCustody: Object.freeze({
          prepared: preparedCheckpoint?.preparation ?? null,
          validated: preparedCheckpoint?.validated ?? false,
          publication: 'renderer-custody-only' as const,
          liveAuthority: 'unavailable' as const,
          fullHostRefset: 'unavailable' as const,
          seal: 'unavailable' as const,
          missingSealSourceDependencies:
            markdownRendererCheckpointSealSourceDependencies,
          ownedAuthorityRetirement: Object.freeze({
            generation: checkpointAuthorityGeneration,
            overflowed: checkpointAuthorityOverflowed,
            deactivated: checkpointDeactivated,
            lastReason: lastCheckpointAuthorityRetirement,
            runningCallbacks: checkpointAuthorityCallbackDepth,
            scope: 'renderer-owned-only' as const,
          }),
        }),
        documentAuthorityRetirement: Object.freeze({
          source: documentRetirement?.source ?? null,
          handle: documentRetirement?.handle ?? null,
          registration: documentRetirementUnknown
            ? ('unknown' as const)
            : documentRegistration
              ? ('registered' as const)
              : ('not-retained' as const),
          knownRetainedListeners: documentListeners,
          unknownRegistrations: documentRetirementUnknown,
          failureCause: documentFailure,
        }),
        rendererNative: Object.freeze({
          renderWatchHandleRetained: renderWatchHandle !== null,
          stoppingRenderWatch,
          capturingOwnedCheckpoint: capturingCheckpoint,
          disposingOnUnmount,
          installingAbortListeners: installingListeners.size,
          pendingFrameFinalizers: pendingFrameFinalizers.size,
          controlledFrameKeys: controlledFrameKeys.size,
          resourceInstallations: Object.freeze(
            [...installations.values()].map((record) =>
              Object.freeze({ ...record }),
            ),
          ),
          pendingComponentCleanups: [
            ...pendingComponentCleanups.values(),
          ].reduce((sum, records) => sum + records.size, 0),
          // One retained WatchHandle is not the native component effect/queue.
          effectCensus: 'unknown' as const,
          flushJobCensus: 'unknown' as const,
        }),
        renderPipeline: pipeline,
        virtualWindow: viewport,
        heavyFeatures: heavy,
      }),
      diagnostics: Object.freeze({
        cleanupFailures: Object.freeze(
          [...cleanupFailures].flatMap(([phase, resources]) =>
            [...resources.values()].map((causes) =>
              Object.freeze({ phase, causes: Object.freeze([...causes]) }),
            ),
          ),
        ),
        renderWatchCleanupFailure,
        workerCleanupResidue,
        // Preserve the actual retained failure; its cumulative count is not
        // an active task count or evidence that cleanup/recovery succeeded.
        workerCallbackFailure: pipeline.workerCallbackFailure,
        pendingWorkerCallbackFailureNotification:
          pipeline.pendingWorkerCallbackFailureNotification,
      }),
      unknownUsage: Object.freeze({
        documentRetirementRegistrations: documentRetirementUnknown
          ? ('unknown' as const)
          : 0,
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
          documentListeners +
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
            checkpointAuthorityCallbackDepth +
            (stoppingRenderWatch ? 1 : 0) +
            (capturingCheckpoint ? 1 : 0) +
            [...runningCleanups.values()].reduce(
              (sum, values) => sum + values.size,
              0,
            ) +
            pendingFrameFinalizers.size +
            [...installations.values()].filter(
              (record) => record.state === 'installing',
            ).length +
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
            (documentRetirement ? 1 : 0) +
            projection.memoryUnits +
            checkpointAuthorityCallbackDepth +
            controlledFrameKeys.size +
            pendingFrameFinalizers.size +
            installations.size +
            [...pendingComponentCleanups.values()].reduce(
              (sum, records) => sum + records.size,
              0,
            ) +
            [...cleanupFailures.values()].reduce(
              (sum, resources) =>
                sum +
                resources.size +
                [...resources.values()].reduce(
                  (count, causes) => count + causes.size,
                  0,
                ),
              0,
            ) +
            (renderWatchHandle ? 1 : 0) +
            (renderWatchCleanupFailure ? 1 : 0) +
            (retained ? 1 : 0) +
            (checkpoint ? 1 + checkpoint.retainedCollectionEntries : 0) +
            (preparedCheckpoint
              ? 3 + preparedCheckpoint.record.retainedCollectionEntries
              : 0) +
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
  const disposeOnUnmount = (
    componentActions: readonly MarkdownRendererCleanupAction[] = [],
    releaseActions: readonly MarkdownRendererCleanupAction[] = [],
  ) => {
    retireCheckpointAuthority('unmount')
    disposed = true
    if (disposingOnUnmount) return
    disposingOnUnmount = true
    generation += 1
    try {
      registerComponentCleanups(componentActions)
      runCleanupBatch([
        {
          phase: 'document-retirement-release',
          resource: documentRetirement?.handle,
          run: releaseDocumentRetirement,
        },
        ...[...timers].map((timer) => ({
          phase: 'timer-clear',
          resource: timer,
          run: () => clearTimer(timer),
        })),
        { phase: 'owned-frames', resource: frames, run: cancelFrames },
        ...[...listeners].map((remove) => ({
          phase: 'abort-listener-remove',
          resource: remove,
          run: remove,
        })),
        {
          phase: 'render-watch-stop',
          resource: renderWatchHandle,
          run: stopRenderWatch,
        },
        ...componentCleanupActions(),
      ])
      // Release view references only after every selected native cleanup returned.
      if (
        timers.size > 0 ||
        frames.size > 0 ||
        scheduledFrames.size > 0 ||
        pendingFrameFinalizers.size > 0 ||
        controlledFrameKeys.size > 0 ||
        listeners.size > 0 ||
        installingListeners.size > 0 ||
        installations.size > 0 ||
        pendingComponentCleanups.size > 0 ||
        documentRetirement !== null ||
        documentRetirementUnknown ||
        options.readComponentCleanupPending() > 0 ||
        renderWatchHandle !== null
      )
        throw new Error('markdown-renderer-unmount-cleanup-pending')
      runCleanupBatch(releaseActions)
      retained = null
    } finally {
      disposingOnUnmount = false
    }
    // Promises remain in the census until their real finally blocks settle.
  }
  return Object.freeze({
    afterFrame,
    bindDocumentAuthorityReceiver,
    bindRenderWatchHandle,
    beginInstallation,
    beginRender,
    captureLastValidRender,
    captureRendererOwnedCheckpoint,
    prepareRendererOwnedCheckpoint,
    validatePreparedRendererOwnedCheckpoint,
    publishPreparedRendererOwnedCheckpoint,
    cancelPreparedRendererOwnedCheckpoint,
    retireCheckpointAuthority,
    runCheckpointAuthorityCallback,
    onCheckpointActivated: () => {
      retireCheckpointAuthority('activation')
      checkpointDeactivated = false
    },
    onCheckpointDeactivated: () => {
      retireCheckpointAuthority('deactivation')
      checkpointDeactivated = true
    },
    sealPreparedRendererOwnedCheckpoint,
    hasSealedRendererOwnedCheckpointCustody,
    publishSealedRendererOwnedCheckpoint,
    clearTimer,
    cleanupComponentResources,
    disposeOnUnmount,
    inspectOwnedResources,
    isDisposed: () => disposed,
    invalidate: () =>
      runCheckpointAuthorityCallback('source-invalidation', () => {
        retireCheckpointAuthority('source-invalidation')
        generation += 1
        cancelFrames()
        captureLastValidRender()
      }),
    isCurrent,
    listenForAbort,
    participant,
    readRetainedRender,
    retainLastValidRender,
    scheduleFrame,
    setTimer,
    trackJob,
    finalizeRenderJob,
  })
}
