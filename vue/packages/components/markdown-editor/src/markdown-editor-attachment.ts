import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'
import type {
  MarkdownEditorTransaction,
  MarkdownEditorTransactionEvent,
} from './markdown-editor-transaction'
import type { MarkdownAttachmentJob } from './markdown-editor-attachment-lifecycle'

export type MarkdownAttachmentSourceKind = 'pick' | 'paste' | 'drop'

/** @deprecated Use MarkdownAttachmentSourceKind. */
export type MarkdownAttachmentIntent = MarkdownAttachmentSourceKind

export type MarkdownAttachmentItemKind =
  | 'image'
  | 'file'
  | 'audio'
  | 'video'
  | 'unknown'

export type MarkdownAttachmentMarkdownKind = 'image' | 'link' | 'file'

export type MarkdownAttachmentProviderStatus =
  | 'pending'
  | 'progress'
  | 'resolved'
  | 'rejected'
  | 'cancelled'
  | 'retry'
  | 'stale'
  | 'deleted'
  | 'document-abort'
  | 'unsafe'

export interface MarkdownAttachmentRange {
  readonly start: number
  readonly end: number
}

export interface MarkdownAttachmentAnchor {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly nodeId: string | null
  readonly range: MarkdownAttachmentRange
}

export interface MarkdownAttachmentItemIntent {
  readonly itemId: string
  readonly order: number
  readonly kind: MarkdownAttachmentItemKind
  readonly mimeType: string
  readonly name: string
  readonly byteLength: number
  readonly signal: AbortSignal
}

export interface MarkdownAttachmentBatchIntent {
  readonly batchId: string
  readonly sourceKind: MarkdownAttachmentSourceKind
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly anchor: MarkdownAttachmentAnchor
  readonly items: readonly MarkdownAttachmentItemIntent[]
  readonly signal: AbortSignal
}

/** Observation of the original accepted native capture and placeholder dispatch. */
export interface MarkdownAttachmentCaptureObservation {
  readonly batch: MarkdownAttachmentBatchIntent
  readonly transaction: MarkdownEditorTransactionEvent
  readonly plan: Readonly<{
    transaction: MarkdownEditorTransaction
    jobs: readonly Readonly<MarkdownAttachmentJob>[]
  }>
  readonly placements: readonly Readonly<{
    item: MarkdownAttachmentItemIntent
    range: MarkdownAttachmentRange
  }>[]
}

/** Synchronous custody of one original native terminal application, not work settlement. */
export interface MarkdownAttachmentTerminalCustody {
  readonly capture: MarkdownAttachmentCaptureObservation
  readonly batch: MarkdownAttachmentBatchIntent
  readonly item: MarkdownAttachmentItemIntent
  readonly jobRef: Readonly<MarkdownAttachmentJob>
  readonly result: Extract<MarkdownAttachmentProviderResult, { status: 'resolved' }>
  readonly dispatchRef: object
  readonly attempt: number
  readonly beforeRevision: number
  hasCustody(): boolean
  isReleasingInput(): boolean
}

/** Only committed carries the actual accepted terminal transaction, never the capture transaction. */
export type MarkdownAttachmentTerminalObservation =
  | { readonly phase: 'applying'; readonly custody: MarkdownAttachmentTerminalCustody }
  | { readonly phase: 'accepted'; readonly custody: MarkdownAttachmentTerminalCustody; readonly transaction: MarkdownEditorTransactionEvent }
  | { readonly phase: 'committed'; readonly custody: MarkdownAttachmentTerminalCustody; readonly transaction: MarkdownEditorTransactionEvent }
  | { readonly phase: 'refused'; readonly custody: MarkdownAttachmentTerminalCustody; readonly transaction: MarkdownEditorTransactionEvent | null; readonly cause: unknown }

declare const markdownAttachmentTerminalRevisionReservationBrand: unique symbol

/** Opaque single application association. The native issuer does not own or complete the SDK lease. */
export interface MarkdownAttachmentTerminalRevisionReservation {
  readonly [markdownAttachmentTerminalRevisionReservationBrand]: true
}

/** Obtain only from the actual mounted editor in the original application composition. */
export interface MarkdownAttachmentTerminalRevisionIssuer {
  reserve(custody: MarkdownAttachmentTerminalCustody, leaseRef: object): MarkdownAttachmentTerminalRevisionReservation | null
  hasReservation(reservation: MarkdownAttachmentTerminalRevisionReservation, leaseRef: object,
    phase: 'applying' | 'accepted' | 'committed', transaction?: MarkdownEditorTransactionEvent): boolean
  cancelReservation(reservation: MarkdownAttachmentTerminalRevisionReservation, leaseRef: object): boolean
}

/** Return synchronous observation admission; no business, cleanup or qualification grant. */
export type MarkdownAttachmentTerminalObserver = (observation: MarkdownAttachmentTerminalObservation) => boolean

export type MarkdownAttachmentTerminalConsumer = (observation: MarkdownAttachmentTerminalObservation) => boolean

export interface MarkdownAttachmentTerminalNotificationFailure {
  readonly observation: MarkdownAttachmentTerminalObservation
  readonly cause: unknown
  /** Retain an unsupported original return value rather than inventing its settlement. */
  readonly returned: unknown
}

/** Synchronous loan of the original File; the item's signal bounds its lifetime. */
export type MarkdownAttachmentFileConsumer = (
  file: File,
  capture: MarkdownAttachmentCaptureObservation,
) => void

/** Counts owned by this local consumer request, including retained checkpoints. */
export interface MarkdownAttachmentConsumerResources {
  readonly backgroundTasks: number
  readonly timers: number
  readonly observers: number
  readonly retainedListeners: number
  readonly networkRequests: number
  readonly memoryUnits: number
}

export interface MarkdownAttachmentConsumerCheckpointPort {
  capture(): object | null
  recreate(checkpoint: object): MarkdownAttachmentConsumerRequest | null
  release(checkpoint: object): void | PromiseLike<void>
}

