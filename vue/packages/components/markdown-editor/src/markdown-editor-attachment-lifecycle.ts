import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'
import type {
  MarkdownAttachmentAnchor,
  MarkdownAttachmentBatchIntent,
  MarkdownAttachmentItemIntent,
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

export const createMarkdownAttachmentJob = (
  id: string,
  options?: {
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
  batchId: options?.batchId,
  itemId: options?.itemId ?? id,
  documentIdentity: options?.documentIdentity,
  revision: options?.revision,
  attempt: options?.attempt ?? 1,
  phase: 'pending',
  progress: 0,
  range: options?.range ? { ...options.range } : undefined,
  signalController: options?.signalController,
})

export const formatMarkdownAttachmentPendingSource = (
  item: MarkdownAttachmentItemIntent,
): string => {
  if (item.kind === 'image') {
    return `![Uploading ${item.name}...]()`
  }
  return `[Uploading ${item.name}...]()`
}

export const planMarkdownAttachmentInsert = (
  source: string,
  anchor: MarkdownAttachmentAnchor,
  batch: MarkdownAttachmentBatchIntent,
): {
  readonly transaction: MarkdownEditorTransaction
  readonly jobs: readonly MarkdownAttachmentJob[]
} => {
  const pieces: string[] = []
  const jobs: MarkdownAttachmentJob[] = []
  let currentOffset = anchor.range.start

  for (let index = 0; index < batch.items.length; index += 1) {
    const item = batch.items[index]!
    const formatted = formatMarkdownAttachmentPendingSource(item)
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
      minimumLength +=
        change.insert.length - (change.to - change.from)
      syntheticSource = ''.padStart(Math.max(minimumLength, change.to + 1), '\u0000')
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
  if (
    result.documentIdentity &&
    job.documentIdentity &&
    (result.documentIdentity.id !== job.documentIdentity.id ||
      result.documentIdentity.epoch !== job.documentIdentity.epoch)
  ) {
    job.phase = 'document-abort'
    return Object.freeze({ accepted: false, status: 'document-abort' as const })
  }

  if (job.phase === 'deleted') {
    return Object.freeze({ accepted: false, status: 'deleted' as const })
  }

  if (job.phase === 'cancelled') {
    return Object.freeze({ accepted: false, status: 'cancelled' as const })
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
  if (job.phase === 'cancelled' || job.phase === 'deleted') return job
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

export const retryMarkdownAttachmentJob = (job: MarkdownAttachmentJob) => {
  job.phase = 'pending'
  job.progress = 0
  job.attempt += 1
  job.code = undefined
  job.message = undefined
  return job
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
