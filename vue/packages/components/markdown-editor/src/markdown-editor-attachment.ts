import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'

export type MarkdownAttachmentIntent = 'pick' | 'paste' | 'drop'

export interface MarkdownAttachmentAnchor {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly nodeId: string | null
  readonly sourceOffset: number
}

export interface MarkdownAttachmentProviderRequest {
  readonly requestId: string
  readonly intent: MarkdownAttachmentIntent
  readonly anchor: MarkdownAttachmentAnchor
  readonly mimeType: string
}

export type MarkdownAttachmentProvider = (
  request: MarkdownAttachmentProviderRequest,
) => Promise<{ readonly href: string; readonly version: number }>

export const createMarkdownAttachmentRequest = (
  intent: MarkdownAttachmentIntent,
  anchor: MarkdownAttachmentAnchor,
  mimeType: string,
): MarkdownAttachmentProviderRequest =>
  Object.freeze({
    requestId: `${anchor.documentIdentity.id}:${anchor.revision}:${anchor.sourceOffset}:${intent}`,
    intent,
    anchor,
    mimeType,
  })

export type MarkdownAttachmentMutationKind =
  | 'library-owned-upload'
  | 'inferred-provider'
  | 'unstable-id'

export const evaluateMarkdownAttachmentMutations = (
  request: MarkdownAttachmentProviderRequest,
) =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'library-owned-upload' as const,
        equivalent: request.requestId.startsWith('upload:'),
        accepted: false,
      }),
      Object.freeze({
        kind: 'inferred-provider' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'unstable-id' as const,
        equivalent: request.requestId.includes('Math.random'),
        accepted: false,
      }),
    ]),
  })