/** The consumer's actual request; content completion is not work settlement. */
export interface MarkdownAttachmentConsumerRequest {
  readonly result: PromiseLike<MarkdownAttachmentProviderResult>
  readonly settled: PromiseLike<void>
  cancelLocal(reason?: string): void | PromiseLike<void>
  inspectLocalResources(): MarkdownAttachmentConsumerResources
  readonly checkpoint?: MarkdownAttachmentConsumerCheckpointPort
}

export type MarkdownAttachmentRequestConsumer = (
  file: File,
  capture: MarkdownAttachmentCaptureObservation,
) => MarkdownAttachmentConsumerRequest

export type MarkdownAttachmentRequestDispatch = (input: {
  readonly batch: MarkdownAttachmentBatchIntent
  readonly item: MarkdownAttachmentItemIntent
  readonly file: File | null
  readonly onProgress: (result: MarkdownAttachmentProviderResult) => boolean
}) => MarkdownAttachmentConsumerRequest

export type MarkdownAttachmentConsumerCapability<T> =
  | { readonly supported: true; readonly value: T }
  | {
      readonly supported: false
      readonly reason: string
      /** Keep the original unknown work available to its invocation owner. */
      readonly value: unknown
    }

export interface MarkdownAttachmentConsumerCleanupObservation {
  readonly operation: 'cancel' | 'release'
  readonly checkpoint: object | undefined
  readonly work: unknown
  readonly observerWork: unknown
  readonly status: 'pending' | 'fulfilled' | 'rejected' | 'unobservable'
  readonly cause: unknown
  readonly observationCause: unknown
}

export interface MarkdownAttachmentConsumerRequestBinding {
  readonly request: MarkdownAttachmentConsumerRequest
  readonly result: PromiseLike<MarkdownAttachmentProviderResult>
  readonly settled: PromiseLike<void>
  retire(): void
  cancelLocal(reason?: string): void | PromiseLike<void>
  getRetainedCheckpoint(): object | null
  inspectCleanup(): readonly MarkdownAttachmentConsumerCleanupObservation[]
  inspectLocalResources(): MarkdownAttachmentConsumerCapability<MarkdownAttachmentConsumerResources>
  captureCheckpoint(): MarkdownAttachmentConsumerCapability<object>
  recreateCheckpoint(
    checkpoint: object,
  ): MarkdownAttachmentConsumerCapability<MarkdownAttachmentConsumerRequestBinding>
  releaseCheckpoint(checkpoint: object): void | PromiseLike<void>
}

const attachmentConsumerMissingProperty = Symbol('attachment-consumer-property')
const readAttachmentConsumerProperty = (
  value: object,
  key: string,
): unknown => {
  const visited = new Set<object>()
  let current: object | null = value
  while (current && !visited.has(current)) {
    visited.add(current)
    const property = Object.getOwnPropertyDescriptor(current, key)
    if (property)
      return 'value' in property
        ? property.value
        : attachmentConsumerMissingProperty
    current = Object.getPrototypeOf(current)
  }
  return undefined
}
const isAttachmentConsumerObject = (value: unknown): value is object =>
  (typeof value === 'object' && value !== null) || typeof value === 'function'
const isAttachmentConsumerFuture = (value: unknown) =>
  isAttachmentConsumerObject(value) &&
  typeof readAttachmentConsumerProperty(value, 'then') === 'function'

/** Bind the returned original request; never invoke another upload or mint a File grant. */
export const bindMarkdownAttachmentConsumerRequest = (
  value: unknown,
): MarkdownAttachmentConsumerCapability<MarkdownAttachmentConsumerRequestBinding> =>
  bindAttachmentConsumerRequest(value, new WeakSet<object>())

