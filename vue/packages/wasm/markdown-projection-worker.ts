import {
  createMarkdownEditorProjection,
  transferMarkdownEditorProjection,
  type MarkdownEditorProjectionResult,
} from './markdown-editor-projection'
import {
  createMarkdownProjectionSession,
  type MarkdownProjectionChange,
  type MarkdownProjectionInvalidationPlan,
  type MarkdownProjectionSession,
  type MarkdownProjectionTaskCommitErr,
  type MarkdownProjectionTaskCommitOk,
  type MarkdownProjectionTaskFailure,
} from './markdown-projection-invalidation'
import { MarkdownRuntimeError } from './markdown-runtime-error'
import {
  createMarkdownSyntaxIdentityResolver,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
  type MarkdownSyntaxIdentityState,
} from './markdown-syntax-identity'

export const MARKDOWN_PROJECTION_WORKER_REQUEST = 'project' as const
export const MARKDOWN_PROJECTION_WORKER_RESULT = 'result' as const

export interface MarkdownProjectionWorkerSnapshotNode {
  readonly id: string
  readonly kind: string
  readonly normalizedRange: { readonly start: number; readonly end: number }
  readonly rawRange: { readonly start: number; readonly end: number }
}

export interface MarkdownProjectionWorkerSnapshot {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly identityState?: MarkdownSyntaxIdentityState
  readonly normalizedSource: string
  readonly nodes: readonly MarkdownProjectionWorkerSnapshotNode[]
}

export interface MarkdownProjectionWorkerRequest {
  readonly type: typeof MARKDOWN_PROJECTION_WORKER_REQUEST
  readonly taskId: string
  readonly revision: number
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly source: string
  readonly change?: MarkdownProjectionChange
  readonly plan: Pick<
    MarkdownProjectionInvalidationPlan,
    | 'taskId'
    | 'revision'
    | 'documentIdentity'
    | 'expanded'
    | 'reason'
    | 'invalidatedRanges'
    | 'invalidatedNodeIds'
    | 'retainedNodeIds'
  >
  readonly previous: MarkdownProjectionWorkerSnapshot
}

export interface MarkdownProjectionWorkerResult {
  readonly type: typeof MARKDOWN_PROJECTION_WORKER_RESULT
  readonly taskId: string
  readonly revision: number
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly sourceIdentity: string
  readonly parser: string
  readonly version: string
  readonly nodeIds: readonly string[]
  readonly kinds: readonly string[]
  readonly retainedCurrentIds: readonly string[]
  readonly projection: MarkdownEditorProjectionResult
}

export interface MarkdownProjectionWorkerPort {
  post(request: MarkdownProjectionWorkerRequest): void
}

export interface MarkdownProjectionWorkerScope {
  onmessage: ((event: { readonly data: unknown }) => void) | null
  postMessage(message: unknown): void
  addEventListener?(
    type: 'message',
    listener: (event: { readonly data: unknown }) => void,
  ): void
  on?(type: 'message', listener: (data: unknown) => void): void
}

const sameIdentity = (
  left: MarkdownDocumentIdentity,
  right: MarkdownDocumentIdentity,
) => left.id === right.id && left.epoch === right.epoch

export const isMarkdownProjectionWorkerRequest = (
  value: unknown,
): value is MarkdownProjectionWorkerRequest => {
  if (Object(value) !== value) return false
  const request = value as MarkdownProjectionWorkerRequest
  return (
    request.type === MARKDOWN_PROJECTION_WORKER_REQUEST &&
    typeof request.taskId === 'string' &&
    Number.isInteger(request.revision) &&
    typeof request.source === 'string' &&
    Boolean(request.documentIdentity?.id) &&
    Boolean(request.plan?.taskId) &&
    Boolean(request.previous?.documentIdentity?.id)
  )
}

export const isMarkdownProjectionWorkerResult = (
  value: unknown,
): value is MarkdownProjectionWorkerResult => {
  if (Object(value) !== value) return false
  const result = value as MarkdownProjectionWorkerResult
  return (
    result.type === MARKDOWN_PROJECTION_WORKER_RESULT &&
    typeof result.taskId === 'string' &&
    Number.isInteger(result.revision) &&
    Boolean(result.documentIdentity?.id) &&
    Array.isArray(result.nodeIds) &&
    Object(result.projection) === result.projection
  )
}

