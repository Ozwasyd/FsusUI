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
let requestSequence = 0

export const forgetMarkdownEmbedRequest = (requestId: string) => {
  const request = requests.get(requestId)
  if (request?.signal) externalLinks.get(request.signal)?.()
  requests.delete(requestId)
}

export const cancelMarkdownEmbedRequest = (
  request: MarkdownEmbedRequest | string,
) => {
  const active = typeof request === 'string' ? requests.get(request) : request
  if (active?.signal) controllers.get(active.signal)?.abort()
  if (active) requests.delete(active.requestId)
}

export const createMarkdownEmbedRequest = (
  input: Omit<MarkdownEmbedRequest, 'requestId'> & {
    readonly requestId?: string
  },
): MarkdownEmbedRequest => {
  const controller = new AbortController()
  if (input.signal?.aborted) controller.abort()
  else if (input.signal) {
    const abort = () => controller.abort()
    input.signal.addEventListener('abort', abort, {
      once: true,
      signal: controller.signal,
    })
    externalLinks.set(controller.signal, () =>
      input.signal?.removeEventListener('abort', abort),
    )
  }
  controllers.set(controller.signal, controller)
  const request = Object.freeze({
    requestId: input.requestId ?? `embed-request:${++requestSequence}`,
    documentIdentity: Object.freeze({ ...input.documentIdentity }),
    revision: input.revision,
    nodeId: input.nodeId,
    target: input.target,
    mode: input.mode,
    version: input.version,
    ...(input.requestDigest !== undefined
      ? { requestDigest: input.requestDigest }
      : {}),
    signal: controller.signal,
  })
  const previous = requests.get(request.requestId)
  if (previous) cancelMarkdownEmbedRequest(previous)
  while (requests.size >= MARKDOWN_EMBED_BUDGET.maxNodes) {
    cancelMarkdownEmbedRequest(requests.keys().next().value!)
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
  result.version === request.version

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
    return sameTargetVersion(
      proof.targetVersion,
      proof.authority.readTargetVersion(proof.request),
    )
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
  const localController = new AbortController()
  request.signal?.addEventListener('abort', () => localController.abort(), {
    once: true,
    signal: localController.signal,
  })
  const proof: ProjectionProof = {
    request,
    authority,
    targetVersion,
    source: '',
  }
  if (!proofIsCurrent(proof)) return failure(request, 'stale')
  if (resolvingProjections >= MARKDOWN_EMBED_BUDGET.maxConcurrent)
    return failure(request, 'rejected')
  resolvingProjections += 1
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const expired = failure(request, 'time-exceeded')
  try {
    const verify = async (): Promise<MarkdownEmbedResult> => {
      const source =
        reference.kind === 'markdown'
          ? reference.source
          : await authority.resolveMarkdown?.(
              reference,
              Object.freeze({
                ...request,
                signal: localController.signal,
              }),
            )
      if (timedOut) return expired
      if (!proofIsCurrent(proof)) return failure(request, 'stale')
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
      if (!proofIsCurrent(proof)) return failure(request, 'stale')
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
      projections.set(prepared, { ...proof, source })
      return prepared
    }
    const timeout = new Promise<MarkdownEmbedResult>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true
        localController.abort()
        resolve(expired)
      }, MARKDOWN_EMBED_BUDGET.maxMs)
    })
    const work = verify().finally(() => {
      resolvingProjections -= 1
    })
    const cancelled = new Promise<MarkdownEmbedResult>((resolve) => {
      localController.signal.addEventListener(
        'abort',
        () => {
          resolve(timedOut ? expired : failure(request, 'stale'))
        },
        { once: true },
      )
    })
    return await Promise.race([work, timeout, cancelled])
  } catch {
    return failure(request, 'rejected', 'projection-unavailable')
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    localController.abort()
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
