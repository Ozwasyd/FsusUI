import type { MarkdownDocumentIdentity } from './markdown-syntax-identity'
import type { MarkdownEmbedMode } from './markdown-embed-directive'
import { MARKDOWN_EMBED_BUDGET } from './markdown-embed-budget'

export type MarkdownEmbedProviderStatus =
  | 'idle'
  | 'pending'
  | 'resolved'
  | 'rejected'
  | 'stale'
  | 'forbidden'
  | 'missing'
  | 'deleted'
  | 'unsupported'
  | 'cancelled'
  | 'cycle'
  | 'depth-exceeded'
  | 'size-exceeded'
  | 'time-exceeded'
  | 'mode-mismatch'

/** Opaque consumer coordinates; the library never resolves or decodes them. */
export interface MarkdownEmbedTargetVersion {
  readonly targetIdentity: string
  readonly resolvedRevision: string
  readonly targetVersionIdentity: string
  readonly projectionIdentity: string
  readonly projectionDigest: string
}

export type MarkdownEmbedProjection = Readonly<
  | {
      readonly kind: 'markdown'
      readonly projectionIdentity: string
      readonly contentDigest: string
      readonly source: string
    }
  | {
      readonly kind: 'markdown-reference'
      readonly projectionIdentity: string
      readonly contentDigest: string
    }
>

export interface MarkdownEmbedRequest {
  readonly requestId: string
  readonly requestDigest?: string
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly nodeId: string
  readonly target: string
  readonly mode: MarkdownEmbedMode
  readonly version: number
  readonly signal?: AbortSignal
}

export interface MarkdownEmbedResult {
  readonly requestId: string
  readonly requestDigest?: string
  readonly status: MarkdownEmbedProviderStatus
  readonly target: string
  readonly mode: MarkdownEmbedMode
  readonly version: number
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly nodeId: string
  readonly title?: string
  readonly excerpt?: string
  readonly targetVersion?: MarkdownEmbedTargetVersion
  readonly projection?: MarkdownEmbedProjection
  readonly reason?:
    | 'invalid-result'
    | 'projection-unverified'
    | 'request-digest-required'
    | 'projection-digest-mismatch'
    | 'projection-unavailable'
}

export type MarkdownEmbedProvider = (
  request: MarkdownEmbedRequest,
) => Promise<MarkdownEmbedResult> | MarkdownEmbedResult

/** Already-authorized local data only; this is not a product API or a cache. */
export interface MarkdownEmbedProjectionAuthority {
  readonly readTargetVersion: (
    request: MarkdownEmbedRequest,
  ) => MarkdownEmbedTargetVersion | null
  readonly resolveMarkdown?: (
    reference: MarkdownEmbedProjection,
    request: MarkdownEmbedRequest,
  ) => string | Promise<string>
}

const requests = new Map<string, MarkdownEmbedRequest>()
const controllers = new WeakMap<object, AbortController>()
const externalLinks = new WeakMap<object, () => void>()
const failedExternalCleanup = new WeakSet<object>()
const externalCleanupInProgress = new WeakSet<object>()
interface EmbedProjectionWork {
  timer: ReturnType<typeof setTimeout> | undefined
  listeners: number
  settled: boolean
  finished: boolean
}
const projectionWork = new WeakMap<object, Set<EmbedProjectionWork>>()
let requestSequence = 0

export const forgetMarkdownEmbedRequest = (
  requestId: string,
  expected?: MarkdownEmbedRequest,
) => {
  const registered = requests.get(requestId)
  const request = expected ?? registered
  if (!request || request.requestId !== requestId) return
  // Detach this registration before invoking external cleanup: a callback may
  // admit another instance at the same id, which this cleanup must not remove.
  if (registered && registered.signal === request.signal)
    requests.delete(requestId)
  if (request?.signal) {
    // The original signal is still a cleanup capability after its registration
    // was detached. It never authorizes removal of a fresh same-id instance.
    if (externalCleanupInProgress.has(request.signal)) return
    const unlink = externalLinks.get(request.signal)
    externalCleanupInProgress.add(request.signal)
    externalLinks.delete(request.signal)
    try {
      unlink?.()
      failedExternalCleanup.delete(request.signal)
    } catch (error) {
      if (unlink) externalLinks.set(request.signal, unlink)
      failedExternalCleanup.add(request.signal)
      throw error
    } finally {
      externalCleanupInProgress.delete(request.signal)
    }
  }
}