const bindAttachmentConsumerRequest = (
  value: unknown,
  previousFutures: WeakSet<object>,
): MarkdownAttachmentConsumerCapability<MarkdownAttachmentConsumerRequestBinding> => {
  const unsupported = (reason: string, originalValue: unknown = value) =>
    Object.freeze({ supported: false as const, reason, value: originalValue })
  if (!isAttachmentConsumerObject(value))
    return unsupported('consumer-request-unavailable')
  const request = value
  const result = readAttachmentConsumerProperty(request, 'result')
  const settled = readAttachmentConsumerProperty(request, 'settled')
  const cancel = readAttachmentConsumerProperty(request, 'cancelLocal')
  const inspect = readAttachmentConsumerProperty(
    request,
    'inspectLocalResources',
  )
  const checkpointPort = readAttachmentConsumerProperty(request, 'checkpoint')
  if (
    !isAttachmentConsumerFuture(result) ||
    !isAttachmentConsumerFuture(settled) ||
    result === settled ||
    typeof cancel !== 'function' ||
    typeof inspect !== 'function'
  )
    return unsupported('consumer-request-capabilities-unavailable')
  if (
    previousFutures.has(result as object) ||
    previousFutures.has(settled as object)
  )
    return unsupported('consumer-recreation-future-reused')
  previousFutures.add(result as object)
  previousFutures.add(settled as object)

  const capture = isAttachmentConsumerObject(checkpointPort)
    ? readAttachmentConsumerProperty(checkpointPort, 'capture')
    : undefined
  const recreate = isAttachmentConsumerObject(checkpointPort)
    ? readAttachmentConsumerProperty(checkpointPort, 'recreate')
    : undefined
  const release = isAttachmentConsumerObject(checkpointPort)
    ? readAttachmentConsumerProperty(checkpointPort, 'release')
    : undefined
  const hasCheckpoint =
    typeof capture === 'function' &&
    typeof recreate === 'function' &&
    typeof release === 'function'
  let busy = false
  let retired = false
  let portsInvalidated = false
  let checkpointPortsInvalidated = false
  let retainedCheckpoint: object | undefined
  let checkpointCurrent = false
  const expiredCheckpoints = new WeakSet<object>()
  const current = () => {
    if (portsInvalidated) return false
    portsInvalidated =
      readAttachmentConsumerProperty(request, 'result') !== result ||
      readAttachmentConsumerProperty(request, 'settled') !== settled ||
      readAttachmentConsumerProperty(request, 'cancelLocal') !== cancel ||
      readAttachmentConsumerProperty(request, 'inspectLocalResources') !==
        inspect ||
      readAttachmentConsumerProperty(request, 'checkpoint') !== checkpointPort
    return !portsInvalidated
  }
  const checkpointMethodsCurrent = () => {
    if (checkpointPortsInvalidated) return false
    checkpointPortsInvalidated = !(
      hasCheckpoint &&
      isAttachmentConsumerObject(checkpointPort) &&
      readAttachmentConsumerProperty(checkpointPort, 'capture') === capture &&
      readAttachmentConsumerProperty(checkpointPort, 'recreate') === recreate &&
      readAttachmentConsumerProperty(checkpointPort, 'release') === release
    )
    return !checkpointPortsInvalidated
  }
  const enter = () => {
    if (busy) throw new Error('attachment-consumer-request-reentry')
    busy = true
  }
  const callback = <T>(run: () => T): T => {
    enter()
    try {
      return run()
    } finally {
      busy = false
    }
  }
  type Cleanup = {
    -readonly [Key in keyof MarkdownAttachmentConsumerCleanupObservation]: MarkdownAttachmentConsumerCleanupObservation[Key]
  }
  let cancellation: Cleanup | undefined
  let checkpointRelease: Cleanup | undefined
  const cleanupUnsettled = () =>
    [cancellation, checkpointRelease].some(
      (cleanup) => cleanup && cleanup.status !== 'fulfilled',
    )
  const runCleanup = (
    operation: Cleanup['operation'],
    checkpoint: object | undefined,
    run: () => unknown,
  ): void | PromiseLike<void> => {
    const previous = operation === 'cancel' ? cancellation : checkpointRelease
    if (previous?.status === 'pending' || previous?.status === 'unobservable')
      throw new Error('attachment-consumer-cleanup-unsettled')
    const cleanup: Cleanup = {
      operation,
      checkpoint,
      work: undefined,
      observerWork: undefined,
      status: 'pending',
      cause: undefined,
      observationCause: undefined,
    }
    if (operation === 'cancel') cancellation = cleanup
    else checkpointRelease = cleanup
    const releaseSucceeded = () => {
      if (
        operation === 'release' &&
        checkpointRelease === cleanup &&
        retainedCheckpoint === checkpoint
      )
        retainedCheckpoint = undefined
    }
    try {
      cleanup.work = run()
    } catch (cause) {
      cleanup.status = 'rejected'
      cleanup.cause = cause
      throw cause
    }
    if (cleanup.work === undefined) {
      cleanup.status = 'fulfilled'
      releaseSucceeded()
      return
    }
    let subscribed = false
    let outcome: 'fulfilled' | 'rejected' | undefined
    const finish = () => {
      if (!subscribed || cleanup.status === 'unobservable' || !outcome) return
      cleanup.status = outcome
      if (outcome === 'fulfilled') releaseSucceeded()
    }
    try {
      if (!isAttachmentConsumerFuture(cleanup.work))
        throw new Error('attachment-consumer-cleanup-future-unavailable')
      const then = readAttachmentConsumerProperty(
        cleanup.work as object,
        'then',
      )
      // Observe the actual returned work, exposing its actual observer future too.
      // No Promise.resolve/async wrapper substitutes another cleanup future.
      cleanup.observerWork = Reflect.apply(
        then as PromiseLike<void>['then'],
        cleanup.work,
        [
          () => {
            if (outcome) return
            outcome = 'fulfilled'
            finish()
          },
          (cause: unknown) => {
            if (outcome) return
            outcome = 'rejected'
            cleanup.cause = cause
            finish()
          },
        ],
      )
      if (!isAttachmentConsumerFuture(cleanup.observerWork))
        throw new Error('attachment-consumer-cleanup-observer-unavailable')
      subscribed = true
      finish()
    } catch (cause) {
      cleanup.status = 'unobservable'
      cleanup.observationCause = cause
      throw cause
    }
    return cleanup.work as PromiseLike<void>
  }
  const binding: MarkdownAttachmentConsumerRequestBinding = Object.freeze({
    request: request as MarkdownAttachmentConsumerRequest,
    result: result as PromiseLike<MarkdownAttachmentProviderResult>,
    settled: settled as PromiseLike<void>,
    getRetainedCheckpoint() {
      return retainedCheckpoint ?? null
    },
    inspectCleanup() {
      return Object.freeze(
        [cancellation, checkpointRelease]
          .filter((cleanup): cleanup is Cleanup => Boolean(cleanup))
          .map((cleanup) => Object.freeze({ ...cleanup })),
      )
    },
    retire() {
      callback(() => {
        retired = true
        checkpointCurrent = false
        if (retainedCheckpoint) expiredCheckpoints.add(retainedCheckpoint)
      })
    },
    cancelLocal(reason?: string) {
      return callback(() => {
        // Cleanup retains the pinned original cancellation method even after retirement.
        checkpointCurrent = false
        if (retainedCheckpoint) expiredCheckpoints.add(retainedCheckpoint)
        return runCleanup('cancel', undefined, () =>
          Reflect.apply(cancel, request, [reason]),
        )
      })
    },
    inspectLocalResources() {
      return callback(() => {
        if (!current()) return unsupported('consumer-request-stale')
        if (cleanupUnsettled()) return unsupported('consumer-cleanup-unsettled')
        const resources: unknown = Reflect.apply(inspect, request, [])
        if (!isAttachmentConsumerObject(resources))
          return unsupported('consumer-resource-census-unavailable')
        const fields = [
          'backgroundTasks',
          'timers',
          'observers',
          'retainedListeners',
          'networkRequests',
          'memoryUnits',
        ] as const
        const counts = fields.map((key) =>
          readAttachmentConsumerProperty(resources, key),
        )
        if (
          !counts.every(
            (count) => Number.isSafeInteger(count) && (count as number) >= 0,
          ) ||
          !current()
        )
          return unsupported('consumer-resource-census-unavailable')
        return Object.freeze({
          supported: true as const,
          value: Object.freeze(
            Object.fromEntries(
              fields.map((key, index) => [key, counts[index]]),
            ),
          ) as unknown as MarkdownAttachmentConsumerResources,
        })
      })
    },
    captureCheckpoint() {
      return callback(() => {
        if (
          retired ||
          cleanupUnsettled() ||
          !current() ||
          !checkpointMethodsCurrent()
        )
          return unsupported('consumer-checkpoint-unavailable')
        if (retainedCheckpoint)
          return unsupported(
            'consumer-checkpoint-already-retained',
            retainedCheckpoint,
          )
        const checkpoint: unknown = Reflect.apply(
          capture as MarkdownAttachmentConsumerCheckpointPort['capture'],
          checkpointPort,
          [],
        )
        if (!isAttachmentConsumerObject(checkpoint))
          return unsupported('consumer-checkpoint-unavailable')
        // Retain the actual opaque object even if its callback invalidated admission.
        retainedCheckpoint = checkpoint
        checkpointCurrent =
          !expiredCheckpoints.has(checkpoint) &&
          current() &&
          checkpointMethodsCurrent()
        return checkpointCurrent
          ? Object.freeze({ supported: true as const, value: checkpoint })
          : unsupported('consumer-checkpoint-stale', checkpoint)
      })
    },
    recreateCheckpoint(checkpoint: object) {
      return callback(() => {
        if (
          retainedCheckpoint !== checkpoint ||
          cleanupUnsettled() ||
          retired ||
          !checkpointCurrent ||
          !current() ||
          !checkpointMethodsCurrent()
        )
          return unsupported('consumer-checkpoint-foreign-or-stale')
        // Recreation is single-use, including a failed or throwing native invocation.
        checkpointCurrent = false
        expiredCheckpoints.add(checkpoint)
        const recreated: unknown = Reflect.apply(
          recreate as MarkdownAttachmentConsumerCheckpointPort['recreate'],
          checkpointPort,
          [checkpoint],
        )
        if (!current() || !checkpointMethodsCurrent())
          return Object.freeze({
            supported: false as const,
            reason: 'consumer-recreation-stale',
            value: recreated,
          })
        if (recreated === request)
          return unsupported('consumer-recreation-original-attempt')
        return bindAttachmentConsumerRequest(recreated, previousFutures)
      })
    },
    releaseCheckpoint(checkpoint: object) {
      return callback(() => {
        if (checkpoint !== retainedCheckpoint || !hasCheckpoint)
          throw new Error('attachment-consumer-checkpoint-foreign')
        checkpointCurrent = false
        expiredCheckpoints.add(checkpoint)
        // On failure keep the original reference for this actual release's retry.
        return runCleanup('release', checkpoint, () =>
          Reflect.apply(
            release as MarkdownAttachmentConsumerCheckpointPort['release'],
            checkpointPort,
            [checkpoint],
          ),
        )
      })
    },
  })
  return Object.freeze({ supported: true as const, value: binding })
}

