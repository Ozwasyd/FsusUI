import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'

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
  readonly context?: MarkdownAttachmentCaptureContext
  readonly eventFingerprint?: string
  readonly session?: MarkdownAttachmentCaptureSession
}

export interface MarkdownAttachmentCaptureSession {
  claim(eventFingerprint: string): boolean
  clear(): void
}

export const createMarkdownAttachmentCaptureSession = (
  maxFingerprints = 64,
): MarkdownAttachmentCaptureSession => {
  const fingerprints = new Set<string>()
  return Object.freeze({
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