export const cancelMarkdownEmbedRequest = (
  request: MarkdownEmbedRequest | string,
) => {
  const active = typeof request === 'string' ? requests.get(request) : request
  if (active?.signal) controllers.get(active.signal)?.abort()
  if (active) forgetMarkdownEmbedRequest(active.requestId, active)
}

/** Internal census of handles actually held for this request, including late work. */
export const inspectMarkdownEmbedRequestResources = (
  request: MarkdownEmbedRequest,
) => {
  if (request.signal && externalCleanupInProgress.has(request.signal))
    throw new Error('markdown-embed-listener-cleanup-in-progress')
  if (request.signal && failedExternalCleanup.has(request.signal))
    throw new Error('markdown-embed-listener-cleanup-unavailable')
  const work = [...(projectionWork.get(request.signal ?? request) ?? [])]
  return Object.freeze({
    registered: requests.get(request.requestId)?.signal === request.signal,
    backgroundTasks: work.length,
    timers: work.filter((entry) => entry.timer !== undefined).length,
    retainedListeners:
      work.reduce((count, entry) => count + entry.listeners, 0) +
      (request.signal &&
      !request.signal.aborted &&
      externalLinks.has(request.signal)
        ? 1
        : 0),
  })
}

export const createMarkdownEmbedRequest = (
  input: Omit<MarkdownEmbedRequest, 'requestId'> & {
    readonly requestId?: string
  },
): MarkdownEmbedRequest => {
  // Snapshot executable input properties before deciding registry admission.
  const snapshot = {
    requestId: input.requestId,
    documentIdentity: Object.freeze({ ...input.documentIdentity }),
    revision: input.revision,
    nodeId: input.nodeId,
    target: input.target,
    mode: input.mode,
    version: input.version,
    requestDigest: input.requestDigest,
    signal: input.signal,
  }
  const parentSignal = snapshot.signal
  const addListener = parentSignal?.addEventListener
  const removeListener = parentSignal?.removeEventListener
  const parentAborted = parentSignal?.aborted
  // The registry spans editors. Capacity pressure must not cancel another owner.
  if (requests.size >= MARKDOWN_EMBED_BUDGET.maxNodes) {
    throw new Error('markdown-embed-request-capacity-exceeded')
  }
  let requestId = snapshot.requestId
  if (requestId === undefined) {
    do {
      requestId = `embed-request:${++requestSequence}`
    } while (requests.has(requestId))
  } else if (requests.has(requestId)) {
    // A request id carries no authority to replace another live instance.
    throw new Error('markdown-embed-request-id-in-use')
  }
  const controller = new AbortController()
  if (parentAborted) controller.abort()
  else if (parentSignal) {
    const abort = () => controller.abort()
    const unlink = () => removeListener?.call(parentSignal, 'abort', abort)
    try {
      addListener!.call(parentSignal, 'abort', abort, {
        once: true,
        signal: controller.signal,
      })
      externalLinks.set(controller.signal, unlink)
      if (parentSignal.aborted) controller.abort()
    } catch (error) {
      try {
        unlink()
      } finally {
        controller.abort()
      }
      throw error
    }
  }
  controllers.set(controller.signal, controller)
  const request = Object.freeze({
    requestId,
    documentIdentity: snapshot.documentIdentity,
    revision: snapshot.revision,
    nodeId: snapshot.nodeId,
    target: snapshot.target,
    mode: snapshot.mode,
    version: snapshot.version,
    ...(snapshot.requestDigest !== undefined
      ? { requestDigest: snapshot.requestDigest }
      : {}),
    signal: controller.signal,
  })
  // Listener registration may reenter another request admission.
  if (
    requests.size >= MARKDOWN_EMBED_BUDGET.maxNodes ||
    requests.has(requestId)
  ) {
    const reason = requests.has(requestId)
      ? 'markdown-embed-request-id-in-use'
      : 'markdown-embed-request-capacity-exceeded'
    const unlink = externalLinks.get(controller.signal)
    externalLinks.delete(controller.signal)
    try {
      unlink?.()
    } finally {
      controller.abort()
    }
    throw new Error(reason)
  }
  requests.set(request.requestId, request)
  return request
}

const sha256 = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

/** New projection consumers get a digest of the entire immutable UI request. */
export const createMarkdownEmbedProjectionRequest = async (
  input: Parameters<typeof createMarkdownEmbedRequest>[0],
): Promise<MarkdownEmbedRequest> => {
  const request = createMarkdownEmbedRequest(input)
  return bindMarkdownEmbedRequestDigest(request)
}