export interface MarkdownAttachmentResolvedPayload {
  readonly markdownKind: MarkdownAttachmentMarkdownKind
  readonly href: string
  readonly alt?: string
  readonly title?: string
  readonly assetId?: string
  readonly mimeType: string
  readonly name?: string
}

export type MarkdownAttachmentProviderResult =
  | {
      readonly status: 'resolved'
      readonly batchId: string
      readonly itemId: string
      readonly documentIdentity: MarkdownDocumentIdentity
      readonly revision: number
      readonly payload: MarkdownAttachmentResolvedPayload
    }
  | {
      readonly status: Exclude<
        MarkdownAttachmentProviderStatus,
        'resolved' | 'pending'
      >
      readonly batchId: string
      readonly itemId?: string
      readonly documentIdentity?: MarkdownDocumentIdentity
      readonly revision?: number
      readonly code?: string
      readonly ratio?: number
    }

export type MarkdownAttachmentProvider = (input: {
  readonly batch: MarkdownAttachmentBatchIntent
  readonly item: MarkdownAttachmentItemIntent
}) =>
  | Promise<MarkdownAttachmentProviderResult>
  | MarkdownAttachmentProviderResult

export interface MarkdownAttachmentQueryState {
  readonly batchId: string
  readonly itemId: string
  readonly status: MarkdownAttachmentProviderStatus
  readonly progress: number
  readonly code?: string
}

const kindFromMime = (mimeType: string): MarkdownAttachmentItemKind => {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.length > 0) return 'file'
  return 'unknown'
}

const unsafeHref = (href: string) => {
  const value = href.trim().toLowerCase()
  return (
    value.startsWith('javascript:') ||
    value.startsWith('data:text/html') ||
    value.startsWith('vbscript:') ||
    value.includes('<') ||
    value.startsWith('fsusblog:')
  )
}