export const snapshotMarkdownStableProjection = (
  projection: MarkdownStableProjection,
): MarkdownProjectionWorkerSnapshot =>
  Object.freeze({
    documentIdentity: Object.freeze({
      id: projection.documentIdentity.id,
      epoch: projection.documentIdentity.epoch,
    }),
    identityState: Object.freeze({
      nextOrdinalByKind: Object.freeze({
        ...projection.identityState.nextOrdinalByKind,
      }),
    }),
    normalizedSource: projection.normalizedSource,
    nodes: Object.freeze(
      projection.nodes.map((node) =>
        Object.freeze({
          id: node.id,
          kind: node.kind,
          normalizedRange: Object.freeze({
            start: node.normalizedRange.start,
            end: node.normalizedRange.end,
          }),
          rawRange: Object.freeze({
            start: node.rawRange.start,
            end: node.rawRange.end,
          }),
        }),
      ),
    ),
  })

export const reviveMarkdownStableProjection = (
  snapshot: MarkdownProjectionWorkerSnapshot,
): MarkdownStableProjection => {
  const nodes = snapshot.nodes.map((node) =>
    Object.freeze({
      id: node.id,
      kind: node.kind,
      blockIdentity: `worker-snapshot:${node.id}`,
      status: 'valid',
      diagnosticCode: null,
      presentation: 'live-decorated',
      normalizedRange: node.normalizedRange,
      rawRange: node.rawRange,
      rawContentRanges: Object.freeze([node.rawRange]),
      normalizedContentRanges: Object.freeze([node.normalizedRange]),
      rawMarkerRanges: Object.freeze([]),
      normalizedMarkerRanges: Object.freeze([]),
      parentRawRange: null,
      parentNormalizedRange: null,
      childRawRanges: Object.freeze([]),
      childNormalizedRanges: Object.freeze([]),
    }),
  ) as MarkdownStableSyntaxNode[]
  const documentIdentity = Object.freeze({
    id: snapshot.documentIdentity.id,
    epoch: snapshot.documentIdentity.epoch,
  })
  const nextOrdinalByKind = { ...snapshot.identityState?.nextOrdinalByKind }
  for (const node of nodes) {
    const parts = node.id.split(':')
    const kind = parts[parts.length - 2]
    const ordinal = Number(parts[parts.length - 1])
    if (!kind || !Number.isInteger(ordinal) || ordinal < 0) continue
    nextOrdinalByKind[kind] = Math.max(
      nextOrdinalByKind[kind] ?? 0,
      ordinal + 1,
    )
  }
  return Object.freeze({
    documentIdentity,
    identityState: Object.freeze({
      nextOrdinalByKind: Object.freeze(nextOrdinalByKind),
    }),
    normalizedSource: snapshot.normalizedSource,
    nodes: Object.freeze(nodes),
    resolve: createMarkdownSyntaxIdentityResolver(documentIdentity, nodes),
  })
}

export const handleMarkdownProjectionWorkerMessage = (
  data: unknown,
): MarkdownProjectionWorkerResult | null => {
  if (!isMarkdownProjectionWorkerRequest(data)) return null
  return projectMarkdownOnWorker(data)
}

export const bindMarkdownProjectionWorkerScope = (
  scope: MarkdownProjectionWorkerScope,
) => {
  const onMessage = (event: { readonly data: unknown } | unknown) => {
    const data =
      event && typeof event === 'object' && 'data' in event
        ? (event as { data: unknown }).data
        : event
    const result = handleMarkdownProjectionWorkerMessage(data)
    if (result) scope.postMessage(result)
  }
  scope.onmessage = onMessage
  scope.addEventListener?.('message', onMessage)
  scope.on?.('message', (data) => onMessage({ data }))
}

export const connectMarkdownProjectionWorker = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision?: number
  readonly worker: Pick<MarkdownProjectionWorkerScope, 'postMessage'> &
    Partial<
      Pick<
        MarkdownProjectionWorkerScope,
        'onmessage' | 'on' | 'addEventListener'
      >
    >
  readonly onCommit?: (
    result:
      | MarkdownProjectionTaskCommitOk<MarkdownProjectionWorkerResult>
      | MarkdownProjectionTaskCommitErr,
  ) => void
}): MarkdownProjectionWorkerHost => {
  const host = createMarkdownProjectionWorkerHost({
    documentIdentity: input.documentIdentity,
    revision: input.revision,
    port: {
      post(request) {
        input.worker.postMessage(request)
      },
    },
  })
  const onReply = (data: unknown) => {
    input.onCommit?.(host.accept(data))
  }
  if (typeof input.worker.on === 'function') {
    input.worker.on('message', onReply)
  } else if (typeof input.worker.addEventListener === 'function') {
    input.worker.addEventListener('message', (event) => onReply(event.data))
  } else {
    input.worker.onmessage = (event) => onReply(event.data)
  }
  return host
}