/** Internal owner can retain the synchronous request while its digest is pending. */
export const bindMarkdownEmbedRequestDigest = async (
  request: MarkdownEmbedRequest,
): Promise<MarkdownEmbedRequest> => {
  if (request.requestDigest) return request
  try {
    const requestDigest = await sha256(
      new TextEncoder().encode(
        JSON.stringify([
          'fsusui.markdown-embed-request.v1',
          request.requestId,
          request.documentIdentity.id,
          request.documentIdentity.epoch,
          request.revision,
          request.nodeId,
          request.target,
          request.mode,
          request.version,
        ]),
      ),
    )
    const bound = Object.freeze({ ...request, requestDigest })
    if (requests.get(request.requestId) === request)
      requests.set(request.requestId, bound)
    return bound
  } catch (error) {
    cancelMarkdownEmbedRequest(request)
    throw error
  }
}

const isDataRecord = (
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return (
    (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === 'string' &&
        keys.includes(key) &&
        'value' in Object.getOwnPropertyDescriptor(value, key)!,
    )
  )
}

const RESULT_KEYS = [
  'requestId',
  'requestDigest',
  'documentIdentity',
  'revision',
  'nodeId',
  'target',
  'mode',
  'version',
  'signal',
  'status',
  'title',
  'excerpt',
  'targetVersion',
  'projection',
  'reason',
] as const
const STATUSES: readonly MarkdownEmbedProviderStatus[] = [
  'idle',
  'pending',
  'resolved',
  'rejected',
  'stale',
  'forbidden',
  'missing',
  'deleted',
  'unsupported',
  'cancelled',
  'cycle',
  'depth-exceeded',
  'size-exceeded',
  'time-exceeded',
  'mode-mismatch',
]
const isResult = (result: unknown): result is MarkdownEmbedResult =>
  isDataRecord(result, RESULT_KEYS) &&
  isDataRecord(result.documentIdentity, ['id', 'epoch']) &&
  STATUSES.includes(result.status as MarkdownEmbedProviderStatus) &&
  (result.title === undefined || typeof result.title === 'string') &&
  (result.excerpt === undefined || typeof result.excerpt === 'string')

const TARGET_KEYS = [
  'targetIdentity',
  'resolvedRevision',
  'targetVersionIdentity',
  'projectionIdentity',
  'projectionDigest',
] as const
const isTargetVersion = (value: unknown): value is MarkdownEmbedTargetVersion =>
  isDataRecord(value, TARGET_KEYS) &&
  TARGET_KEYS.every(
    (key) => typeof value[key] === 'string' && value[key].length > 0,
  ) &&
  /^[a-f0-9]{64}$/.test(value.projectionDigest as string)

const sameTargetVersion = (left: MarkdownEmbedTargetVersion, right: unknown) =>
  isTargetVersion(right) && TARGET_KEYS.every((key) => left[key] === right[key])

export const isMarkdownEmbedResultCurrent = (
  request: MarkdownEmbedRequest,
  result: MarkdownEmbedResult,
) =>
  isResult(result) &&
  !request.signal?.aborted &&
  result.requestId === request.requestId &&
  (result.requestDigest === request.requestDigest ||
    (result.requestDigest === undefined &&
      !result.projection &&
      !result.targetVersion)) &&
  result.documentIdentity.id === request.documentIdentity.id &&
  result.documentIdentity.epoch === request.documentIdentity.epoch &&
  result.revision === request.revision &&
  result.nodeId === request.nodeId &&
  result.target === request.target &&
  result.mode === request.mode &&
  result.version === request.version &&
  !request.signal?.aborted

interface ProjectionProof {
  readonly request: MarkdownEmbedRequest
  readonly authority: MarkdownEmbedProjectionAuthority
  readonly targetVersion: MarkdownEmbedTargetVersion
  readonly source: string
}
const projections = new WeakMap<object, ProjectionProof>()

const proofIsCurrent = (proof: ProjectionProof) => {
  if (proof.request.signal?.aborted) return false
  try {
    const readTargetVersion = proof.authority.readTargetVersion
    if (proof.request.signal?.aborted) return false
    const targetVersion = readTargetVersion.call(proof.authority, proof.request)
    const matches = sameTargetVersion(proof.targetVersion, targetVersion)
    // Both method lookup and invocation may synchronously revoke authority.
    return matches && !proof.request.signal?.aborted
  } catch {
    return false
  }
}

/** A private preparation receipt, rather than a supplied digest, authorizes bytes. */
export const readMarkdownEmbedProjection = (
  result: MarkdownEmbedResult,
): string | null => {
  const proof = projections.get(result)
  return proof && proofIsCurrent(proof) ? proof.source : null
}

