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
  FsusRenderPipelineAuthority,
  useFsusVirtualWindow,
} from '../../../hooks/use-render-pipeline'
import type {
  MarkdownHeavyFeatureResourceInspection,
  MarkdownHeavyFeatureDocumentAuthority,
  MarkdownHeavyFeatureDocumentAuthorityRetirementHandle,
  MarkdownHeavyFeatureDocumentAuthorityTicket,
} from '../../../hooks/use-markdown-heavy-feature-lifecycle'
import type {
  MarkdownEditorFrameScheduler,
  MarkdownEditorFrameTask,
} from '../../../hooks/use-markdown-editor-frame-scheduler'
import type { WatchHandle } from 'vue'
import { customRef } from 'vue'

const rendererInputNativePromise = Promise
const rendererInputNativePromisePrototype = Promise.prototype
const rendererInputNativeThen = Promise.prototype.then
const rendererInputNativeAll = Promise.all
const rendererOwnedTimerNow =
  typeof performance === 'undefined'
    ? Date.now
    : performance.now.bind(performance)
const rendererInputNativeApply = Reflect.apply
const rendererInputNativeSpecies = Object.getOwnPropertyDescriptor(
  Promise,
  Symbol.species,
)?.get

/** Custody of a private input publication only, never of foreign mutable state. */
export interface MarkdownRendererOwnedInputAuthority {
  issueTicket(): object | null
  isCurrent(ticket: unknown): boolean
  subscribe(listener: () => void): () => void
  getFailures(): readonly unknown[]
}

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

/** Original issuers, supplied by the owning renderer after both hooks exist. */
export interface MarkdownRendererCheckpointSealSources {
  readonly pipeline: FsusRenderPipelineAuthority
  readonly viewport: FsusRenderPipelineAuthority
}

/** Source continuity on the exact owned checkpoint; never full-host readiness. */
export interface MarkdownRendererSealedCheckpointPublication extends MarkdownRendererCheckpointPublication {
  readonly seal: Readonly<{
    scope: 'renderer-checkpoint-source-custody'
    checkpointRef: string
  }>
}

/** Exact methods of one original renderer; tokens remain identity-checked. */
export interface MarkdownRendererCheckpointHandle {
  readonly prepareRendererOwnedCheckpoint: () => MarkdownRendererCheckpointPreparation | null
  readonly sealPreparedRendererOwnedCheckpoint: (
    preparation: MarkdownRendererCheckpointPreparation,
  ) => MarkdownRendererSealedCheckpointPublication | null
  readonly hasSealedRendererOwnedCheckpointCustody: (
    publication: MarkdownRendererSealedCheckpointPublication,
  ) => boolean
  readonly publishSealedRendererOwnedCheckpoint: (
    publication: MarkdownRendererSealedCheckpointPublication,
  ) => MarkdownRendererOwnedCheckpoint | null
  readonly cancelPreparedRendererOwnedCheckpoint: (
    preparation: MarkdownRendererCheckpointPreparation,
  ) => boolean
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

/** Recipe of the original setup scope, never a new component or watch realm. */
export interface MarkdownRendererRenderWatchSource {
  readonly readSource: () => readonly unknown[]
  readonly create: (immediate: boolean) => WatchHandle
}

/** Measured component handles only; never an admitted whole renderer census. */
export interface MarkdownRendererOwnedHandleInspection {
  readonly scope: 'renderer-component-owned-handles'
  readonly complete: false
  readonly measuredUsageOnly: true
  readonly usage: MarkdownEditorSessionResourceInspection['usage']
  readonly retainedListeners: number
  readonly watchPaused: boolean
  readonly watchAdmissionClosed: boolean
  readonly watchControlInProgress: boolean
  readonly rearmingWatch: boolean
  readonly pendingJobSettlements: number
  readonly pendingFrameFinalizers: number
  readonly unknownInstallations: number
  readonly nativeEffectCensus: 'unknown'
}

export interface MarkdownRendererOwnedHandleControl {
  readonly inspect: () => MarkdownRendererOwnedHandleInspection
  readonly pauseRenderWatch: () => void
  readonly resumeRenderWatch: () => void
  readonly waitForSelectedOwnedJobs: () => Promise<void>
  readonly pauseOwnedHandles: () => MarkdownRendererOwnedHandleInspection
  readonly resumeOwnedHandles: () => MarkdownRendererOwnedHandleInspection
  readonly disposeOwnedHandles: () => void
}

/** Stable original owner token; native ids may change after actual rearming. */
export interface MarkdownRendererOwnedTimer {
  readonly scope: 'renderer-owned-timer'
}

/** A partial measurement and real controls do not admit a complete participant. */
export class MarkdownRendererResourceControlUnsupportedError extends Error {
  readonly unsupported: readonly string[]
  readonly measured: MarkdownRendererOwnedHandleInspection