export const projectMarkdownOnWorker = (
  request: MarkdownProjectionWorkerRequest,
): MarkdownProjectionWorkerResult => {
  if (!isMarkdownProjectionWorkerRequest(request)) {
    throw new MarkdownRuntimeError(
      'protocol',
      'invalid projection worker request',
    )
  }
  const projection = createMarkdownEditorProjection(request.source)
  const stable = stabilizeMarkdownEditorProjection(
    projection,
    request.documentIdentity,
    reviveMarkdownStableProjection(request.previous),
    request.change,
  )
  return Object.freeze({
    type: MARKDOWN_PROJECTION_WORKER_RESULT,
    taskId: request.taskId,
    revision: request.revision,
    documentIdentity: Object.freeze({
      id: request.documentIdentity.id,
      epoch: request.documentIdentity.epoch,
    }),
    sourceIdentity: projection.identity.sourceIdentity,
    parser: projection.identity.parser,
    version: projection.identity.version,
    nodeIds: Object.freeze(stable.nodes.map((node) => node.id)),
    kinds: Object.freeze(stable.nodes.map((node) => node.kind)),
    retainedCurrentIds: Object.freeze(
      request.plan.retainedNodeIds.filter(
        (id) => stable.resolve(id).status === 'current',
      ),
    ),
    projection: transferMarkdownEditorProjection(projection),
  })
}

export interface MarkdownProjectionWorkerHost {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly session: MarkdownProjectionSession
  dispatch(input: {
    readonly previous: MarkdownStableProjection
    readonly previousSource: string
    readonly change: MarkdownProjectionChange
    readonly source: string
  }): MarkdownProjectionInvalidationPlan
  accept(
    reply: unknown,
  ):
    | MarkdownProjectionTaskCommitOk<MarkdownProjectionWorkerResult>
    | MarkdownProjectionTaskCommitErr
  replaceDocument(identity: MarkdownDocumentIdentity): void
}

export const createMarkdownProjectionWorkerHost = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision?: number
  readonly port: MarkdownProjectionWorkerPort
}): MarkdownProjectionWorkerHost => {
  let session = createMarkdownProjectionSession({
    documentIdentity: input.documentIdentity,
    revision: input.revision,
  })

  return {
    get documentIdentity() {
      return session.documentIdentity
    },
    get revision() {
      return session.revision
    },
    get session() {
      return session
    },
    dispatch(payload) {
      const plan = session.plan(
        payload.previous,
        payload.previousSource,
        payload.change,
      )
      const task = session.begin(plan)
      input.port.post(
        Object.freeze({
          type: MARKDOWN_PROJECTION_WORKER_REQUEST,
          taskId: task.taskId,
          revision: plan.revision,
          documentIdentity: plan.documentIdentity,
          source: payload.source,
          change: Object.freeze({ ...payload.change }),
          plan: Object.freeze({
            taskId: plan.taskId,
            revision: plan.revision,
            documentIdentity: plan.documentIdentity,
            expanded: plan.expanded,
            reason: plan.reason,
            invalidatedRanges: plan.invalidatedRanges,
            invalidatedNodeIds: plan.invalidatedNodeIds,
            retainedNodeIds: plan.retainedNodeIds,
          }),
          previous: snapshotMarkdownStableProjection(payload.previous),
        }),
      )
      return plan
    },
    accept(reply) {
      if (!isMarkdownProjectionWorkerResult(reply)) {
        return {
          ok: false as const,
          reason: 'aborted' as MarkdownProjectionTaskFailure,
        }
      }
      if (!sameIdentity(reply.documentIdentity, session.documentIdentity)) {
        return { ok: false as const, reason: 'document-switch' as const }
      }
      const task = session.currentTask
      if (!task) {
        return { ok: false as const, reason: 'aborted' as const }
      }
      if (reply.taskId !== task.taskId) {
        return { ok: false as const, reason: 'aborted' as const }
      }
      return task.commit(
        {
          revision: session.revision,
          documentIdentity: session.documentIdentity,
        },
        reply,
      )
    },
    replaceDocument(identity) {
      session.currentTask?.abort()
      session = createMarkdownProjectionSession({ documentIdentity: identity })
    },
  }
}