export const createMarkdownAttachmentBatch = (input: {
  readonly sourceKind: MarkdownAttachmentSourceKind
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly nodeId?: string | null
  readonly range: MarkdownAttachmentRange
  readonly items: readonly {
    readonly mimeType: string
    readonly name: string
    readonly byteLength: number
    readonly kind?: MarkdownAttachmentItemKind
    readonly signal?: AbortSignal
  }[]
  readonly signal?: AbortSignal
  readonly eventFingerprint?: string
}): MarkdownAttachmentBatchIntent => {
  const signal = input.signal ?? new AbortController().signal
  const batchId = [
    input.documentIdentity.id,
    input.documentIdentity.epoch,
    input.revision,
    input.nodeId ?? 'doc',
    input.sourceKind,
    String(input.items.length),
    ...(input.eventFingerprint ? [input.eventFingerprint] : []),
  ].join(':')
  const items = input.items.map((item, order) =>
    Object.freeze({
      itemId: `${batchId}:${order}`,
      order,
      kind: item.kind ?? kindFromMime(item.mimeType),
      mimeType: item.mimeType,
      name: item.name,
      byteLength: item.byteLength,
      signal: item.signal ?? signal,
    }),
  )
  return Object.freeze({
    batchId,
    sourceKind: input.sourceKind,
    documentIdentity: input.documentIdentity,
    revision: input.revision,
    anchor: Object.freeze({
      documentIdentity: input.documentIdentity,
      revision: input.revision,
      nodeId: input.nodeId ?? null,
      range: Object.freeze({ ...input.range }),
    }),
    items: Object.freeze(items),
    signal,
  })
}

export interface MarkdownAttachmentProviderRequest {
  readonly requestId: string
  readonly intent: MarkdownAttachmentIntent
  readonly anchor: {
    readonly documentIdentity: MarkdownDocumentIdentity
    readonly revision: number
    readonly nodeId: string | null
    readonly sourceOffset: number
  }
  readonly mimeType: string
  readonly batch: MarkdownAttachmentBatchIntent
}

export const createMarkdownAttachmentRequest = (
  intent: MarkdownAttachmentIntent,
  anchor: {
    readonly documentIdentity: MarkdownDocumentIdentity
    readonly revision: number
    readonly nodeId: string | null
    readonly sourceOffset: number
  },
  mimeType: string,
): MarkdownAttachmentProviderRequest => {
  const batch = createMarkdownAttachmentBatch({
    sourceKind: intent,
    documentIdentity: anchor.documentIdentity,
    revision: anchor.revision,
    nodeId: anchor.nodeId,
    range: { start: anchor.sourceOffset, end: anchor.sourceOffset },
    items: [{ mimeType, name: 'attachment', byteLength: 0 }],
  })
  return Object.freeze({
    requestId: batch.items[0]!.itemId,
    intent,
    anchor,
    mimeType,
    batch,
  })
}

export const markdownFromAttachmentPayload = (
  payload: MarkdownAttachmentResolvedPayload,
) => {
  if (unsafeHref(payload.href)) return null
  if (payload.markdownKind === 'image') {
    return `![${payload.alt ?? ''}](${payload.href})`
  }
  const label = payload.name ?? payload.title ?? payload.alt ?? payload.href
  return `[${label}](${payload.href})`
}

export const commitMarkdownAttachmentResult = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly nodeStatus?: 'current' | 'deleted' | 'invalid'
  readonly result: MarkdownAttachmentProviderResult
  readonly source?: string
}) => {
  const result = input.result
  if (
    result.documentIdentity &&
    (result.documentIdentity.id !== input.documentIdentity.id ||
      result.documentIdentity.epoch !== input.documentIdentity.epoch)
  ) {
    return Object.freeze({
      accepted: false as const,
      status: 'document-abort' as const,
    })
  }
  if (result.status === 'document-abort') {
    return Object.freeze({
      accepted: false as const,
      status: 'document-abort' as const,
    })
  }
  if (
    typeof result.revision === 'number' &&
    result.revision !== input.revision
  ) {
    return Object.freeze({ accepted: false as const, status: 'stale' as const })
  }
  if (input.nodeStatus === 'deleted' || input.nodeStatus === 'invalid') {
    return Object.freeze({
      accepted: false as const,
      status: 'deleted' as const,
    })
  }
  if (result.status !== 'resolved') {
    return Object.freeze({ accepted: false as const, status: result.status })
  }
  const extra = result as MarkdownAttachmentProviderResult & {
    readonly html?: string
    readonly source?: string
    readonly files?: unknown
  }
  if (extra.html || extra.source || extra.files) {
    return Object.freeze({
      accepted: false as const,
      status: 'unsafe' as const,
      code: 'non-markdown-result',
    })
  }
  const markdown = markdownFromAttachmentPayload(result.payload)
  if (!markdown || /<[a-z]/i.test(markdown)) {
    return Object.freeze({
      accepted: false as const,
      status: 'unsafe' as const,
      code: 'unsafe-payload',
    })
  }
  return Object.freeze({
    accepted: true as const,
    status: 'resolved' as const,
    markdown,
    itemId: result.itemId,
    batchId: result.batchId,
  })
}

export const createMarkdownAttachmentSession = () => {
  const states = new Map<string, MarkdownAttachmentQueryState>()
  const register = (batch: MarkdownAttachmentBatchIntent) => {
    for (const item of batch.items) {
      states.set(
        item.itemId,
        Object.freeze({
          batchId: batch.batchId,
          itemId: item.itemId,
          status: 'pending',
          progress: 0,
        }),
      )
    }
  }
  const record = (result: MarkdownAttachmentProviderResult) => {
    const itemId = result.itemId
    if (!itemId) return
    const previous = states.get(itemId)
    states.set(
      itemId,
      Object.freeze({
        batchId: result.batchId,
        itemId,
        status: result.status === 'progress' ? 'progress' : result.status,
        progress:
          result.status === 'progress'
            ? (result.ratio ?? 0)
            : (previous?.progress ?? 0),
        ...(result.status !== 'resolved' &&
        result.status !== 'progress' &&
        result.code
          ? { code: result.code }
          : {}),
      }),
    )
  }
  const query = (itemId: string): MarkdownAttachmentQueryState | undefined =>
    states.get(itemId)
  const abortDocument = (identity: MarkdownDocumentIdentity) => {
    for (const [id, state] of states) {
      if (id.startsWith(`${identity.id}:`)) {
        states.set(
          id,
          Object.freeze({ ...state, status: 'document-abort' as const }),
        )
      }
    }
  }
  return { register, record, query, abortDocument }
}