  constructor(
    unsupported: readonly string[],
    measured: MarkdownRendererOwnedHandleInspection,
  ) {
    super(
      `markdown-renderer-resource-control-unsupported:${unsupported.join(',')}`,
    )
    this.name = 'MarkdownRendererResourceControlUnsupportedError'
    this.unsupported = Object.freeze([...unsupported])
    this.measured = measured
  }
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
  readonly pauseRelatedResources?: () => readonly MarkdownRendererCleanupAction[]
  readonly resumeRelatedResources?: () => readonly MarkdownRendererCleanupAction[]
  readonly recreateCurrentFrames?: () => void
}) => {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  type TimerActivation = {
    handle: ReturnType<typeof setTimeout> | undefined
    fired: boolean
    canceled: boolean
  }
  type TimerRecord = {
    readonly token: MarkdownRendererOwnedTimer
    readonly run: () => void
    remaining: number
    deadline: number
    activation: TimerActivation | null
    retiring: boolean
    clearing: boolean
    clearReentered: boolean
    clearCause: unknown
  }
  const timerRecords = new Map<MarkdownRendererOwnedTimer, TimerRecord>()
  type AbortBinding = {
    readonly signal: AbortSignal
    readonly run: () => void
    readonly abort: () => void
    readonly remove: () => void
    attached: boolean
    suspended: boolean
    retired: boolean
    retireRequested: boolean
    unknown: boolean
    registering: boolean
    removing: boolean
    removeReentered: boolean
    removeCause: unknown
  }
  const abortBindings = new Map<() => void, AbortBinding>()
  let controllingOwnedHandles = false
  let rendererDisposer: (() => void) | null = null
  const frames = new Map<number, () => void>()
  const scheduledFrames = new Map<string, () => void>()
  const jobs = new Set<symbol>()
  const jobSettlements = new Map<
    symbol,
    { readonly promise: Promise<void>; readonly resolve: () => void }
  >()
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
  type DocumentRetirementBinding = {
    readonly source: MarkdownHeavyFeatureDocumentAuthority
    readonly handle: MarkdownHeavyFeatureDocumentAuthorityRetirementHandle
  }
  let documentRetirement: DocumentRetirementBinding | null = null
  let documentRetirementUnknown = false
  let bindingDocumentRetirement = false
  type SealSourceRegistration = {
    readonly role: 'pipeline' | 'viewport'
    readonly source: FsusRenderPipelineAuthority
    unsubscribe: (() => void) | null
    registering: boolean
    releasing: boolean
    releaseReentered: boolean
    releaseCause: unknown
    released: boolean
  }
  const checkpointSealSources = new Map<
    'pipeline' | 'viewport',
    SealSourceRegistration
  >()
  let bindingCheckpointSealSources = false
  let sealingCheckpoint = false
  const inputPublications = new Map<
    string,
    {
      retire: () => void
      inspect: () => {
        readonly scope: string
        readonly value: unknown
        readonly published: boolean
        readonly closed: boolean
        readonly retainedListeners: number
        readonly retainedTicket: boolean
        readonly nativeDocumentTicket: MarkdownHeavyFeatureDocumentAuthorityTicket | null
        readonly retainedSnapshotEntries: number
        readonly failures: readonly unknown[]
        readonly unavailableCallbackResults: readonly unknown[]
        readonly releaseObligations: number
        readonly pendingAsyncObservers: number
        readonly asyncObservations: readonly unknown[]
        readonly failureRecords: readonly unknown[]
      }
      close: () => void
      releaseSubscriptions: () => void
      hasReleaseObligations: () => boolean
    }
  >()
  let notifyingInputRetirement = false
  const retireCheckpointAuthority = (reason: string) => {
    // Same producer's private retirement version, not a document/pipeline ticket.
    if (checkpointAuthorityGeneration === Number.MAX_SAFE_INTEGER)
      checkpointAuthorityOverflowed = true
    else checkpointAuthorityGeneration += 1
    lastCheckpointAuthorityRetirement = reason
    // A dependent receiver can reenter this owner. Its nested retirement still
    // changes the private version, but never recursively invokes the same feed.
    if (!notifyingInputRetirement) {
      notifyingInputRetirement = true
      try {
        for (const publication of inputPublications.values())
          publication.retire()
      } finally {
        notifyingInputRetirement = false
      }
    }
  }
  const runCheckpointAuthorityCallback = <T>(
    reason: string,
    run: () => T,
    resource: unknown = run,
    failurePhase = `checkpoint-callback:${reason}`,
  ): T => {
    checkpointAuthorityCallbackDepth += 1
    try {
      // Input retirement invokes real foreign receivers. Include the pre-write
      // notifications in the same depth/catch/finally boundary.
      retireCheckpointAuthority(reason)
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
  const createOwnedInputPublication = <T>(scope: string, initial: T) => {
    if (disposed || inputPublications.has(scope))
      throw new Error('markdown-renderer-input-publication-unavailable')
    let currentValue = initial
    let triggerInput!: () => void
    const readInput = () => currentValue
    const refuseInputWrite = () => {
      throw new TypeError('markdown-renderer-owned-input-readonly')
    }
    let trackedReadInput = readInput
    const input = customRef<T>((track, trigger) => {
      triggerInput = trigger
      trackedReadInput = () => {
        track()
        return currentValue
      }
      return { get: trackedReadInput, set: refuseInputWrite }
    })
    // The installed Vue customRef getter writes its public _value cache. Use
    // the same factory getter as an own accessor before freezing the real ref.
    // toRaw returns this sealed ref, never a writable backing ref or store.
    Object.defineProperty(input, 'value', {
      get: trackedReadInput,
      set: refuseInputWrite,
      enumerable: true,
    })
    Object.freeze(input)
    type Registration = {
      readonly id: symbol
      readonly listener: () => void
      quarantined: boolean
      releasing: boolean
      releaseReentered: boolean
      releaseReentryCause: unknown
      releaseRequested: boolean
      failureCause: unknown
      notificationFailed: boolean
    }
    type Observation = {
      readonly source: object
      readonly registration: Registration
      state: 'pending' | 'fulfilled' | 'rejected' | 'unavailable'
      rejected: boolean
      cause: unknown
      processingFailure: unknown
      derived: Promise<unknown> | null
      observerTask: Promise<void> | null
      observerSettled: boolean
    }
    const registrations = new Set<Registration>()
    const failures: unknown[] = []
    const failureRecords: Array<{
      readonly registration: Registration | null
      readonly source: unknown
      readonly phase: string
      readonly cause: unknown
    }> = []
    const unavailableCallbackResults: unknown[] = []
    const asyncObservations = new Set<Observation>()
    let closed = false
    let published = true
    let ticket: object | null = null
    let nativeDocumentTicket: MarkdownHeavyFeatureDocumentAuthorityTicket | null =
      null
    let nativeDocumentBinding: typeof documentRetirement = null
    let ticketGeneration = -1
    let allocatingTicket = false
    const eligible = () =>
      !closed &&
      published &&
      !disposed &&
      !checkpointDeactivated &&
      !checkpointAuthorityOverflowed &&
      checkpointAuthorityCallbackDepth === 0 &&
      !notifyingInputRetirement &&
      failures.length === 0 &&
      cleanupFailures.size === 0 &&
      unavailableCallbackResults.length === 0 &&
      asyncObservations.size === 0
    const hasNativeDocumentCustody = (
      binding: typeof documentRetirement,
      captured: MarkdownHeavyFeatureDocumentAuthorityTicket | null,
    ) => {
      if (
        documentRetirementUnknown ||
        bindingDocumentRetirement ||
        documentRetirement !== binding
      )
        return false
      if (!binding) return captured === null
      // Only the accepted original f253 pure methods are borrowed. No Native
      // ticket is minted here and no handle failureCause becomes getFailures.
      return (
        captured !== null &&
        binding.handle.hasCustody() &&
        binding.source.hasCustody(captured)
      )
    }
    const recordFailure = (
      cause: unknown,
      registration: Registration | null,
      source: unknown,
      phase: string,
    ) => {
      failures.push(cause)
      failureRecords.push({ registration, source, phase, cause })
      if (registration) registration.failureCause = cause
    }
    const observeCallbackResult = (
      source: object,
      registration: Registration,
    ) => {
      const observation: Observation = {
        source,
        registration,
        state: 'unavailable',
        rejected: false,
        cause: undefined,
        processingFailure: undefined,
        derived: null,
        observerTask: null,
        observerSettled: false,
      }
      asyncObservations.add(observation)
      try {
        const ownConstructor = Object.getOwnPropertyDescriptor(
          source,
          'constructor',
        )
        const prototypeConstructor = Object.getOwnPropertyDescriptor(
          rendererInputNativePromisePrototype,
          'constructor',
        )
        const species = Object.getOwnPropertyDescriptor(
          rendererInputNativePromise,
          Symbol.species,
        )
        if (
          Object.getPrototypeOf(source) !==
            rendererInputNativePromisePrototype ||
          (ownConstructor &&
            (!('value' in ownConstructor) ||
              ownConstructor.value !== rendererInputNativePromise)) ||
          !prototypeConstructor ||
          !('value' in prototypeConstructor) ||
          prototypeConstructor.value !== rendererInputNativePromise ||
          !rendererInputNativeSpecies ||
          species?.get !== rendererInputNativeSpecies
        ) {
          unavailableCallbackResults.push(source)
          return
        }
        // The captured intrinsic checks the actual Promise brand before any
        // species allocation. Unsupported proxies/impostors cannot start a
        // foreign then chain. Only the unchanged native species is permitted.
        observation.state = 'pending'
        observation.derived = rendererInputNativeApply(
          rendererInputNativeThen,
          source,
          [
            () => {
              observation.state = 'fulfilled'
            },
            (cause: unknown) => {
              observation.rejected = true
              observation.cause = cause
              observation.state = 'rejected'
            },
          ],
        )
        const derived = observation.derived
        // This derived native Promise has real rejection handling too. The
        // observer never starts a .catch/species chain or lets its own callback
        // failure escape as another unobserved rejection.
        observation.observerTask = (async () => {
          let derivedRejected = false
          let derivedCause: unknown
          try {
            await derived
          } catch (cause) {
            derivedRejected = true
            derivedCause = cause
          }
          try {
            runCheckpointAuthorityCallback(
              'input-async-observation',
              () => {
                if (observation.rejected)
                  recordFailure(
                    observation.cause,
                    registration,
                    source,
                    'async-receiver-rejection',
                  )
                if (derivedRejected)
                  recordFailure(
                    derivedCause,
                    registration,
                    derived,
                    'async-observer-rejection',
                  )
              },
              observation,
            )
          } catch (cause) {
            // The original owner ledger already holds this processing cause.
            observation.processingFailure = cause
          } finally {
            observation.observerSettled = true
          }
        })()
      } catch (cause) {
        observation.state = 'unavailable'
        observation.processingFailure = cause
        unavailableCallbackResults.push(source)
        recordFailure(cause, registration, source, 'async-observation-install')
      }
    }
    const notifyRegistration = (registration: Registration) => {
      registration.notificationFailed = false
      try {
        const result: unknown = registration.listener()
        if (
          result !== null &&
          (typeof result === 'object' || typeof result === 'function')
        ) {
          registration.quarantined = true
          observeCallbackResult(result, registration)
          return false
        }
        registration.quarantined = false
        return true
      } catch (cause) {
        registration.notificationFailed = true
        registration.quarantined = true
        recordFailure(
          cause,
          registration,
          registration.listener,
          'receiver-notification',
        )
        return false
      }
    }
    const hasPendingObservation = (registration: Registration) =>
      [...asyncObservations].some(
        (record) =>
          record.registration === registration &&
          (record.state === 'unavailable' || !record.observerSettled),
      )
    const releaseRegistration = (registration: Registration) => {
      if (!registrations.has(registration)) return
      if (registration.releasing) {
        const cause = new Error('markdown-renderer-input-release-in-progress')
        // The receiver may catch this exception. Keep the actual failed attempt
        // independently of its eventual normal return so it cannot detach itself.
        if (!registration.releaseReentered) {
          registration.releaseReentered = true
          registration.releaseReentryCause = cause
        }
        registration.quarantined = true
        recordFailure(
          cause,
          registration,
          registration.listener,
          'receiver-release-reentry',
        )
        throw cause
      }
      registration.releaseReentered = false
      registration.releaseReentryCause = undefined
      registration.releasing = true
      registration.releaseRequested = true
      try {
        runCheckpointAuthorityCallback(
          'input-unsubscribe',
          () => {
            if (hasPendingObservation(registration))
              throw new Error(
                'markdown-renderer-input-observer-release-pending',
              )
            // This is an actual retry of the selected receiver, not deletion of
            // its quarantine flag or a fabricated release acknowledgment.
            const notified = notifyRegistration(registration)
            if (registration.releaseReentered) {
              registration.quarantined = true
              throw registration.releaseReentryCause
            }
            if (!notified) {
              if (registration.notificationFailed)
                throw registration.failureCause
              throw new Error(
                'markdown-renderer-input-receiver-release-unavailable',
              )
            }
            if (hasPendingObservation(registration))
              throw new Error(
                'markdown-renderer-input-observer-release-pending',
              )
            registrations.delete(registration)
            registration.releaseRequested = false
            // Clear only this real release obligation after the selected receiver
            // returned synchronously and every supported observation settled.
            // Failure history and unsupported result records remain retained.
            const pending = cleanupFailures.get(
              'renderer-input-listener-release',
            )
            pending?.delete(registration)
            if (pending?.size === 0)
              cleanupFailures.delete('renderer-input-listener-release')
          },
          registration,
          'renderer-input-listener-release',
        )
      } finally {
        registration.releasing = false
      }
    }
    const retire = () => {
      ticket = null
      nativeDocumentTicket = null
      nativeDocumentBinding = null
      for (const registration of [...registrations]) {
        if (
          !registrations.has(registration) ||
          registration.quarantined ||
          registration.releasing
        )
          continue
        notifyRegistration(registration)
      }
    }
    const authority: MarkdownRendererOwnedInputAuthority = Object.freeze({
      issueTicket: () => {
        if (allocatingTicket || !eligible()) return null
        if (!ticket || ticketGeneration !== checkpointAuthorityGeneration) {
          const capturedGeneration = checkpointAuthorityGeneration
          const capturedValue = currentValue
          const capturedBinding = documentRetirement
          const capturedSource = capturedBinding?.source
          allocatingTicket = true
          try {
            const capturedNative = capturedSource?.capture() ?? null
            if (capturedBinding && capturedNative === null) return null
            const candidate = Object.freeze({
              scope,
              value: capturedValue,
              nativeDocumentAuthority: capturedNative,
            })
            // Validate the actual original ticket after every allocation, then
            // repeat private guards last in case the borrowed call reentered.
            const nativeCurrent = hasNativeDocumentCustody(
              capturedBinding,
              capturedNative,
            )
            if (
              !nativeCurrent ||
              !eligible() ||
              checkpointAuthorityGeneration !== capturedGeneration ||
              currentValue !== capturedValue
            )
              return null
            ticket = candidate
            ticketGeneration = capturedGeneration
            nativeDocumentTicket = capturedNative
            nativeDocumentBinding = capturedBinding
          } catch (cause) {
            recordFailure(
              cause,
              null,
              capturedSource,
              'native-document-ticket-capture',
            )
            throw cause
          } finally {
            allocatingTicket = false
          }
        }
        // A cached pin never reacquires Native custody. Loss returns null until
        // a real owner retirement/replacement creates a new guarded candidate.
        return hasNativeDocumentCustody(
          nativeDocumentBinding,
          nativeDocumentTicket,
        )
          ? ticket
          : null
      },
      // Pure private guards and the original Native pure custody checks only;
      // no Vue reads, capture/reacquisition, callback or publication.
      isCurrent: (value: unknown) =>
        eligible() &&
        !allocatingTicket &&
        ticket !== null &&
        value === ticket &&
        ticketGeneration === checkpointAuthorityGeneration &&
        hasNativeDocumentCustody(nativeDocumentBinding, nativeDocumentTicket),
      getFailures: () => Object.freeze([...failures]),
      subscribe: (listener: () => void) =>
        runCheckpointAuthorityCallback('input-subscribe', () => {
          if (closed || disposed)
            throw new Error('markdown-renderer-input-publication-closed')
          if (typeof listener !== 'function')
            throw new TypeError('markdown-renderer-input-listener-invalid')
          const registration: Registration = {
            id: Symbol('markdown-renderer-input-subscription'),
            listener,
            quarantined: false,
            releasing: false,
            releaseReentered: false,
            releaseReentryCause: undefined,
            releaseRequested: false,
            failureCause: undefined,
            notificationFailed: false,
          }
          if (closed || disposed)
            throw new Error('markdown-renderer-input-publication-closed')
          registrations.add(registration)
          return () => releaseRegistration(registration)
        }),
    })
    const replace = (value: T, isPublication = true) =>
      runCheckpointAuthorityCallback(
        'input-replacement',
        () => {
          if (isPublication && (closed || disposed))
            throw new Error('markdown-renderer-input-publication-closed')
          // Only these private closure cells are writable. Set publication
          // state before notifying Vue so a nested clear cannot be undone.
          currentValue = value
          published = isPublication
          try {
            triggerInput()
          } catch (cause) {
            published = false
            recordFailure(cause, null, input, 'input-trigger')
            throw cause
          }
        },
        input,
      )
    inputPublications.set(scope, {
      retire,
      releaseSubscriptions: () =>
        runCleanupBatch(
          [...registrations].map((registration) => ({
            phase: 'renderer-input-listener-release',
            resource: registration,
            run: () => releaseRegistration(registration),
          })),
        ),
      hasReleaseObligations: () =>
        registrations.size > 0 ||
        [...asyncObservations].some(
          (record) => record.state === 'unavailable' || !record.observerSettled,
        ),
      close: () => {
        closed = true
        // Ordinary unmount already retired every receiver before this private
        // terminal flag. Closing cannot recursively notify during disposal.
        ticket = null
        nativeDocumentTicket = null
        nativeDocumentBinding = null
      },
      inspect: () =>
        Object.freeze({
          scope,
          value: currentValue,
          published,
          closed,
          retainedListeners: registrations.size,
          retainedTicket: ticket !== null,
          nativeDocumentTicket,
          retainedSnapshotEntries:
            typeof currentValue === 'object' && currentValue !== null
              ? Object.keys(currentValue).length
              : 0,
          failures: Object.freeze([...failures]),
          unavailableCallbackResults: Object.freeze([
            ...unavailableCallbackResults,
          ]),
          releaseObligations: [...registrations].filter(
            (record) => record.quarantined || record.releaseRequested,
          ).length,
          pendingAsyncObservers: [...asyncObservations].filter(
            (record) => record.observerTask !== null && !record.observerSettled,
          ).length,
          asyncObservations: Object.freeze(
            [...asyncObservations].map(({ registration, ...record }) =>
              Object.freeze({
                ...record,
                subscriptionRef: registration.id,
                listener: registration.listener,
              }),
            ),
          ),
          failureRecords: Object.freeze(
            failureRecords.map(({ registration, ...record }) =>
              Object.freeze({
                ...record,
                subscriptionRef: registration?.id ?? null,
              }),
            ),
          ),
        }),
    })
    return Object.freeze({
      input,
      authority,
      replace,
      // Clear the publication with the caller's actual empty input; the ref and
      // any registration/failure records remain real retained resources.
      clear: (empty: T) => replace(empty, false),
      retire: () => retireCheckpointAuthority(`input-retirement:${scope}`),
    })
  }
  let sequence = 0
  let checkpointSequence = 0
  let capturingCheckpoint = false
  let renderWatchHandle: WatchHandle | null = null
  let renderWatchSource: MarkdownRendererRenderWatchSource | null = null
  let renderWatchPaused = false
  let controllingRenderWatch = false
  let rearmingRenderWatch = false
  let pausedRenderWatchSource: readonly unknown[] | null = null
  let pausedRenderWatchDocument: Readonly<{
    source: MarkdownHeavyFeatureDocumentAuthority
    ticket: MarkdownHeavyFeatureDocumentAuthorityTicket
  }> | null = null
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
  type PreparedCheckpointRecord = {
    readonly record: CheckpointRecord
    readonly base: CheckpointRecord | null
    readonly generation: number
    readonly authorityGeneration: number
    readonly preparation: MarkdownRendererCheckpointPreparation
    readonly publication: MarkdownRendererCheckpointPublication
    validated: boolean
  }
  let preparedCheckpoint: PreparedCheckpointRecord | null = null
  type CheckpointSeal = {
    readonly candidate: PreparedCheckpointRecord
    readonly publication: MarkdownRendererSealedCheckpointPublication
    readonly nativeBinding: DocumentRetirementBinding
    readonly nativeTicket: MarkdownHeavyFeatureDocumentAuthorityTicket
    readonly pipelineBinding: SealSourceRegistration
    readonly pipelineTicket: object
    readonly viewportBinding: SealSourceRegistration
    readonly viewportTicket: object
    readonly authorityGeneration: number
  }
  let preparedCheckpointSeal: CheckpointSeal | null = null
  let publishedCheckpointSeal: CheckpointSeal | null = null

  const recordInstallation = (phase: string) => {
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
  const beginInstallation = (phase: string) => {
    if (renderWatchPaused)
      throw new Error('markdown-renderer-resource-admission-paused')
    return recordInstallation(phase)
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
  const releaseCheckpointSealSource = (record: SealSourceRegistration) => {
    if (record.released) return
    if (record.releasing) {
      const cause = new Error(
        'markdown-renderer-seal-source-release-in-progress',
      )
      record.releaseReentered = true
      record.releaseCause = cause
      throw cause
    }
    record.releasing = true
    record.releaseReentered = false
    try {
      runCheckpointAuthorityCallback(
        'checkpoint-source-release',
        () => {
          if (record.registering || !record.unsubscribe)
            throw new Error('markdown-renderer-seal-source-release-unavailable')
          record.unsubscribe()
          if (record.releaseReentered) throw record.releaseCause
          record.released = true
          if (checkpointSealSources.get(record.role) === record)
            checkpointSealSources.delete(record.role)
        },
        record,
        'checkpoint-seal-source-release',
      )
    } finally {
      record.releasing = false
    }
  }
  const bindCheckpointSealSources = (
    sources: MarkdownRendererCheckpointSealSources,
  ) =>
    runCheckpointAuthorityCallback('checkpoint-source-bind', () => {
      if (disposed || bindingCheckpointSealSources)
        throw new Error('markdown-renderer-seal-source-binding-unavailable')
      bindingCheckpointSealSources = true
      try {
        for (const role of ['pipeline', 'viewport'] as const) {
          const source = sources[role]
          const existing = checkpointSealSources.get(role)
          if (existing) {
            if (
              existing.source !== source ||
              existing.registering ||
              !existing.unsubscribe ||
              existing.released
            )
              throw new Error(
                `markdown-renderer-seal-source-binding-retained:${role}`,
              )
            continue
          }
          const installation = beginInstallation(
            `checkpoint-${role}-retirement-registration`,
          )
          const record: SealSourceRegistration = {
            role,
            source,
            unsubscribe: null,
            registering: true,
            releasing: false,
            releaseReentered: false,
            releaseCause: undefined,
            released: false,
          }
          checkpointSealSources.set(role, record)
          let known = false
          try {
            record.unsubscribe = source.subscribe(() =>
              retireCheckpointAuthority(`checkpoint-${role}-source-retirement`),
            )
            if (typeof record.unsubscribe !== 'function')
              throw new TypeError(
                `markdown-renderer-seal-source-release-handle-invalid:${role}`,
              )
            known = true
            record.registering = false
            if (disposed) releaseCheckpointSealSource(record)
          } catch (cause) {
            record.releaseCause = cause
            if (!known) installation.fail(cause)
            throw cause
          } finally {
            record.registering = false
            if (known) installation.complete()
          }
        }
      } finally {
        bindingCheckpointSealSources = false
      }
    })
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
    if (disposed || renderWatchPaused) stopRenderWatch()
  }
  const bindRenderWatchSource = (source: MarkdownRendererRenderWatchSource) => {
    if (disposed || (renderWatchSource && renderWatchSource !== source))
      throw new Error('markdown-renderer-render-watch-source-unavailable')
    renderWatchSource = source
  }
  const installRenderWatch = (immediate: boolean) => {
    if (!renderWatchSource || disposed || renderWatchHandle)
      throw new Error('markdown-renderer-render-watch-install-unavailable')
    const installation = recordInstallation('render-watch')
    let known = false
    try {
      const handle = renderWatchSource.create(immediate)
      renderWatchHandle = handle
      if (typeof handle?.stop !== 'function')
        throw new Error('markdown-renderer-render-watch-handle-invalid')
      known = true
      if (disposed || (renderWatchPaused && !rearmingRenderWatch))
        stopRenderWatch()
      return handle
    } catch (cause) {
      if (!known) installation.fail(cause)
      throw cause
    } finally {
      if (known) installation.complete()
    }
  }
  const pauseRenderWatch = () => {
    const watchSource = renderWatchSource
    if (disposed || controllingRenderWatch || !watchSource)
      throw new Error('markdown-renderer-render-watch-control-unavailable')
    // Source capture and watch detach share the real admission fence. The
    // composite controller separately cancels/rearms its other owned handles.
    controllingRenderWatch = true
    // Close before original retirement/source callbacks can admit fresh work.
    if (!renderWatchPaused) {
      renderWatchPaused = true
      generation += 1
    }
    try {
      runCheckpointAuthorityCallback('render-watch-pause', () => {
        if (!pausedRenderWatchSource) {
          const source = Object.freeze([...watchSource.readSource()])
          const nativeSource = documentRetirement?.source ?? null
          const ticket = nativeSource?.capture() ?? null
          pausedRenderWatchSource = source
          pausedRenderWatchDocument =
            nativeSource && ticket ? { source: nativeSource, ticket } : null
        }
        stopRenderWatch()
      })
    } finally {
      controllingRenderWatch = false
    }
  }
  const resumeRenderWatch = () => {
    if (disposed || controllingRenderWatch || !renderWatchSource)
      throw new Error('markdown-renderer-render-watch-control-unavailable')
    if (!renderWatchPaused) return
    if (
      timerRecords.size ||
      [...abortBindings.values()].some((record) => record.suspended) ||
      jobs.size ||
      installations.size
    )
      throw new Error(
        'markdown-renderer-watch-resume-composite-control-required',
      )
    const source = renderWatchSource
    const selected = pausedRenderWatchSource
    const native = pausedRenderWatchDocument
    if (!selected || !native)
      throw new Error(
        'markdown-renderer-watch-resume-native-source-unsupported',
      )
    controllingRenderWatch = true
    const hasSource = () => {
      const current = source.readSource()
      return (
        current.length === selected.length &&
        current.every((value, index) => Object.is(value, selected[index])) &&
        options.readDocumentAuthority() === native.source &&
        native.source.hasCustody(native.ticket)
      )
    }
    try {
      runCheckpointAuthorityCallback('render-watch-resume', () => {
        if (!hasSource())
          throw new Error('markdown-renderer-watch-resume-source-stale')
        rearmingRenderWatch = true
        try {
          installRenderWatch(false)
          if (disposed || renderWatchSource !== source || !hasSource())
            throw new Error('markdown-renderer-watch-resume-source-stale')
        } catch (cause) {
          runCleanupBatch([
            {
              phase: 'render-watch-resume-failure',
              resource: source,
              run: () => {
                throw cause
              },
            },
            {
              phase: 'render-watch-resume-stop',
              resource: renderWatchHandle,
              run: stopRenderWatch,
            },
          ])
          throw cause
        } finally {
          rearmingRenderWatch = false
        }
        renderWatchPaused = false
        pausedRenderWatchSource = null
        pausedRenderWatchDocument = null
      })
    } finally {
      controllingRenderWatch = false
    }
  }
  const beginRender = (): MarkdownRendererRenderGeneration =>
    runCheckpointAuthorityCallback(
      'render-admission',
      () => {
        if (renderWatchPaused)
          throw new Error('markdown-renderer-resource-admission-paused')
        return Object.freeze({
          ...readDocumentState(),
          generation: ++generation,
        })
      },
      readDocumentState,
    )
  const isCurrent = (token: MarkdownRendererRenderGeneration) =>
    runCheckpointAuthorityCallback(
      'current-document-read',
      () => {
        const current = options.readDocumentState()
        return (
          !disposed &&
          !renderWatchPaused &&
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
        renderWatchPaused ||
        capturingCheckpoint ||
        sealingCheckpoint ||
        bindingCheckpointSealSources ||
        notifyingInputRetirement ||
        checkpointAuthorityCallbackDepth > 0 ||
        runningCleanups.size > 0 ||
        preparedCheckpoint !== null ||
        stoppingRenderWatch ||
        jobs.size > 0 ||
        timers.size > 0 ||
        timerRecords.size > 0 ||
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
      !sealingCheckpoint &&
      !bindingCheckpointSealSources &&
      !notifyingInputRetirement &&
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
    preparedCheckpointSeal = null
    publishedCheckpointSeal = null
    preparedCheckpoint = null
    return checkpoint.capture
  }
  const cancelPreparedRendererOwnedCheckpoint = (
    preparation: MarkdownRendererCheckpointPreparation,
  ) => {
    const candidate = preparedCheckpoint
    if (!candidate || candidate.preparation !== preparation) return false
    if (preparedCheckpointSeal?.candidate === candidate)
      preparedCheckpointSeal = null
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
  const hasPrivateCheckpointSealCustody = (
    seal: CheckpointSeal,
    duringSeal = false,
  ) => {
    const candidate = seal.candidate
    return (
      !disposed &&
      !capturingCheckpoint &&
      (!sealingCheckpoint || duringSeal) &&
      !bindingCheckpointSealSources &&
      !bindingDocumentRetirement &&
      !documentRetirementUnknown &&
      !notifyingInputRetirement &&
      checkpointAuthorityCallbackDepth === 0 &&
      !checkpointDeactivated &&
      !checkpointAuthorityOverflowed &&
      cleanupFailures.size === 0 &&
      renderWatchCleanupFailure === null &&
      !stoppingRenderWatch &&
      runningCleanups.size === 0 &&
      generation === candidate.generation &&
      checkpointAuthorityGeneration === seal.authorityGeneration &&
      retained === candidate.record.render &&
      jobs.size === 0 &&
      timers.size === 0 &&
      frames.size === 0 &&
      scheduledFrames.size === 0 &&
      pendingFrameFinalizers.size === 0 &&
      controlledFrameKeys.size === 0 &&
      installations.size === 0 &&
      pendingComponentCleanups.size === 0 &&
      documentRetirement === seal.nativeBinding &&
      checkpointSealSources.get('pipeline') === seal.pipelineBinding &&
      checkpointSealSources.get('viewport') === seal.viewportBinding &&
      !seal.pipelineBinding.registering &&
      !seal.pipelineBinding.releasing &&
      !seal.pipelineBinding.released &&
      seal.pipelineBinding.unsubscribe !== null &&
      !seal.viewportBinding.registering &&
      !seal.viewportBinding.releasing &&
      !seal.viewportBinding.released &&
      seal.viewportBinding.unsubscribe !== null &&
      ((preparedCheckpoint === candidate && checkpoint === candidate.base) ||
        (publishedCheckpointSeal === seal && checkpoint === candidate.record))
    )
  }
  const hasOriginalCheckpointSealCustody = (seal: CheckpointSeal) =>
    seal.nativeBinding.handle.hasCustody() &&
    seal.nativeBinding.source.hasCustody(seal.nativeTicket) &&
    seal.pipelineBinding.source.isCurrent(seal.pipelineTicket) &&
    seal.viewportBinding.source.isCurrent(seal.viewportTicket)
  const sealPreparedRendererOwnedCheckpoint = (
    preparation: MarkdownRendererCheckpointPreparation,
  ): MarkdownRendererSealedCheckpointPublication | null => {
    const candidate = preparedCheckpoint
    if (
      !candidate ||
      candidate.preparation !== preparation ||
      sealingCheckpoint ||
      bindingCheckpointSealSources ||
      !hasCurrentCheckpointCustody() ||
      checkpointDeactivated ||
      checkpointAuthorityOverflowed ||
      cleanupFailures.size > 0 ||
      renderWatchCleanupFailure !== null ||
      candidate.authorityGeneration !== checkpointAuthorityGeneration
    )
      return null
    const nativeBinding = documentRetirement
    const pipelineBinding = checkpointSealSources.get('pipeline')
    const viewportBinding = checkpointSealSources.get('viewport')
    if (
      !nativeBinding ||
      documentRetirementUnknown ||
      bindingDocumentRetirement
    )
      throw new Error(
        'markdown-renderer-checkpoint-seal-source-unavailable:native-document-retirement-registration',
      )
    if (
      !pipelineBinding ||
      pipelineBinding.registering ||
      !pipelineBinding.unsubscribe ||
      pipelineBinding.released
    )
      throw new Error(
        'markdown-renderer-checkpoint-seal-source-unavailable:bindCheckpointSealSources.pipeline',
      )
    if (
      !viewportBinding ||
      viewportBinding.registering ||
      !viewportBinding.unsubscribe ||
      viewportBinding.released
    )
      throw new Error(
        'markdown-renderer-checkpoint-seal-source-unavailable:bindCheckpointSealSources.viewport',
      )
    if (
      preparedCheckpointSeal?.candidate === candidate &&
      hasSealedRendererOwnedCheckpointCustody(
        preparedCheckpointSeal.publication,
      )
    )
      return preparedCheckpointSeal.publication
    const attempt = {
      candidate,
      nativeBinding,
      pipelineBinding,
      viewportBinding,
      nativeTicket: null as MarkdownHeavyFeatureDocumentAuthorityTicket | null,
      pipelineTicket: null as object | null,
      viewportTicket: null as object | null,
    }
    let source: unknown = nativeBinding.source
    sealingCheckpoint = true
    try {
      const nativeTicket = (attempt.nativeTicket =
        nativeBinding.source.capture())
      if (!nativeTicket) return null
      // The original immutable Native ticket must describe this exact captured
      // checkpoint document, rather than a newer unrelated document/revision.
      const capture = candidate.record.capture
      if (
        nativeTicket.documentKey !== capture.documentIdentity.id ||
        nativeTicket.documentEpoch !== capture.documentIdentity.epoch ||
        nativeTicket.revision !== capture.revision
      )
        return null
      source = pipelineBinding.source
      const pipelineTicket = (attempt.pipelineTicket =
        pipelineBinding.source.issueTicket())
      if (!pipelineTicket) return null
      source = viewportBinding.source
      const viewportTicket = (attempt.viewportTicket =
        viewportBinding.source.issueTicket())
      if (!viewportTicket) return null
      source = candidate.record
      const publication: MarkdownRendererSealedCheckpointPublication =
        Object.freeze({
          ...candidate.publication,
          seal: Object.freeze({
            scope: 'renderer-checkpoint-source-custody',
            checkpointRef: capture.ref,
          }),
        })
      const seal: CheckpointSeal = {
        candidate,
        publication,
        nativeBinding,
        nativeTicket,
        pipelineBinding,
        pipelineTicket,
        viewportBinding,
        viewportTicket,
        authorityGeneration: candidate.authorityGeneration,
      }
      const originalCurrent = hasOriginalCheckpointSealCustody(seal)
      // All issuer calls and allocations precede this last joint private guard.
      if (
        !originalCurrent ||
        !hasPrivateCheckpointSealCustody(seal, true) ||
        preparedCheckpoint !== candidate
      )
        return null
      preparedCheckpointSeal = seal
      return publication
    } catch (cause) {
      // The exact attempted source/refs survive cancellation or late teardown.
      runCleanupBatch([
        {
          phase: 'checkpoint-seal-capture',
          resource: { attempt, source },
          run: () => {
            throw cause
          },
        },
      ])
      throw cause
    } finally {
      sealingCheckpoint = false
    }
  }
  const hasSealedRendererOwnedCheckpointCustody = (
    publication: MarkdownRendererCheckpointPublication,
  ): boolean => {
    const seal =
      preparedCheckpointSeal?.publication === publication
        ? preparedCheckpointSeal
        : publishedCheckpointSeal?.publication === publication
          ? publishedCheckpointSeal
          : null
    // Compare private token identity only. Known original pure checks never
    // acquire tickets, inspect resources, refresh, invoke caller getters or write.
    return (
      seal !== null &&
      hasPrivateCheckpointSealCustody(seal) &&
      hasOriginalCheckpointSealCustody(seal) &&
      hasPrivateCheckpointSealCustody(seal)
    )
  }
  const publishSealedRendererOwnedCheckpoint = (
    publication: MarkdownRendererCheckpointPublication,
  ): MarkdownRendererOwnedCheckpoint | null => {
    const seal = preparedCheckpointSeal
    if (
      !seal ||
      seal.publication !== publication ||
      !hasSealedRendererOwnedCheckpointCustody(publication) ||
      preparedCheckpoint !== seal.candidate
    )
      return null
    // Original publication contract: one private pointer commit, no allocation,
    // callbacks/reactive/native writes, cleanup, readiness or recovery receipt.
    checkpoint = seal.candidate.record
    publishedCheckpointSeal = seal
    preparedCheckpointSeal = null
    preparedCheckpoint = null
    return checkpoint.capture
  }
  const trackJob = () => {
    if (disposed) throw new Error('markdown-renderer-resource-owner-disposed')
    if (renderWatchPaused)
      throw new Error('markdown-renderer-resource-admission-paused')
    retireCheckpointAuthority('job-admission')
    const job = Symbol('renderer-job')
    let resolve: (() => void) | null = null
    const promise = new rendererInputNativePromise<void>((settle) => {
      resolve = settle
    })
    if (!resolve)
      throw new Error('markdown-renderer-job-settlement-unavailable')
    jobSettlements.set(job, { promise, resolve })
    jobs.add(job)
    return () => {
      if (jobs.has(job)) retireCheckpointAuthority('job-settlement')
      const removed = jobs.delete(job)
      if (removed) {
        jobSettlements.get(job)?.resolve()
        jobSettlements.delete(job)
      }
      return removed
    }
  }
  const waitForSelectedOwnedJobs = async () => {
    const selected = [...jobSettlements.values()].map(({ promise }) => promise)
    await rendererInputNativeApply(
      rendererInputNativeAll,
      rendererInputNativePromise,
      [selected],
    )
    // Only the selected real finally settlements are awaited. New admissions,
    // imports and subordinate/native resources are not a quiescence receipt.
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
  const detachTimer = (record: TimerRecord, retain: boolean) => {
    if (record.clearing) {
      const cause = new Error('markdown-renderer-timer-clear-in-progress')
      record.clearReentered = true
      record.clearCause = cause
      throw cause
    }
    record.clearing = true
    record.clearReentered = false
    if (!retain) record.retiring = true
    try {
      runCheckpointAuthorityCallback(
        'timer-clear',
        () => {
          const activation = record.activation
          if (activation) {
            const handle = activation.handle
            if (handle === undefined)
              throw new Error('markdown-renderer-timer-installation-unknown')
            const remaining = Math.max(
              0,
              record.deadline - rendererOwnedTimerNow(),
            )
            clearTimeout(handle)
            if (record.clearReentered) throw record.clearCause
            activation.canceled = true
            timers.delete(handle)
            if (record.activation === activation) {
              record.activation = null
              record.remaining = activation.fired ? 0 : remaining
            }
          }
          if (!retain && timerRecords.get(record.token) === record)
            timerRecords.delete(record.token)
        },
        record,
        'timer-clear',
      )
    } finally {
      record.clearing = false
    }
  }
  const armTimer = (record: TimerRecord) => {
    if (disposed || record.activation || record.retiring)
      throw new Error('markdown-renderer-timer-rearm-unavailable')
    const installation = recordInstallation('timer')
    const activation: TimerActivation = {
      handle: undefined,
      fired: false,
      canceled: false,
    }
    record.activation = activation
    let known = false
    try {
      record.deadline = rendererOwnedTimerNow() + record.remaining
      activation.handle = setTimeout(() => {
        runCheckpointAuthorityCallback(
          'timer-callback',
          () => {
            if (record.activation !== activation || activation.canceled) return
            activation.fired = true
            if (activation.handle !== undefined)
              timers.delete(activation.handle)
            if (activation.handle !== undefined) record.activation = null
            if (disposed || record.retiring) {
              if (activation.handle !== undefined)
                timerRecords.delete(record.token)
              return
            }
            if (renderWatchPaused) {
              // Actual delivery while admission is closed parks the descriptor;
              // it does not run a stale callback or pretend the request vanished.
              record.remaining = 0
              return
            }
            timerRecords.delete(record.token)
            record.run()
          },
          record,
        )
      }, record.remaining)
      known = true
      if (activation.fired) {
        if (record.activation === activation) record.activation = null
        if (disposed || record.retiring) timerRecords.delete(record.token)
      } else {
        timers.add(activation.handle)
        if (disposed || record.retiring) detachTimer(record, false)
        else if (renderWatchPaused && !rearmingRenderWatch)
          detachTimer(record, true)
      }
    } catch (cause) {
      if (!known) installation.fail(cause)
      throw cause
    } finally {
      if (known) installation.complete()
    }
  }
  const setTimer = (
    run: () => void,
    delay: number,
  ): MarkdownRendererOwnedTimer => {
    if (disposed || renderWatchPaused)
      throw new Error('markdown-renderer-resource-admission-paused')
    if (!Number.isFinite(delay) || delay < 0 || delay > 2147483647)
      throw new Error('markdown-renderer-timer-delay-unsupported')
    const token: MarkdownRendererOwnedTimer = Object.freeze({
      scope: 'renderer-owned-timer',
    })
    const record: TimerRecord = {
      token,
      run,
      remaining: delay,
      deadline: 0,
      activation: null,
      retiring: false,
      clearing: false,
      clearReentered: false,
      clearCause: undefined,
    }
    // Hold callback/deadline custody before invoking the real timer factory.
    timerRecords.set(token, record)
    armTimer(record)
    return token
  }
  const clearTimer = (token: MarkdownRendererOwnedTimer) => {
    const record = timerRecords.get(token)
    if (record) detachTimer(record, false)
  }
  const afterFrame = () =>
    new Promise<void>((resolve) => {
      if (
        disposed ||
        renderWatchPaused ||
        typeof requestAnimationFrame !== 'function'
      ) {
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
    if (disposed || renderWatchPaused) {
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
            if (disposed || renderWatchPaused || cancellationSelected) {
              cancel()
              return
            }
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
            runCheckpointAuthorityCallback(`frame-${phase}`, () => {
              if (disposed || renderWatchPaused || cancellationSelected) {
                cancel()
                return
              }
              return run.call(queuedTask)
            })
      }
      const guard = queuedTask.guard
      if (guard)
        queuedTask.guard = () =>
          runCheckpointAuthorityCallback('frame-guard', () => {
            if (disposed || renderWatchPaused || cancellationSelected) {
              cancel()
              return false
            }
            return guard.call(queuedTask)
          })
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
  const detachAbortBinding = (record: AbortBinding, retain: boolean) => {
    if (record.retired) return
    if (record.removing) {
      const cause = new Error('markdown-renderer-abort-remove-in-progress')
      record.removeReentered = true
      record.removeCause = cause
      throw cause
    }
    record.removing = true
    record.removeReentered = false
    if (!retain) record.retireRequested = true
    try {
      runCheckpointAuthorityCallback(
        'abort-listener-detach',
        () => {
          if (record.attached || record.unknown || record.registering) {
            record.signal.removeEventListener('abort', record.abort)
            if (record.removeReentered) throw record.removeCause
            record.attached = false
            if (!record.registering) {
              record.unknown = false
              listeners.delete(record.remove)
            }
          }
          record.suspended = retain
          if (!retain && !record.registering) {
            record.retired = true
            if (abortBindings.get(record.remove) === record)
              abortBindings.delete(record.remove)
          }
        },
        record,
        'abort-listener-detach',
      )
    } finally {
      record.removing = false
    }
  }
  const attachAbortBinding = (record: AbortBinding) => {
    if (disposed || record.retired || record.registering || record.attached)
      throw new Error('markdown-renderer-abort-rearm-unavailable')
    if (record.signal.aborted) {
      record.abort()
      return
    }
    const installation = recordInstallation('abort-listener')
    record.registering = true
    record.unknown = true
    listeners.add(record.remove)
    installingListeners.add(record.remove)
    let known = false
    try {
      record.signal.addEventListener('abort', record.abort, { once: true })
      known = true
      record.registering = false
      record.unknown = false
      record.attached = true
      record.suspended = false
      if (disposed || record.retireRequested) detachAbortBinding(record, false)
      else if (renderWatchPaused && !rearmingRenderWatch)
        detachAbortBinding(record, true)
      else if (record.signal.aborted) record.abort()
    } catch (cause) {
      if (!known) installation.fail(cause)
      throw cause
    } finally {
      record.registering = false
      installingListeners.delete(record.remove)
      if (known) installation.complete()
    }
  }
  const listenForAbort = (signal: AbortSignal, run: () => void) => {
    if (disposed || renderWatchPaused)
      throw new Error('markdown-renderer-resource-admission-paused')
    retireCheckpointAuthority('abort-listener-admission')
    const record: AbortBinding = {
      signal,
      run,
      abort: () => {
        if (record.retired || (record.suspended && !record.signal.aborted))
          return
        runCleanupBatch([
          {
            phase: 'abort-listener-remove',
            resource: record,
            run: record.remove,
          },
          {
            phase: 'abort-listener-callback',
            resource: record,
            run: record.run,
          },
        ])
      },
      remove: () => detachAbortBinding(record, false),
      attached: false,
      suspended: false,
      retired: false,
      retireRequested: false,
      unknown: false,
      registering: false,
      removing: false,
      removeReentered: false,
      removeCause: undefined,
    }
    // Retain the actual target/function pair before the native registration call.
    abortBindings.set(record.remove, record)
    try {
      attachAbortBinding(record)
    } catch (cause) {
      runCleanupBatch([
        {
          phase: 'abort-listener-install',
          resource: record,
          run: () => {
            throw cause
          },
        },
        {
          phase: 'late-abort-listener-remove',
          resource: record,
          run: record.remove,
        },
      ])
      throw cause
    }
    return record.remove
  }
  const inspectComponentHandles = (): MarkdownRendererOwnedHandleInspection =>
    Object.freeze({
      scope: 'renderer-component-owned-handles',
      complete: false,
      measuredUsageOnly: true,
      usage: Object.freeze({
        editorInstances: 0,
        renderers: 0,
        observers: 0,
        timers: timers.size,
        backgroundTasks: jobs.size + frames.size + scheduledFrames.size,
        networkRequests: 0,
        memoryUnits:
          timers.size +
          timerRecords.size * 2 +
          abortBindings.size +
          frames.size +
          scheduledFrames.size +
          jobs.size +
          jobSettlements.size * 3 +
          listeners.size +
          pendingFrameFinalizers.size +
          installations.size +
          (renderWatchHandle ? 1 : 0) +
          (renderWatchSource ? 1 : 0) +
          (pausedRenderWatchSource?.length ?? 0) +
          (pausedRenderWatchDocument ? 2 : 0),
      }),
      retainedListeners: listeners.size + (renderWatchHandle ? 1 : 0),
      watchPaused:
        renderWatchPaused &&
        renderWatchHandle === null &&
        !controllingRenderWatch,
      watchAdmissionClosed: renderWatchPaused,
      watchControlInProgress: controllingRenderWatch,
      rearmingWatch: rearmingRenderWatch,
      pendingJobSettlements: jobSettlements.size,
      pendingFrameFinalizers: pendingFrameFinalizers.size,
      unknownInstallations: [...installations.values()].filter(
        (record) => record.state === 'unknown',
      ).length,
      nativeEffectCensus: 'unknown',
    })
  const pauseOwnedHandles = (): MarkdownRendererOwnedHandleInspection => {
    if (disposed || controllingOwnedHandles)
      throw new Error('markdown-renderer-owned-handle-control-unavailable')
    controllingOwnedHandles = true
    if (!renderWatchPaused) {
      renderWatchPaused = true
      generation += 1
    }
    try {
      runCleanupBatch([
        {
          phase: 'owned-watch-pause',
          resource: renderWatchSource,
          run: pauseRenderWatch,
        },
        {
          phase: 'related-resources-pause',
          resource: options.pauseRelatedResources,
          run: () => runCleanupBatch(options.pauseRelatedResources?.() ?? []),
        },
        ...[...timerRecords.values()].map((record) => ({
          phase: 'owned-timer-pause',
          resource: record,
          run: () => detachTimer(record, true),
        })),
        { phase: 'owned-frames-pause', resource: frames, run: cancelFrames },
        ...[...abortBindings.values()].map((record) => ({
          phase: 'owned-abort-listener-pause',
          resource: record,
          run: () => detachAbortBinding(record, true),
        })),
      ])
    } finally {
      controllingOwnedHandles = false
    }
    return inspectComponentHandles()
  }
  const resumeOwnedHandles = (): MarkdownRendererOwnedHandleInspection => {
    if (disposed || controllingOwnedHandles)
      throw new Error('markdown-renderer-owned-handle-control-unavailable')
    if (!renderWatchPaused) return inspectComponentHandles()
    const source = renderWatchSource
    const selected = pausedRenderWatchSource
    const native = pausedRenderWatchDocument
    if (!source || !selected || !native)
      throw new Error('markdown-renderer-owned-resume-source-unsupported')
    if (
      jobs.size ||
      jobSettlements.size ||
      installations.size ||
      pendingFrameFinalizers.size
    )
      throw new Error('markdown-renderer-owned-resume-settlement-pending')
    const hasSource = () => {
      const values = source.readSource()
      return (
        values.length === selected.length &&
        values.every((value, index) => Object.is(value, selected[index])) &&
        options.readDocumentAuthority() === native.source &&
        native.source.hasCustody(native.ticket)
      )
    }
    controllingOwnedHandles = true
    try {
      runCheckpointAuthorityCallback(
        'owned-handle-resume',
        () => {
          if (!hasSource())
            throw new Error('markdown-renderer-owned-resume-source-stale')
          rearmingRenderWatch = true
          try {
            runCleanupBatch([
              ...[...abortBindings.values()]
                .filter((record) => record.suspended)
                .map((record) => ({
                  phase: 'owned-abort-listener-rearm',
                  resource: record,
                  run: () => attachAbortBinding(record),
                })),
              ...[...timerRecords.values()]
                .filter((record) => !record.activation && !record.retiring)
                .map((record) => ({
                  phase: 'owned-timer-rearm',
                  resource: record,
                  run: () => armTimer(record),
                })),
              {
                phase: 'owned-watch-rearm',
                resource: source,
                run: () => installRenderWatch(false),
              },
            ])
            if (disposed || renderWatchSource !== source || !hasSource())
              throw new Error('markdown-renderer-owned-resume-source-stale')
            // Actual native handles are now rearmed; only then reopen admission.
            renderWatchPaused = false
            runCleanupBatch(options.resumeRelatedResources?.() ?? [])
            options.recreateCurrentFrames?.()
            if (disposed || !hasSource())
              throw new Error('markdown-renderer-owned-resume-source-stale')
            pausedRenderWatchSource = null
            pausedRenderWatchDocument = null
          } catch (cause) {
            renderWatchPaused = true
            runCleanupBatch([
              {
                phase: 'owned-resume-failure',
                resource: source,
                run: () => {
                  throw cause
                },
              },
              {
                phase: 'owned-resume-watch-stop',
                resource: renderWatchHandle,
                run: stopRenderWatch,
              },
              {
                phase: 'owned-resume-related-pause',
                resource: options.pauseRelatedResources,
                run: () =>
                  runCleanupBatch(options.pauseRelatedResources?.() ?? []),
              },
              ...[...timerRecords.values()].map((record) => ({
                phase: 'owned-resume-timer-detach',
                resource: record,
                run: () => detachTimer(record, true),
              })),
              {
                phase: 'owned-resume-frame-cancel',
                resource: frames,
                run: cancelFrames,
              },
              ...[...abortBindings.values()].map((record) => ({
                phase: 'owned-resume-listener-detach',
                resource: record,
                run: () => detachAbortBinding(record, true),
              })),
            ])
            throw cause
          } finally {
            rearmingRenderWatch = false
          }
        },
        source,
      )
    } finally {
      controllingOwnedHandles = false
    }
    return inspectComponentHandles()
  }
  const bindRendererDisposer = (dispose: () => void) => {
    if (rendererDisposer && rendererDisposer !== dispose)
      throw new Error('markdown-renderer-disposer-owner-replaced')
    rendererDisposer = dispose
  }
  const disposeOwnedHandles = () => {
    if (!rendererDisposer)
      throw new Error('markdown-renderer-original-disposer-unavailable')
    // The original setup/unmount disposer owns the real native terminal cleanup.
    // This is not restoration/recovery or an eviction success acknowledgment.
    runCheckpointAuthorityCallback(
      'owned-handle-dispose',
      rendererDisposer,
      rendererDisposer,
    )
  }
  const inspectOwnedResources = () => {
    const sealSourceRecords = [...checkpointSealSources.values()]
    const retainedSealSourceListeners = sealSourceRecords.filter(
      (record) => record.unsubscribe !== null && !record.released,
    ).length
    const ownedInputs = [...inputPublications.values()].map((record) =>
      record.inspect(),
    )
    const inputListeners = ownedInputs.reduce(
      (sum, record) => sum + record.retainedListeners,
      0,
    )
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
    if (ownedInputs.some((input) => input.releaseObligations > 0))
      missingSourceDependencies.push(
        'renderer-input:receiver-release-obligations',
      )
    if (ownedInputs.some((input) => input.pendingAsyncObservers > 0))
      missingSourceDependencies.push(
        'renderer-input:async-observation-settlement',
      )
    if (
      ownedInputs.some((input) => input.unavailableCallbackResults.length > 0)
    )
      missingSourceDependencies.push(
        'renderer-input:unsupported-callback-result-observation',
      )
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
        adapterInvocationResources: pipeline.adapterInvocationResources,
        workerProviderResources: Object.freeze(
          workerScopes.map((scope) => scope.provider),
        ),
        virtualObserverResources: viewport.observerCallbackResources,
        componentHandles: inspectComponentHandles(),
        ownedTimerRecords: Object.freeze(
          [...timerRecords.values()].map((record) =>
            Object.freeze({
              token: record.token,
              remaining: record.remaining,
              deadline: record.deadline,
              nativeHandle: record.activation?.handle,
              activationFired: record.activation?.fired ?? false,
              unknownNativeInstallation:
                record.activation !== null &&
                record.activation.handle === undefined,
              retiring: record.retiring,
              clearing: record.clearing,
              clearReentered: record.clearReentered,
              failureCause: record.clearCause,
            }),
          ),
        ),
        ownedAbortBindings: Object.freeze(
          [...abortBindings.values()].map((record) =>
            Object.freeze({
              signal: record.signal,
              attached: record.attached,
              suspended: record.suspended,
              retired: record.retired,
              registering: record.registering,
              unknown: record.unknown,
              removing: record.removing,
              removeReentered: record.removeReentered,
              failureCause: record.removeCause,
            }),
          ),
        ),
        checkpointSealSources: Object.freeze(
          sealSourceRecords.map((record) =>
            Object.freeze({
              role: record.role,
              source: record.source,
              retainedReleaseHandle:
                record.unsubscribe !== null && !record.released,
              registering: record.registering,
              unknownRegistration:
                record.unsubscribe === null && !record.released,
              releasing: record.releasing,
              releaseReentered: record.releaseReentered,
              failureCause: record.releaseCause,
            }),
          ),
        ),
        rendererOwnedInputs: Object.freeze(ownedInputs),
        rendererOwnedCheckpoint: checkpoint?.capture ?? null,
        rendererCheckpointCustody: Object.freeze({
          prepared: preparedCheckpoint?.preparation ?? null,
          validated: preparedCheckpoint?.validated ?? false,
          publication: 'renderer-custody-only' as const,
          liveAuthority: 'renderer-checkpoint-source-custody-only' as const,
          fullHostRefset: 'unavailable' as const,
          seal:
            preparedCheckpointSeal || publishedCheckpointSeal
              ? ('checkpoint-bound-source-custody' as const)
              : ('not-sealed' as const),
          preparedSeal: preparedCheckpointSeal?.publication ?? null,
          publishedSeal: publishedCheckpointSeal?.publication ?? null,
          sealingCheckpoint,
          missingBindings: Object.freeze(
            ['pipeline', 'viewport'].filter(
              (role) =>
                !checkpointSealSources.has(role as 'pipeline' | 'viewport'),
            ),
          ),
          missingSealSourceDependencies:
            markdownRendererCheckpointSealSourceDependencies,
          ownedAuthorityRetirement: Object.freeze({
            generation: checkpointAuthorityGeneration,
            overflowed: checkpointAuthorityOverflowed,
            deactivated: checkpointDeactivated,
            lastReason: lastCheckpointAuthorityRetirement,
            runningCallbacks: checkpointAuthorityCallbackDepth,
            notifyingInputRetirement,
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
          retainedSealSourceListeners +
          inputListeners +
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
            (sealingCheckpoint ? 1 : 0) +
            (bindingCheckpointSealSources ? 1 : 0) +
            ownedInputs.reduce(
              (sum, input) => sum + input.pendingAsyncObservers,
              0,
            ) +
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
            timerRecords.size * 2 +
            abortBindings.size +
            jobSettlements.size * 3 +
            (renderWatchSource ? 1 : 0) +
            (pausedRenderWatchSource?.length ?? 0) +
            (pausedRenderWatchDocument ? 2 : 0) +
            (ownedHandleControl ? 1 : 0) +
            (checkpointHandle ? 1 : 0) +
            sealSourceRecords.length +
            retainedSealSourceListeners +
            (preparedCheckpointSeal ? 1 : 0) +
            (publishedCheckpointSeal ? 1 : 0) +
            ownedInputs.reduce(
              (sum, record) =>
                sum +
                1 +
                record.retainedListeners +
                (record.retainedTicket ? 1 : 0) +
                (record.nativeDocumentTicket ? 1 : 0) +
                record.retainedSnapshotEntries +
                record.failures.length +
                record.unavailableCallbackResults.length +
                record.asyncObservations.length +
                record.failureRecords.length,
              0,
            ) +
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
  const inspectParticipantResourceCensus =
    (): MarkdownEditorSessionResourceInspection => {
      const source = inspectOwnedResources()
      const unsupported = [...source.missingSourceDependencies]
      const adapter = source.sources.adapterInvocationResources
      if (adapter.internalResources === 'unsupported')
        unsupported.push('adapter:internal-resources-unsupported')
      if (adapter.internalCancellationCompletion === 'unsupported')
        unsupported.push('adapter:cancellation-completion-unsupported')
      if (
        source.sources.virtualObserverResources.internalQueueControl ===
        'unsupported'
      )
        unsupported.push(
          'virtual-window:undelivered-platform-observer-queue-unsupported',
        )
      for (const provider of source.sources.workerProviderResources) {
        unsupported.push(...provider.unsupported)
        if (provider.settlement.localResources !== 'released')
          unsupported.push('worker:owned-provider-cleanup-retained-or-unknown')
        if (provider.shared.attribution === 'unattributable')
          unsupported.push(
            'worker:shared-resources-not-attributed-to-this-renderer',
          )
      }
      if (source.sources.rendererNative.effectCensus === 'unknown')
        unsupported.push(
          'renderer:original-component-effect-detach-rearm-source-unavailable',
        )
      // Never return the known-only subtotal as an admitted whole-owner report.
      if (unsupported.length > 0)
        throw new MarkdownRendererResourceControlUnsupportedError(
          unsupported,
          inspectComponentHandles(),
        )
      return source.inspection
    }
  const participant: MarkdownEditorSessionResourceParticipant = Object.freeze({
    ownerRef: 'renderer-projection',
    inspect: inspectParticipantResourceCensus,
    pause() {
      pauseOwnedHandles()
      return inspectParticipantResourceCensus()
    },
    resume() {
      resumeOwnedHandles()
      return inspectParticipantResourceCensus()
    },
    dispose(snapshotRef: string) {
      inspectParticipantResourceCensus()
      const selected = checkpoint
      if (!selected || selected.capture.ref !== snapshotRef)
        throw new Error(
          'markdown-renderer-original-snapshot-binding-unavailable',
        )
      // Terminal cleanup is implemented separately; no recoverable native
      // checkpoint exists, so this full-session disposal cannot acknowledge it.
      if (selected.capture.nativeRecovery === 'unavailable')
        throw new Error('markdown-renderer-session-checkpoint-not-recoverable')
      disposeOwnedHandles()
    },
  })
  const disposeOnUnmount = (
    componentActions: readonly MarkdownRendererCleanupAction[] = [],
    releaseActions: readonly MarkdownRendererCleanupAction[] = [],
  ) => {
    if (disposingOnUnmount) return
    disposed = true
    disposingOnUnmount = true
    generation += 1
    try {
      // Lock disposal before retirement invokes a foreign input receiver.
      retireCheckpointAuthority('unmount')
      for (const publication of inputPublications.values()) publication.close()
      registerComponentCleanups(componentActions)
      runCleanupBatch([
        ...[...checkpointSealSources.values()].map((record) => ({
          phase: 'checkpoint-seal-source-release',
          resource: record,
          run: () => releaseCheckpointSealSource(record),
        })),
        ...[...inputPublications.values()].map((publication) => ({
          phase: 'renderer-input-subscriptions-release',
          resource: publication,
          run: publication.releaseSubscriptions,
        })),
        {
          phase: 'document-retirement-release',
          resource: documentRetirement?.handle,
          run: releaseDocumentRetirement,
        },
        ...[...timerRecords.keys()].map((timer) => ({
          phase: 'timer-clear',
          resource: timer,
          run: () => clearTimer(timer),
        })),
        { phase: 'owned-frames', resource: frames, run: cancelFrames },
        ...[...abortBindings.keys()].map((remove) => ({
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
        timerRecords.size > 0 ||
        frames.size > 0 ||
        scheduledFrames.size > 0 ||
        pendingFrameFinalizers.size > 0 ||
        controlledFrameKeys.size > 0 ||
        listeners.size > 0 ||
        abortBindings.size > 0 ||
        installingListeners.size > 0 ||
        installations.size > 0 ||
        pendingComponentCleanups.size > 0 ||
        documentRetirement !== null ||
        documentRetirementUnknown ||
        checkpointSealSources.size > 0 ||
        [...inputPublications.values()].some((record) =>
          record.hasReleaseObligations(),
        ) ||
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
  const ownedHandleControl: MarkdownRendererOwnedHandleControl = Object.freeze({
    inspect: inspectComponentHandles,
    pauseRenderWatch,
    resumeRenderWatch,
    waitForSelectedOwnedJobs,
    pauseOwnedHandles,
    resumeOwnedHandles,
    disposeOwnedHandles,
  })
  const checkpointHandle: MarkdownRendererCheckpointHandle = Object.freeze({
    prepareRendererOwnedCheckpoint,
    sealPreparedRendererOwnedCheckpoint,
    hasSealedRendererOwnedCheckpointCustody,
    publishSealedRendererOwnedCheckpoint,
    cancelPreparedRendererOwnedCheckpoint,
  })
  const getRendererCheckpointHandle =
    (): MarkdownRendererCheckpointHandle | null => {
      const pipeline = checkpointSealSources.get('pipeline')
      const viewport = checkpointSealSources.get('viewport')
      if (
        disposed ||
        renderWatchPaused ||
        bindingDocumentRetirement ||
        documentRetirementUnknown ||
        documentRetirement === null ||
        checkpointAuthorityCallbackDepth > 0 ||
        bindingCheckpointSealSources ||
        !pipeline ||
        pipeline.registering ||
        typeof pipeline.unsubscribe !== 'function' ||
        pipeline.releasing ||
        pipeline.released ||
        !viewport ||
        viewport.registering ||
        typeof viewport.unsubscribe !== 'function' ||
        viewport.releasing ||
        viewport.released
      )
        return null
      return checkpointHandle
    }
  return Object.freeze({
    afterFrame,
    getOwnedHandleControl: () => ownedHandleControl,
    isRenderWatchPaused: () => renderWatchPaused,
    bindRenderWatchSource,
    bindRendererDisposer,
    installRenderWatch,
    getRendererCheckpointHandle,
    bindDocumentAuthorityReceiver,
    bindCheckpointSealSources,
    bindRenderWatchHandle,
    beginInstallation,
    beginRender,
    captureLastValidRender,
    createOwnedInputPublication,
    // Borrow the actual Native provider; its handle has failureCause, not an
    // invented getFailures or a replacement document ticket issuer.
    readNativeDocumentAuthority: () => documentRetirement?.source ?? null,
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
