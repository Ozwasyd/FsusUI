import type { MarkdownDocumentIdentity } from './markdown-syntax-identity'
import type { MarkdownEmbedMode } from './markdown-embed-directive'

export type MarkdownEmbedProviderStatus =
  | 'idle'
  | 'pending'
  | 'resolved'
  | 'rejected'
  | 'stale'
  | 'forbidden'
  | 'missing'
  | 'cycle'
  | 'depth-exceeded'
  | 'size-exceeded'
  | 'time-exceeded'
  | 'mode-mismatch'

export interface MarkdownEmbedRequest {
  readonly requestId: string
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly nodeId: string
  readonly target: string
  readonly mode: MarkdownEmbedMode
  readonly version: number
}

export interface MarkdownEmbedResult {
  readonly requestId: string
  readonly status: MarkdownEmbedProviderStatus
  readonly target: string
  readonly mode: MarkdownEmbedMode
  readonly version: number
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly nodeId: string
  readonly title?: string
  readonly excerpt?: string
}

export type MarkdownEmbedProvider = (
  request: MarkdownEmbedRequest,
) => Promise<MarkdownEmbedResult> | MarkdownEmbedResult

const requests = new Map<string, MarkdownEmbedRequest>()

export const createMarkdownEmbedRequest = (
  input: Omit<MarkdownEmbedRequest, 'requestId'> & { readonly requestId?: string },
): MarkdownEmbedRequest => {
  const request = Object.freeze({
    requestId:
      input.requestId ??
      `${input.documentIdentity.id}:${input.revision}:${input.nodeId}:${input.version}`,
    documentIdentity: input.documentIdentity,
    revision: input.revision,
    nodeId: input.nodeId,
    target: input.target,
    mode: input.mode,
    version: input.version,
  })
  requests.set(request.requestId, request)
  return request
}

export const isMarkdownEmbedResultCurrent = (
  request: MarkdownEmbedRequest,
  result: MarkdownEmbedResult,
) =>
  result.requestId === request.requestId &&
  result.documentIdentity.id === request.documentIdentity.id &&
  result.documentIdentity.epoch === request.documentIdentity.epoch &&
  result.revision === request.revision &&
  result.nodeId === request.nodeId &&
  result.target === request.target &&
  result.mode === request.mode &&
  result.version === request.version

export const commitMarkdownEmbedResult = (
  request: MarkdownEmbedRequest,
  result: MarkdownEmbedResult,
): MarkdownEmbedResult => {
  if (!isMarkdownEmbedResultCurrent(request, result)) {
    return Object.freeze({ ...result, status: 'stale' as const })
  }
  return result
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