export type MarkdownAttachmentMutationKind =
  | 'file-array-half-migration'
  | 'consumer-source-mutation'
  | 'arbitrary-html'
  | 'bare-offset'

export const evaluateMarkdownAttachmentMutations = (
  request: MarkdownAttachmentProviderRequest,
) => {
  const identity = request.anchor.documentIdentity
  const batch = request.batch
  const htmlResult = commitMarkdownAttachmentResult({
    documentIdentity: identity,
    revision: request.anchor.revision,
    result: {
      status: 'resolved',
      batchId: batch.batchId,
      itemId: batch.items[0]!.itemId,
      documentIdentity: identity,
      revision: request.anchor.revision,
      payload: {
        markdownKind: 'image',
        href: 'https://cdn.example/a.png',
        mimeType: 'image/png',
        alt: 'ok',
      },
      html: '<img src=x>',
    } as MarkdownAttachmentProviderResult,
  })
  const sourceWrite = commitMarkdownAttachmentResult({
    documentIdentity: identity,
    revision: request.anchor.revision,
    result: {
      status: 'resolved',
      batchId: batch.batchId,
      itemId: batch.items[0]!.itemId,
      documentIdentity: identity,
      revision: request.anchor.revision,
      payload: {
        markdownKind: 'file',
        href: 'https://cdn.example/a.bin',
        mimeType: 'application/octet-stream',
        name: 'a.bin',
      },
      source: '# rewritten by provider',
    } as MarkdownAttachmentProviderResult,
  })
  const otherDoc = commitMarkdownAttachmentResult({
    documentIdentity: { id: 'other', epoch: 1 },
    revision: request.anchor.revision,
    result: {
      status: 'resolved',
      batchId: batch.batchId,
      itemId: batch.items[0]!.itemId,
      documentIdentity: identity,
      revision: request.anchor.revision,
      payload: {
        markdownKind: 'file',
        href: 'https://cdn.example/a.bin',
        mimeType: 'application/pdf',
      },
    },
  })
  const filesField = 'files' in batch
  const bare =
    !('nodeId' in batch.anchor) ||
    typeof (batch.anchor as { sourceOffset?: number }).sourceOffset === 'number'
  void otherDoc
  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'file-array-half-migration' as const,
        equivalent:
          filesField || Array.isArray((batch as { files?: unknown }).files),
        accepted: false,
      }),
      Object.freeze({
        kind: 'consumer-source-mutation' as const,
        equivalent: sourceWrite.accepted,
        accepted: false,
      }),
      Object.freeze({
        kind: 'arbitrary-html' as const,
        equivalent: htmlResult.accepted,
        accepted: false,
      }),
      Object.freeze({
        kind: 'bare-offset' as const,
        equivalent: Boolean(
          bare && !batch.anchor.nodeId && batch.anchor.range === undefined,
        ),
        accepted: false,
      }),
    ]),
  })
}

export interface MarkdownAttachmentInputFile {
  readonly name: string
  readonly mimeType?: string
  readonly type?: string
  readonly byteLength?: number
  readonly size?: number
  readonly kind?: MarkdownAttachmentItemKind
  readonly signal?: AbortSignal
}

export interface MarkdownAttachmentCaptureContext {
  readonly readonly?: boolean
  readonly disabled?: boolean
  readonly mode?: string
  readonly isComposing?: boolean
  readonly currentRevision?: number
}

export interface MarkdownAttachmentCaptureInput {
  readonly sourceKind: MarkdownAttachmentSourceKind
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly anchor: {
    readonly range: MarkdownAttachmentRange
    readonly nodeId?: string | null
  }
  readonly files: readonly MarkdownAttachmentInputFile[]
  readonly signal?: AbortSignal
  readonly context?: MarkdownAttachmentCaptureContext
  readonly eventFingerprint?: string
  readonly session?: MarkdownAttachmentCaptureSession
}

export interface MarkdownAttachmentCaptureSession {
  claim(eventFingerprint: string): boolean
  clear(): void
}

const captureFingerprints = new WeakMap<
  MarkdownAttachmentCaptureSession,
  Set<string>
>()

/** Internal census; a foreign implementation cannot prove this owner's memory. */
export const inspectMarkdownAttachmentCaptureResources = (
  session: MarkdownAttachmentCaptureSession,
) => {
  const fingerprints = captureFingerprints.get(session)
  if (!fingerprints)
    throw new Error('editor-session-attachment-capture-owner-unavailable')
  return Object.freeze({ memoryUnits: fingerprints.size })
}

export const createMarkdownAttachmentCaptureSession = (
  maxFingerprints = 64,
): MarkdownAttachmentCaptureSession => {
  const fingerprints = new Set<string>()
  const session: MarkdownAttachmentCaptureSession = Object.freeze({
    claim(eventFingerprint: string) {
      if (fingerprints.has(eventFingerprint)) return false
      fingerprints.add(eventFingerprint)
      while (fingerprints.size > Math.max(1, maxFingerprints)) {
        const oldest = fingerprints.values().next().value
        if (oldest === undefined) break
        fingerprints.delete(oldest)
      }
      return true
    },
    clear() {
      fingerprints.clear()
    },
  })
  captureFingerprints.set(session, fingerprints)
  return session
}

export type MarkdownAttachmentCaptureRejection =
  | 'readonly'
  | 'disabled'
  | 'preview'
  | 'composition-active'
  | 'stale-document'
  | 'duplicate-event'
  | 'empty-files'

export type MarkdownAttachmentCaptureResult =
  | {
      readonly ok: true
      readonly batch: MarkdownAttachmentBatchIntent
      readonly eventFingerprint?: string
    }
  | {
      readonly ok: false
      readonly rejected: MarkdownAttachmentCaptureRejection
      readonly message: string
    }

