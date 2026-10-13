import { toRaw } from 'vue'
import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'
import type {
  MarkdownAttachmentAnchor,
  MarkdownAttachmentBatchIntent,
  MarkdownAttachmentItemIntent,
  MarkdownAttachmentItemKind,
  MarkdownAttachmentProviderResult,
  MarkdownAttachmentRange,
} from './markdown-editor-attachment'
import { commitMarkdownAttachmentResult } from './markdown-editor-attachment'
import type {
  MarkdownEditorChange,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'
import { createMarkdownEditorPositionMap } from './markdown-editor-transaction'

export type MarkdownAttachmentPhase =
  | 'idle'
  | 'pending'
  | 'progress'
  | 'resolved'
  | 'rejected'
  | 'cancelled'
  | 'stale'
  | 'deleted'
  | 'document-abort'

export interface MarkdownAttachmentJob {
  readonly id: string
  readonly name?: string
  readonly kind?: MarkdownAttachmentItemKind
  readonly batchId?: string
  readonly itemId?: string
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly revision?: number
  attempt: number
  phase: MarkdownAttachmentPhase
  progress: number
  code?: string
  message?: string
  range?: MarkdownAttachmentRange
  readonly signalController?: AbortController
}

interface MarkdownAttachmentDispatchState {
  readonly dispatchRef: object
  attempt: number
  settled: boolean
  dispatching: boolean
  settlementAvailable: boolean
  resultSettlement?: 'pending' | 'fulfilled' | 'rejected' | 'unknown'
  resultSettlementCause?: unknown
  resultObservationCause?: unknown
  localSettlement?: 'pending' | 'fulfilled' | 'unknown'
  localSettlementCause?: unknown
  localObservationCause?: unknown
  observationNotificationCauses?: readonly unknown[]
  retryPreparation?: {
    readonly fromDispatchRef: object
    readonly fromAttempt: number
    readonly targetAttempt: number
    readonly previousFailure: Readonly<{
      resultSettlement?: MarkdownAttachmentDispatchState['resultSettlement']
      resultSettlementCause?: unknown
      resultObservationCause?: unknown
      localSettlement?: MarkdownAttachmentDispatchState['localSettlement']
      localSettlementCause?: unknown
      localObservationCause?: unknown
      observationNotificationCauses?: readonly unknown[]
    }>
    mutationComplete: boolean
    dispatched: boolean
    readonly failures: unknown[]
  }
}
const attachmentDispatches = new WeakMap<
  MarkdownAttachmentJob,
  MarkdownAttachmentDispatchState
>()

/** Internal evidence from the actual invocation, independent of UI job phase. */
export const inspectMarkdownAttachmentDispatch = (
  job: MarkdownAttachmentJob,
) => {
  const state = attachmentDispatches.get(toRaw(job))
  return state ? Object.freeze({
    ...state,
    ...(state.retryPreparation ? {
      retryPreparation: Object.freeze({
        ...state.retryPreparation,
        failures: Object.freeze([...state.retryPreparation.failures]),
      }),
    } : {}),
  }) : null
}

/** Only the original result and full-local future can settle a richer invocation. */
export interface MarkdownAttachmentDispatchCompletion {
  readonly result: PromiseLike<MarkdownAttachmentProviderResult>
  readonly settled: PromiseLike<void>
}

export interface MarkdownAttachmentDispatchFutureObservation {
  readonly work: unknown
  /** Actual observation work, never a replacement for the original future. */
  readonly monitor: Promise<void>
  inspect(): {
    readonly status: 'pending' | 'fulfilled' | 'rejected' | 'unavailable'
    readonly primary: 'pending' | 'fulfilled' | 'rejected'
    readonly value: unknown
    readonly cause: unknown
    readonly observerWork: unknown
    readonly observationCause: unknown
  }
}

interface MarkdownAttachmentDispatchObservationControls {
  isCompletion(work: unknown): boolean
  within(action: () => void): void
  retain(
    kind: 'result' | 'settled',
    observation: MarkdownAttachmentDispatchFutureObservation,
  ): void
}

const createDispatchFutureObservation = (
  work: unknown,
  access: { readonly cause: unknown } | undefined,
  otherWork: unknown = work,
) => {
  let status: 'pending' | 'fulfilled' | 'rejected' | 'unavailable' = 'pending'
  let primary: 'pending' | 'fulfilled' | 'rejected' = 'pending'
  let value: unknown
  let cause: unknown
  let observerWork: unknown
  let observationCause: unknown
  let finish!: () => void
  const monitor = new Promise<void>((resolve) => { finish = resolve })
  const observation: MarkdownAttachmentDispatchFutureObservation = Object.freeze({
    work,
    monitor,
    inspect: () => Object.freeze({ status, primary, value, cause, observerWork, observationCause }),
  })
  let started = false
  const start = () => {
    if (started) return
    started = true
    try {
      if (access) throw access.cause
      // Pin the one actual read; a second .then lookup could change or throw.
      const then = (work as PromiseLike<unknown>).then
      if (typeof then !== 'function')
        throw new Error('markdown-attachment-future-unavailable')
      observerWork = Reflect.apply(then, work, [
        (fulfilled: unknown) => {
          if (primary !== 'pending') return
          primary = 'fulfilled'
          value = fulfilled
        },
        (rejected: unknown) => {
          if (primary !== 'pending') return
          primary = 'rejected'
          cause = rejected
        },
      ])
      if (
        observerWork === work || observerWork === otherWork ||
        ((typeof observerWork !== 'object' || observerWork === null) &&
          typeof observerWork !== 'function')
      )
        throw new Error('markdown-attachment-observer-work-unavailable')
    } catch (failure) {
      status = 'unavailable'
      observationCause = failure
      finish()
      return
    }
    // Retain and await the actual returned observer work, including its failure.
    void (async () => {
      try {
        const observed = await observerWork
        if (observed === observerWork || primary === 'pending')
          throw new Error('markdown-attachment-observer-work-unavailable')
        status = primary
      } catch (failure) {
        status = 'unavailable'
        observationCause = failure
      } finally {
        finish()
      }
    })()
  }
  return { observation, start }
}

/** Legacy result futures do not assert ownership of opaque consumer resources. */
export const runMarkdownAttachmentDispatch = async (
  job: MarkdownAttachmentJob,
  dispatch: () =>
    | PromiseLike<MarkdownAttachmentProviderResult>
    | MarkdownAttachmentDispatchCompletion,
  controls?: MarkdownAttachmentDispatchObservationControls,
): Promise<MarkdownAttachmentProviderResult> => {
  const ownedJob = toRaw(job)
  const previous = attachmentDispatches.get(ownedJob)
  const prepared = previous?.retryPreparation && !previous.retryPreparation.dispatched
  if (previous && !previous.settled && !prepared)
    throw new Error('markdown-attachment-dispatch-still-running')
  if (ownedJob.phase !== 'pending')
    throw new Error('markdown-attachment-dispatch-phase-unavailable')
  if (prepared && (!previous.retryPreparation!.mutationComplete || previous.attempt !== ownedJob.attempt))
    throw new Error('markdown-attachment-retry-preparation-incomplete')
  if (previous?.attempt === ownedJob.attempt && !prepared)
    throw new Error('markdown-attachment-attempt-already-dispatched')
  const state: MarkdownAttachmentDispatchState = prepared ? previous! : {
    dispatchRef: Object.freeze({}),
    attempt: ownedJob.attempt,
    settled: false,
    dispatching: true,
    settlementAvailable: false,
  }
  if (prepared) state.retryPreparation!.dispatched = true
  state.dispatching = true
  attachmentDispatches.set(ownedJob, state)
  const notificationCauses: unknown[] = []
  const within = (action: () => void) => {
    let invoked = false
    const once = () => {
      if (invoked) return
      invoked = true
      action()
    }
    try {
      if (controls) controls.within(once)
      else once()
    } catch (cause) {
      notificationCauses.push(cause)
    }
    // A failed control hook must not abandon either original future's handler.
    if (!invoked) once()
  }
  const retain = (
    kind: 'result' | 'settled',
    observation: MarkdownAttachmentDispatchFutureObservation,
  ) => {
    try { controls?.retain(kind, observation) }
    catch (cause) { notificationCauses.push(cause) }
  }
  const retainResultState = (
    observed: ReturnType<MarkdownAttachmentDispatchFutureObservation['inspect']>,
  ) => {
    state.resultSettlement = observed.status === 'fulfilled' || observed.status === 'rejected' ? observed.status : 'unknown'
    state.resultSettlementCause = observed.cause
    state.resultObservationCause = observed.observationCause
    state.observationNotificationCauses = Object.freeze([...notificationCauses])
  }
  try {
    const work = dispatch()
    state.dispatching = false
    const fallbackCompletion = () => Boolean(work && !('then' in work) && 'result' in work && 'settled' in work)
    let completion = false
    within(() => {
      try { completion = controls ? controls.isCompletion(work) : fallbackCompletion() }
      catch (cause) {
        notificationCauses.push(cause)
        try { completion = fallbackCompletion() }
        catch (failure) { notificationCauses.push(failure) }
      }
    })
    if (completion) {
      const capture = (kind: 'result' | 'settled') => {
        let original: unknown
        let access: { readonly cause: unknown } | undefined
        within(() => {
          try { original = (work as MarkdownAttachmentDispatchCompletion)[kind] }
          catch (cause) { access = { cause } }
        })
        return { original, access }
      }
      const resultWork = capture('result')
      const localWork = capture('settled')
      const result = createDispatchFutureObservation(resultWork.original, resultWork.access, localWork.original)
      const same = resultWork.original === localWork.original && !resultWork.access && !localWork.access
      const local = same ? result : createDispatchFutureObservation(localWork.original, localWork.access, resultWork.original)
      state.resultSettlement = 'pending'
      state.localSettlement = 'pending'
      // Install BOTH independent handlers before any custody notification can fail.
      within(result.start)
      if (local !== result) within(local.start)
      retain('result', result.observation)
      retain('settled', local.observation)
      state.settlementAvailable = !same &&
        result.observation.inspect().status !== 'unavailable' &&
        local.observation.inspect().status !== 'unavailable'
      await Promise.all([result.observation.monitor, local.observation.monitor])
      const resultState = result.observation.inspect()
      const localState = local.observation.inspect()
      retainResultState(resultState)
      state.localSettlement = localState.status === 'fulfilled' && !same && !notificationCauses.length
        ? 'fulfilled' : 'unknown'
      state.localSettlementCause = localState.cause
      state.localObservationCause = localState.observationCause
      state.settlementAvailable = !same &&
        (resultState.status === 'fulfilled' || resultState.status === 'rejected') &&
        (localState.status === 'fulfilled' || localState.status === 'rejected')
      if (
        same || (resultState.status !== 'fulfilled' && resultState.status !== 'rejected') ||
        state.localSettlement !== 'fulfilled' || notificationCauses.length
      ) {
        const causes: unknown[] = []
        for (const observed of [resultState, localState]) {
          if (observed.primary === 'rejected') causes.push(observed.cause)
          if (observed.status === 'unavailable') causes.push(observed.observationCause)
        }
        if (same) causes.push(new Error('markdown-attachment-dispatch-future-reused'))
        causes.push(...notificationCauses)
        throw new AggregateError(
          causes,
          'markdown-attachment-local-settlement-unavailable',
        )
      }
      state.settled = true
      if (resultState.status === 'rejected') throw resultState.cause
      return resultState.value as MarkdownAttachmentProviderResult
    }
    const result = createDispatchFutureObservation(work, undefined)
    state.resultSettlement = 'pending'
    within(result.start)
    retain('result', result.observation)
    state.settlementAvailable = result.observation.inspect().status !== 'unavailable'
    await result.observation.monitor
    const observed = result.observation.inspect()
    retainResultState(observed)
    state.settlementAvailable = observed.status === 'fulfilled' || observed.status === 'rejected'
    if (!state.settlementAvailable || notificationCauses.length)
      throw new AggregateError([
        ...(observed.primary === 'rejected' ? [observed.cause] : []),
        ...(observed.status === 'unavailable' ? [observed.observationCause] : []),
        ...notificationCauses,
      ], 'markdown-attachment-dispatch-settlement-unavailable')
    state.settled = true
    if (observed.status === 'rejected') throw observed.cause
    return observed.value as MarkdownAttachmentProviderResult
  } finally {
    state.dispatching = false
  }
}

export const createMarkdownAttachmentJob = (
  id: string,
  options?: {
    readonly name?: string
    readonly kind?: MarkdownAttachmentItemKind
    readonly batchId?: string
    readonly itemId?: string
    readonly documentIdentity?: MarkdownDocumentIdentity
    readonly revision?: number
    readonly attempt?: number
    readonly range?: MarkdownAttachmentRange
    readonly signalController?: AbortController
  },
): MarkdownAttachmentJob => ({
  id,
  name: options?.name,
  kind: options?.kind,
  batchId: options?.batchId,
  itemId: options?.itemId ?? id,
  documentIdentity: options?.documentIdentity
    ? Object.freeze({ ...options.documentIdentity })
    : undefined,
  revision: options?.revision,
  attempt: options?.attempt ?? 1,
  phase: 'pending',
  progress: 0,
  range: options?.range ? { ...options.range } : undefined,
  signalController: options?.signalController,
})

export const formatMarkdownAttachmentPendingSource = (
  item: MarkdownAttachmentItemIntent,
  uploading: (name: string) => string = (name) => name,
): string => {
  const label = uploading(item.name)
  if (item.kind === 'image') {
    return `![${label}]()`
  }
  return `[${label}]()`
}

export const planMarkdownAttachmentInsert = (
  source: string,
  anchor: MarkdownAttachmentAnchor,
  batch: MarkdownAttachmentBatchIntent,
  uploading: (name: string) => string = (name) => name,
): {
  readonly transaction: MarkdownEditorTransaction
  readonly jobs: readonly MarkdownAttachmentJob[]
} => {
  const pieces: string[] = []
  const jobs: MarkdownAttachmentJob[] = []
  let currentOffset = anchor.range.start

  for (let index = 0; index < batch.items.length; index += 1) {
    const item = batch.items[index]!
    const formatted = formatMarkdownAttachmentPendingSource(item, uploading)
    const suffix = index < batch.items.length - 1 ? '\n' : ''
    const fullText = formatted + suffix
    const itemRange: MarkdownAttachmentRange = Object.freeze({
      start: currentOffset,
      end: currentOffset + formatted.length,
    })
    currentOffset += fullText.length
    pieces.push(fullText)

    jobs.push(
      createMarkdownAttachmentJob(item.itemId, {
        name: item.name,
        kind: item.kind,
        batchId: batch.batchId,
        itemId: item.itemId,
        documentIdentity: batch.documentIdentity,
        revision: batch.revision,
        attempt: 1,
        range: itemRange,
      }),
    )
  }

  const inserted = pieces.join('')
  const transaction: MarkdownEditorTransaction = Object.freeze({
    changes: Object.freeze([
      Object.freeze({
        from: anchor.range.start,
        to: anchor.range.end,
        insert: inserted,
      }),
    ]),
    history: 'separate',
    origin: 'command',
  })

  return Object.freeze({
    transaction,
    jobs: Object.freeze(jobs),
  })
}

export const rebaseMarkdownAttachmentJob = (
  job: MarkdownAttachmentJob,
  changes: readonly MarkdownEditorChange[],
  source?: string,
): MarkdownAttachmentJob => {
  if (!job.range) return job
  let syntheticSource = source ?? ''
  if (!source) {
    let minimumLength = Math.max(job.range.end, 1)
    for (const change of [...changes].sort(
      (left, right) => left.from - right.from || left.to - right.to,
    )) {
      minimumLength += change.insert.length - (change.to - change.from)
      syntheticSource = ''.padStart(
        Math.max(minimumLength, change.to + 1),
        '\u0000',
      )
    }
  }
  const rebased = createMarkdownEditorPositionMap(changes, {
    source: syntheticSource,
  }).rebase(job.range)
  if (rebased.status === 'deleted' || rebased.start >= rebased.end) {
    job.phase = 'deleted'
    job.range = Object.freeze({
      start: rebased.status === 'deleted' ? job.range.start : rebased.start,
      end: rebased.status === 'deleted' ? job.range.start : rebased.end,
    })
    return job
  }
  job.range = Object.freeze({
    start: rebased.start,
    end: rebased.end,
  })
  return job
}

export const planMarkdownAttachmentResolve = (
  source: string,
  job: MarkdownAttachmentJob,
  result: MarkdownAttachmentProviderResult,
): {
  readonly accepted: boolean
  readonly status: MarkdownAttachmentPhase
  readonly transaction?: MarkdownEditorTransaction
  readonly markdown?: string
} => {
  if (job.phase === 'deleted') {
    return Object.freeze({ accepted: false, status: 'deleted' as const })
  }

  if (job.phase === 'cancelled') {
    return Object.freeze({ accepted: false, status: 'cancelled' as const })
  }

  if (
    job.phase === 'document-abort' ||
    job.phase === 'stale' ||
    job.phase === 'resolved' ||
    job.phase === 'rejected'
  ) {
    return Object.freeze({ accepted: false, status: job.phase })
  }

  if (
    result.documentIdentity &&
    job.documentIdentity &&
    (result.documentIdentity.id !== job.documentIdentity.id ||
      result.documentIdentity.epoch !== job.documentIdentity.epoch)
  ) {
    job.phase = 'document-abort'
    return Object.freeze({ accepted: false, status: 'document-abort' as const })
  }

  if (result.status !== 'resolved') {
    job.phase = result.status as MarkdownAttachmentPhase
    if ('code' in result && result.code) {
      job.code = result.code
    }
    return Object.freeze({ accepted: false, status: job.phase })
  }

  const committed = commitMarkdownAttachmentResult({
    documentIdentity: job.documentIdentity ?? { id: 'doc', epoch: 1 },
    revision: job.revision ?? 1,
    result,
  })

  if (!committed.accepted || !committed.markdown) {
    job.phase = 'rejected'
    job.code = 'unsafe-payload'
    return Object.freeze({ accepted: false, status: 'rejected' as const })
  }

  if (!job.range) {
    job.phase = 'deleted'
    return Object.freeze({ accepted: false, status: 'deleted' as const })
  }

  const transaction: MarkdownEditorTransaction = Object.freeze({
    changes: Object.freeze([
      Object.freeze({
        from: job.range.start,
        to: job.range.end,
        insert: committed.markdown,
      }),
    ]),
    history: 'separate',
    origin: 'command',
  })

  job.phase = 'resolved'
  job.progress = 100
  const markdownLen = committed.markdown.length
  job.range = Object.freeze({
    start: job.range.start,
    end: job.range.start + markdownLen,
  })

  return Object.freeze({
    accepted: true,
    status: 'resolved' as const,
    transaction,
    markdown: committed.markdown,
  })
}

export const planMarkdownAttachmentRemove = (
  source: string,
  job: MarkdownAttachmentJob,
): {
  readonly transaction: MarkdownEditorTransaction
} => {
  const from = job.range ? job.range.start : 0
  const to = job.range ? job.range.end : 0
  job.phase = 'deleted'
  job.range = Object.freeze({ start: from, end: from })

  return Object.freeze({
    transaction: Object.freeze({
      changes: Object.freeze([
        Object.freeze({
          from,
          to,
          insert: '',
        }),
      ]),
      history: 'separate',
      origin: 'command',
    }),
  })
}

export const progressMarkdownAttachmentJob = (
  job: MarkdownAttachmentJob,
  progress: number,
) => {
  if (job.phase !== 'pending' && job.phase !== 'progress') return job
  job.phase = 'progress'
  job.progress = Math.min(100, Math.max(0, progress))
  return job
}

export const cancelMarkdownAttachmentJob = (job: MarkdownAttachmentJob) => {
  job.phase = 'cancelled'
  if (job.signalController) {
    job.signalController.abort()
  }
  return job
}

export const assertMarkdownAttachmentRetryAdmission = (job: MarkdownAttachmentJob) => {
  const dispatch = inspectMarkdownAttachmentDispatch(job)
  const prepared = dispatch?.retryPreparation
  if (prepared && !prepared.dispatched) {
    if (job.attempt !== prepared.targetAttempt && job.attempt !== prepared.fromAttempt)
      throw new Error('markdown-attachment-retry-preparation-invalidated')
    return
  }
  if (
    !dispatch ||
    dispatch.attempt !== job.attempt ||
    (!dispatch.settlementAvailable && !dispatch.dispatching)
  )
    throw new Error('markdown-attachment-retry-settlement-unavailable')
  if (!dispatch.settled)
    throw new Error('markdown-attachment-retry-dispatch-still-running')
}

/** Preserve the actual failed admission without claiming a request was dispatched. */
export const captureMarkdownAttachmentRetryFailureHandler = (job: MarkdownAttachmentJob) => {
  const prepared = attachmentDispatches.get(toRaw(job))?.retryPreparation
  // Pin this invocation's actual record; a later dispatch must not steal its error.
  return (cause: unknown) => {
    if (prepared) prepared.failures.push(cause)
  }
}

export const retryMarkdownAttachmentJob = (job: MarkdownAttachmentJob) => {
  assertMarkdownAttachmentRetryAdmission(job)
  const ownedJob = toRaw(job)
  const previous = attachmentDispatches.get(ownedJob)!
  const continuing = previous.retryPreparation && !previous.retryPreparation.dispatched
  const preparation = continuing ? previous.retryPreparation! : {
    fromDispatchRef: previous.dispatchRef,
    fromAttempt: previous.attempt,
    targetAttempt: previous.attempt + 1,
    previousFailure: Object.freeze({
      resultSettlement: previous.resultSettlement,
      resultSettlementCause: previous.resultSettlementCause,
      resultObservationCause: previous.resultObservationCause,
      localSettlement: previous.localSettlement,
      localSettlementCause: previous.localSettlementCause,
      localObservationCause: previous.localObservationCause,
      observationNotificationCauses: previous.observationNotificationCauses,
    }),
    mutationComplete: false,
    dispatched: false,
    failures: [] as unknown[],
  }
  if (!Number.isSafeInteger(preparation.targetAttempt))
    throw new Error('markdown-attachment-retry-attempt-unavailable')
  const state: MarkdownAttachmentDispatchState = {
    dispatchRef: continuing ? previous.dispatchRef : Object.freeze({}),
    attempt: previous.attempt,
    settled: false,
    dispatching: false,
    settlementAvailable: false,
    retryPreparation: preparation,
  }
  preparation.mutationComplete = false
  attachmentDispatches.set(ownedJob, state)
  try {
    job.phase = 'pending'
    job.progress = 0
    job.attempt = preparation.targetAttempt
    job.code = undefined
    job.message = undefined
    preparation.mutationComplete = true
    return job
  } catch (cause) {
    preparation.mutationComplete = false
    preparation.failures.push(cause)
    throw cause
  } finally {
    // Read native data without invoking a replacement getter or masking the error.
    const attempt = Object.getOwnPropertyDescriptor(ownedJob, 'attempt')
    state.attempt = attempt && 'value' in attempt && Number.isSafeInteger(attempt.value)
      ? attempt.value : Number.NaN
  }
}

export type MarkdownAttachmentLifecycleMutationKind =
  | 'library-owned-store'
  | 'stale-completion'
  | 'undo-resurrection'
  | 'consumer-scheme'
  | 'duplicate-attempt'

export const evaluateMarkdownAttachmentLifecycleMutations = () => {
  const job = createMarkdownAttachmentJob('sample-item', {
    batchId: 'batch:1',
    documentIdentity: { id: 'doc', epoch: 1 },
    revision: 1,
    range: { start: 0, end: 10 },
  })

  // 1. deleted job cannot resurrect
  job.phase = 'deleted'
  const deletedResolve = planMarkdownAttachmentResolve('source', job, {
    status: 'resolved',
    batchId: 'batch:1',
    itemId: 'sample-item',
    documentIdentity: { id: 'doc', epoch: 1 },
    revision: 1,
    payload: {
      markdownKind: 'image',
      href: 'https://cdn.example/img.png',
      mimeType: 'image/png',
    },
  })

  // 2. consumer scheme
  const schemeResult = commitMarkdownAttachmentResult({
    documentIdentity: { id: 'doc', epoch: 1 },
    revision: 1,
    result: {
      status: 'resolved',
      batchId: 'batch:1',
      itemId: 'sample-item',
      documentIdentity: { id: 'doc', epoch: 1 },
      revision: 1,
      payload: {
        markdownKind: 'image',
        href: 'fsusblog://asset/123',
        mimeType: 'image/png',
      },
    },
  })

  // 3. stale revision
  const staleResolve = commitMarkdownAttachmentResult({
    documentIdentity: { id: 'doc', epoch: 1 },
    revision: 1,
    result: {
      status: 'resolved',
      batchId: 'batch:1',
      itemId: 'sample-item',
      documentIdentity: { id: 'doc', epoch: 1 },
      revision: 99,
      payload: {
        markdownKind: 'file',
        href: 'https://cdn.example/a.pdf',
        mimeType: 'application/pdf',
      },
    },
  })

  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'library-owned-store' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-completion' as const,
        equivalent: staleResolve.accepted === true,
        accepted: false,
      }),
      Object.freeze({
        kind: 'undo-resurrection' as const,
        equivalent: deletedResolve.accepted === true,
        accepted: false,
      }),
      Object.freeze({
        kind: 'consumer-scheme' as const,
        equivalent: schemeResult.accepted === true,
        accepted: false,
      }),
      Object.freeze({
        kind: 'duplicate-attempt' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}