const failure = (
  request: MarkdownEmbedRequest,
  status: MarkdownEmbedProviderStatus,
  reason?: MarkdownEmbedResult['reason'],
): MarkdownEmbedResult =>
  Object.freeze({ ...request, status, ...(reason ? { reason } : {}) })

export const commitMarkdownEmbedResult = (
  request: MarkdownEmbedRequest,
  result: MarkdownEmbedResult,
): MarkdownEmbedResult => {
  if (!isResult(result)) return failure(request, 'rejected', 'invalid-result')
  if (!isMarkdownEmbedResultCurrent(request, result))
    return failure(request, 'stale')
  if (result.projection !== undefined || result.targetVersion !== undefined) {
    const proof = projections.get(result)
    if (!proof) return failure(request, 'rejected', 'projection-unverified')
    if (!proofIsCurrent(proof)) return failure(request, 'stale')
  }
  Object.freeze(result.documentIdentity)
  Object.freeze(result)
  if (!isMarkdownEmbedResultCurrent(request, result))
    return failure(request, 'stale')
  return result
}

let resolvingProjections = 0

/** Verify a consumer-authorized reference against real Markdown bytes; never parse here. */
export const prepareMarkdownEmbedResult = async (
  request: MarkdownEmbedRequest,
  result: MarkdownEmbedResult,
  authority: MarkdownEmbedProjectionAuthority,
): Promise<MarkdownEmbedResult> => {
  if (!isResult(result)) return failure(request, 'rejected', 'invalid-result')
  if (!isMarkdownEmbedResultCurrent(request, result))
    return failure(request, 'stale')
  if (result.status !== 'resolved') {
    return result.projection || result.targetVersion
      ? failure(request, 'rejected', 'invalid-result')
      : result
  }
  if (!request.requestDigest || !/^[a-f0-9]{64}$/.test(request.requestDigest))
    return failure(request, 'rejected', 'request-digest-required')
  const projection = result.projection
  if (
    !isTargetVersion(result.targetVersion) ||
    !isDataRecord(projection, [
      'kind',
      'projectionIdentity',
      'contentDigest',
      'source',
    ])
  ) {
    return failure(request, 'rejected', 'invalid-result')
  }
  if (
    projection.kind !== 'markdown' &&
    projection.kind !== 'markdown-reference'
  )
    return failure(request, 'unsupported')
  if (
    projection.projectionIdentity !== result.targetVersion.projectionIdentity ||
    projection.contentDigest !== result.targetVersion.projectionDigest
  ) {
    return failure(request, 'rejected', 'projection-digest-mismatch')
  }
  const targetVersion = Object.freeze({ ...result.targetVersion })
  const reference = Object.freeze({ ...projection }) as MarkdownEmbedProjection
  const snapshot = Object.freeze({ ...result })
  const proof: ProjectionProof = {
    request,
    authority,
    targetVersion,
    source: '',
  }
  if (!proofIsCurrent(proof) || request.signal?.aborted)
    return failure(request, 'stale')
  if (resolvingProjections >= MARKDOWN_EMBED_BUDGET.maxConcurrent)
    return failure(request, 'rejected')
  const localController = new AbortController()
  let requestLinked = false
  let cancelLinked = false
  let workStarted = false
  let timedOut = false
  const expired = failure(request, 'time-exceeded')
  const handles: EmbedProjectionWork = {
    timer: undefined,
    listeners: 0,
    settled: false,
    finished: false,
  }
  const workKey = request.signal ?? request
  const workSet = projectionWork.get(workKey) ?? new Set<EmbedProjectionWork>()
  projectionWork.set(workKey, workSet)
  workSet.add(handles)
  let resolveCancelled!: (result: MarkdownEmbedResult) => void
  const cancelled = new Promise<MarkdownEmbedResult>((resolve) => {
    resolveCancelled = resolve
  })
  const onLocalAbort = () => {
    if (cancelLinked) {
      cancelLinked = false
      handles.listeners -= 1
    }
    resolveCancelled(timedOut ? expired : failure(request, 'stale'))
  }
  const abort = () => {
    if (requestLinked) {
      requestLinked = false
      handles.listeners -= 1
    }
    localController.abort()
  }
  try {
    // Install cancellation authority before invoking any consumer callback.
    localController.signal.addEventListener('abort', onLocalAbort, {
      once: true,
    })
    cancelLinked = true
    handles.listeners += 1
    if (request.signal) {
      if (request.signal.aborted) localController.abort()
      else {
        request.signal.addEventListener('abort', abort, { once: true })
        requestLinked = true
        handles.listeners += 1
        if (request.signal.aborted) abort()
      }
    }
    if (localController.signal.aborted) return await cancelled
    const verify = async (): Promise<MarkdownEmbedResult> => {
      if (!proofIsCurrent(proof) || localController.signal.aborted)
        return failure(request, 'stale')
      let source: string | undefined
      if (reference.kind === 'markdown') source = reference.source
      else {
        const resolveMarkdown = authority.resolveMarkdown
        const resolverRequest = Object.freeze({
          ...request,
          signal: localController.signal,
        })
        if (!proofIsCurrent(proof) || localController.signal.aborted)
          return failure(request, 'stale')
        source = await resolveMarkdown?.call(
          authority,
          reference,
          resolverRequest,
        )
      }
      if (timedOut) return expired
      if (!proofIsCurrent(proof) || localController.signal.aborted)
        return failure(request, 'stale')
      if (typeof source !== 'string')
        return failure(request, 'rejected', 'projection-unavailable')
      // Bound UTF-16 allocation before encoding, then enforce the existing UTF-8 budget.
      if (source.length > MARKDOWN_EMBED_BUDGET.maxBytes)
        return failure(request, 'size-exceeded')
      const bytes = new TextEncoder().encode(source)
      if (bytes.byteLength > MARKDOWN_EMBED_BUDGET.maxBytes)
        return failure(request, 'size-exceeded')
      if ((await sha256(bytes)) !== reference.contentDigest)
        return failure(request, 'rejected', 'projection-digest-mismatch')
      if (timedOut) return expired
      if (!proofIsCurrent(proof) || localController.signal.aborted)
        return failure(request, 'stale')
      const prepared = Object.freeze({
        ...snapshot,
        documentIdentity: Object.freeze({ ...request.documentIdentity }),
        targetVersion,
        projection: Object.freeze({
          kind: 'markdown' as const,
          projectionIdentity: targetVersion.projectionIdentity,
          contentDigest: targetVersion.projectionDigest,
          source,
        }),
      })
      if (!proofIsCurrent(proof) || localController.signal.aborted)
        return failure(request, 'stale')
      projections.set(prepared, { ...proof, source })
      return prepared
    }
    const timeout = new Promise<MarkdownEmbedResult>((resolve) => {
      handles.timer = setTimeout(() => {
        handles.timer = undefined
        timedOut = true
        localController.abort()
        resolve(expired)
      }, MARKDOWN_EMBED_BUDGET.maxMs)
    })
    workStarted = true
    resolvingProjections += 1
    const work = verify().finally(() => {
      resolvingProjections -= 1
      handles.settled = true
      if (handles.finished) workSet.delete(handles)
    })
    return await Promise.race([work, timeout, cancelled])
  } catch {
    return failure(request, 'rejected', 'projection-unavailable')
  } finally {
    if (handles.timer !== undefined) clearTimeout(handles.timer)
    handles.timer = undefined
    request.signal?.removeEventListener('abort', abort)
    if (requestLinked) {
      requestLinked = false
      handles.listeners -= 1
    }
    localController.signal.removeEventListener('abort', onLocalAbort)
    if (cancelLinked) {
      cancelLinked = false
      handles.listeners -= 1
    }
    localController.abort()
    if (!workStarted) handles.settled = true
    handles.finished = true
    if (handles.settled) workSet.delete(handles)
  }
}

export type MarkdownEmbedProviderMutationKind =
  | 'inferred-target'
  | 'library-owned-fetch'
  | 'mode-as-card'
  | 'stale-commit'
  | 'html-result'
  | 'provider-source-mutation'
  | 'target-only-cache'

export const evaluateMarkdownEmbedProviderMutations = (
  request: MarkdownEmbedRequest,
) => {
  const stale = commitMarkdownEmbedResult(request, {
    requestId: request.requestId,
    status: 'resolved',
    target: request.target,
    mode: request.mode,
    version: request.version + 1,
    documentIdentity: request.documentIdentity,
    revision: request.revision,
    nodeId: request.nodeId,
    title: 'stale',
  })
  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'inferred-target' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'library-owned-fetch' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'mode-as-card' as const,
        equivalent: request.mode === 'article',
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-commit' as const,
        equivalent: stale.status === 'resolved',
        accepted: false,
      }),
      Object.freeze({
        kind: 'html-result' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'provider-source-mutation' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'target-only-cache' as const,
        equivalent:
          `${request.target}` ===
          `${request.target}:${request.mode}:${request.version}`,
        accepted: false,
      }),
    ]),
  })
}