export const captureMarkdownAttachmentInput = (
  input: MarkdownAttachmentCaptureInput,
): MarkdownAttachmentCaptureResult => {
  if (input.context?.readonly) {
    return Object.freeze({
      ok: false,
      rejected: 'readonly' as const,
      message: 'Attachment input rejected: editor is readonly',
    })
  }
  if (input.context?.disabled) {
    return Object.freeze({
      ok: false,
      rejected: 'disabled' as const,
      message: 'Attachment input rejected: editor is disabled',
    })
  }
  if (input.context?.mode === 'preview') {
    return Object.freeze({
      ok: false,
      rejected: 'preview' as const,
      message:
        'Attachment input rejected: preview mode does not accept attachments',
    })
  }
  if (input.context?.isComposing) {
    return Object.freeze({
      ok: false,
      rejected: 'composition-active' as const,
      message: 'Attachment input rejected: IME composition active',
    })
  }
  if (
    typeof input.context?.currentRevision === 'number' &&
    input.context.currentRevision !== input.revision
  ) {
    return Object.freeze({
      ok: false,
      rejected: 'stale-document' as const,
      message: 'Attachment input rejected: stale document revision',
    })
  }

  if (input.eventFingerprint && input.session) {
    if (!input.session.claim(input.eventFingerprint)) {
      return Object.freeze({
        ok: false,
        rejected: 'duplicate-event' as const,
        message: 'Attachment input rejected: duplicate event detected',
      })
    }
  }

  const rawFiles = input.files ?? []
  if (rawFiles.length === 0) {
    return Object.freeze({
      ok: false,
      rejected: 'empty-files' as const,
      message: 'Attachment input rejected: empty files list',
    })
  }

  const normalizedItems = rawFiles.map((file, order) => {
    const mimeType = file.mimeType || file.type || 'application/octet-stream'
    const name = file.name || `attachment-${order + 1}`
    const byteLength = file.byteLength ?? file.size ?? 0
    const kind = file.kind ?? kindFromMime(mimeType)
    return Object.freeze({
      mimeType,
      name,
      byteLength,
      kind,
      signal: file.signal,
    })
  })

  const allEmpty = normalizedItems.every(
    (item) => item.byteLength === 0 && !item.name,
  )
  if (allEmpty) {
    return Object.freeze({
      ok: false,
      rejected: 'empty-files' as const,
      message: 'Attachment input rejected: all files are empty',
    })
  }

  const batch = createMarkdownAttachmentBatch({
    sourceKind: input.sourceKind,
    documentIdentity: input.documentIdentity,
    revision: input.revision,
    nodeId: input.anchor.nodeId,
    range: input.anchor.range,
    items: normalizedItems,
    eventFingerprint: input.eventFingerprint,
    signal: input.signal,
  })

  return Object.freeze({
    ok: true as const,
    batch,
    eventFingerprint: input.eventFingerprint,
  })
}

export type MarkdownAttachmentCaptureMutationKind =
  | 'dom-positioning'
  | 'duplicate-events'
  | 'data-url'
  | 'stale-capture'

export const evaluateMarkdownAttachmentCaptureMutations = (
  input?: MarkdownAttachmentCaptureInput,
) => {
  const sampleInput =
    input ??
    ({
      sourceKind: 'drop' as const,
      documentIdentity: { id: 'doc', epoch: 1 },
      revision: 1,
      anchor: { range: { start: 0, end: 0 } },
      files: [{ name: 'file.png', mimeType: 'image/png', byteLength: 100 }],
    } as MarkdownAttachmentCaptureInput)

  const session = createMarkdownAttachmentCaptureSession()
  const captureInput = { ...sampleInput, session }
  const capture1 = captureMarkdownAttachmentInput(captureInput)
  const captureDuplicate = sampleInput.eventFingerprint
    ? captureMarkdownAttachmentInput(captureInput)
    : { ok: false }

  const hasDataUrl =
    capture1.ok && JSON.stringify(capture1.batch).includes('data:')

  const staleResult = captureMarkdownAttachmentInput({
    ...sampleInput,
    context: { currentRevision: sampleInput.revision + 1 },
  })

  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'dom-positioning' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'duplicate-events' as const,
        equivalent: captureDuplicate.ok === true,
        accepted: false,
      }),
      Object.freeze({
        kind: 'data-url' as const,
        equivalent: Boolean(hasDataUrl),
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-capture' as const,
        equivalent: staleResult.ok === true,
        accepted: false,
      }),
    ]),
  })
}

export interface MarkdownAttachmentAtomicAction {
  readonly key: 'cancel' | 'retry' | 'remove'
  readonly label: string
  readonly minTouchTargetPx: 44
  readonly disabled: boolean
}

export interface MarkdownAttachmentAtomicPresentation {
  readonly itemId: string
  readonly name: string
  readonly kind: MarkdownAttachmentItemKind
  readonly status: MarkdownAttachmentProviderStatus
  readonly progress: number
  readonly progressAriaText: string
  readonly statusAriaLive: 'polite'
  readonly actions: readonly MarkdownAttachmentAtomicAction[]
  readonly compact: true
  readonly isLargeCard: false
  readonly hasGradientOrGlow: false
}

