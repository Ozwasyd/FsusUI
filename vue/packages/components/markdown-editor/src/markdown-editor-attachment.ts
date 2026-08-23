import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'

export type MarkdownAttachmentSourceKind = 'pick' | 'paste' | 'drop'

/** @deprecated Use MarkdownAttachmentSourceKind. */
export type MarkdownAttachmentIntent = MarkdownAttachmentSourceKind

export type MarkdownAttachmentItemKind = 'image' | 'file' | 'audio' | 'video' | 'unknown'

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
      readonly status: Exclude<MarkdownAttachmentProviderStatus, 'resolved' | 'pending'>
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
}) => Promise<MarkdownAttachmentProviderResult> | MarkdownAttachmentProviderResult

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
}): MarkdownAttachmentBatchIntent => {
  const signal = input.signal ?? new AbortController().signal
  const batchId = [
    input.documentIdentity.id,
    input.documentIdentity.epoch,
    input.revision,
    input.nodeId ?? 'doc',
    input.sourceKind,
    String(input.items.length),
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

export const markdownFromAttachmentPayload = (payload: MarkdownAttachmentResolvedPayload) => {
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
    return Object.freeze({ accepted: false as const, status: 'document-abort' as const })
  }
  if (result.status === 'document-abort') {
    return Object.freeze({ accepted: false as const, status: 'document-abort' as const })
  }
  if (typeof result.revision === 'number' && result.revision !== input.revision) {
    return Object.freeze({ accepted: false as const, status: 'stale' as const })
  }
  if (input.nodeStatus === 'deleted' || input.nodeStatus === 'invalid') {
    return Object.freeze({ accepted: false as const, status: 'deleted' as const })
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
    return Object.freeze({ accepted: false as const, status: 'unsafe' as const, code: 'non-markdown-result' })
  }
  const markdown = markdownFromAttachmentPayload(result.payload)
  if (!markdown || /<[a-z]/i.test(markdown)) {
    return Object.freeze({ accepted: false as const, status: 'unsafe' as const, code: 'unsafe-payload' })
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
        progress: result.status === 'progress' ? (result.ratio ?? 0) : previous?.progress ?? 0,
        ...(result.status !== 'resolved' && result.status !== 'progress' && result.code
          ? { code: result.code }
          : {}),
      }),
    )
  }
  const query = (itemId: string): MarkdownAttachmentQueryState | undefined => states.get(itemId)
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
        equivalent: filesField || Array.isArray((batch as { files?: unknown }).files),
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
        equivalent: Boolean(bare && !batch.anchor.nodeId && batch.anchor.range === undefined),
        accepted: false,
      }),
    ]),
  })
}