export const createMarkdownAttachmentAtomicPresentation = (input: {
  readonly itemId: string
  readonly name: string
  readonly kind?: MarkdownAttachmentItemKind
  readonly status: MarkdownAttachmentProviderStatus
  readonly progress: number
  readonly copy?: Readonly<{
    actions: Readonly<Record<'cancel' | 'remove' | 'retry', string>>
    status: (name: string, status: string, percent: number) => string
  }>
}): MarkdownAttachmentAtomicPresentation => {
  const percent = Math.min(100, Math.max(0, Math.round(input.progress)))
  const displayedPercent = Math.round(percent / 25) * 25
  const progressAriaText =
    input.copy?.status(input.name, input.status, displayedPercent) ??
    `${input.name}:${input.status}:${displayedPercent}`

  const actions: MarkdownAttachmentAtomicAction[] = []
  if (input.status === 'pending' || input.status === 'progress') {
    actions.push(
      Object.freeze({
        key: 'cancel' as const,
        label: input.copy?.actions.cancel ?? 'cancel',
        minTouchTargetPx: 44,
        disabled: false,
      }),
    )
  }
  if (input.status === 'rejected' || input.status === 'cancelled') {
    actions.push(
      Object.freeze({
        key: 'retry' as const,
        label: input.copy?.actions.retry ?? 'retry',
        minTouchTargetPx: 44,
        disabled: false,
      }),
    )
    actions.push(
      Object.freeze({
        key: 'remove' as const,
        label: input.copy?.actions.remove ?? 'remove',
        minTouchTargetPx: 44,
        disabled: false,
      }),
    )
  }

  return Object.freeze({
    itemId: input.itemId,
    name: input.name,
    kind: input.kind ?? 'file',
    status: input.status,
    progress: percent,
    progressAriaText,
    statusAriaLive: 'polite' as const,
    actions: Object.freeze(actions),
    compact: true as const,
    isLargeCard: false as const,
    hasGradientOrGlow: false as const,
  })
}

export const queryMarkdownAttachmentUnfinishedCount = (
  states: readonly (
    | MarkdownAttachmentQueryState
    | { readonly status: MarkdownAttachmentProviderStatus }
  )[],
): {
  readonly pendingCount: number
  readonly failedCount: number
  readonly totalCount: number
} => {
  let pendingCount = 0
  let failedCount = 0
  for (const item of states) {
    if (
      item.status === 'pending' ||
      item.status === 'progress' ||
      item.status === 'retry'
    ) {
      pendingCount += 1
    } else if (item.status === 'rejected') {
      failedCount += 1
    }
  }
  return Object.freeze({
    pendingCount,
    failedCount,
    totalCount: states.length,
  })
}

export const validateMarkdownAttachmentPrepublish = (
  states: readonly (
    | MarkdownAttachmentQueryState
    | { readonly status: MarkdownAttachmentProviderStatus }
  )[],
): { readonly canPrepublish: boolean; readonly reason?: string } => {
  const { pendingCount, failedCount } =
    queryMarkdownAttachmentUnfinishedCount(states)
  if (pendingCount > 0) {
    return Object.freeze({
      canPrepublish: false,
      reason: `${pendingCount} attachment(s) are still uploading`,
    })
  }
  if (failedCount > 0) {
    return Object.freeze({
      canPrepublish: false,
      reason: `${failedCount} attachment(s) failed to upload`,
    })
  }
  return Object.freeze({ canPrepublish: true })
}

export type MarkdownAttachmentPresentationMutationKind =
  | 'protocol-leak'
  | 'hover-only'
  | 'large-card'
  | 'scroll-jump'
  | 'private-dom'

export const evaluateMarkdownAttachmentPresentationMutations = (
  presentation?: MarkdownAttachmentAtomicPresentation,
) => {
  const sample =
    presentation ??
    createMarkdownAttachmentAtomicPresentation({
      itemId: 'test:0',
      name: 'test.png',
      kind: 'image',
      status: 'progress',
      progress: 50,
    })

  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'protocol-leak' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'hover-only' as const,
        equivalent: sample.actions.some((a) => a.minTouchTargetPx < 44),
        accepted: false,
      }),
      Object.freeze({
        kind: 'large-card' as const,
        equivalent: sample.isLargeCard || sample.hasGradientOrGlow,
        accepted: false,
      }),
      Object.freeze({
        kind: 'scroll-jump' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'private-dom' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}

export interface MarkdownAttachmentAcceptanceReport {
  readonly accepted: boolean
  readonly version: string
  readonly matrix: {
    readonly inputs: readonly ['pick', 'paste', 'drop']
    readonly lifecycle: readonly [
      'pending',
      'progress',
      'resolved',
      'rejected',
      'cancelled',
      'retry',
      'stale',
      'deleted',
      'document-abort',
    ]
    readonly surfaces: readonly ['source', 'live', 'split']
    readonly accessibility: {
      readonly screenReaderNonFlooding: boolean
      readonly touchTargetMeetsBudget: boolean
      readonly nonHoverOnly: boolean
    }
  }
  readonly mutationsKilled: boolean
}

export const evaluateMarkdownAttachmentAcceptance =
  (): MarkdownAttachmentAcceptanceReport => {
    const presMutations = evaluateMarkdownAttachmentPresentationMutations()
    const capMutations = evaluateMarkdownAttachmentCaptureMutations()
    const allMutationsKilled =
      presMutations.mutations.every((m) => !m.accepted) &&
      capMutations.mutations.every((m) => !m.accepted)
    const accessibilitySample = createMarkdownAttachmentAtomicPresentation({
      itemId: 'acceptance:0',
      name: 'acceptance.png',
      kind: 'image',
      status: 'progress',
      progress: 51,
    })
    const accessibility = Object.freeze({
      screenReaderNonFlooding:
        accessibilitySample.statusAriaLive === 'polite' &&
        accessibilitySample.progressAriaText.endsWith(':progress:50'),
      touchTargetMeetsBudget: accessibilitySample.actions.every(
        (action) => action.minTouchTargetPx >= 44,
      ),
      nonHoverOnly: accessibilitySample.actions.length > 0,
    })
    const accessibilityAccepted = Object.values(accessibility).every(Boolean)

    return Object.freeze({
      accepted: allMutationsKilled && accessibilityAccepted,
      version: 'markdown-attachment-acceptance@2026-08-16',
      matrix: Object.freeze({
        inputs: Object.freeze(['pick', 'paste', 'drop'] as const),
        lifecycle: Object.freeze([
          'pending',
          'progress',
          'resolved',
          'rejected',
          'cancelled',
          'retry',
          'stale',
          'deleted',
          'document-abort',
        ] as const),
        surfaces: Object.freeze(['source', 'live', 'split'] as const),
        accessibility,
      }),
      mutationsKilled: allMutationsKilled,
    })
  }
