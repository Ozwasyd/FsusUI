import {
  convertMarkdownHtmlImportSnapshot,
  type MarkdownHtmlAttachmentDescriptor,
  type MarkdownHtmlLoss,
} from '../../../wasm/markdown-html-convert'
import type { MarkdownHtmlImportSnapshot } from '../../../wasm/markdown-html-import'
import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'
import {
  createMarkdownAttachmentBatch,
  type MarkdownAttachmentBatchIntent,
} from './markdown-editor-attachment'
import type {
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'

export type MarkdownPasteAsMarkdownChoice = 'plain-text' | 'markdown-import' | 'cancel'

export type MarkdownPasteAsMarkdownRejection =
  | 'not-explicit'
  | 'stale'
  | 'composition-active'
  | 'readonly'
  | 'disabled'
  | 'preview-only'
  | 'cancelled'

export interface MarkdownPasteAsMarkdownAnchor {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly source: string
  readonly selection: MarkdownEditorSelection
}

export interface MarkdownPasteAsMarkdownPreview {
  readonly markdown: string
  readonly plainText: string
  readonly losses: readonly MarkdownHtmlLoss[]
  readonly warnings: readonly MarkdownHtmlLoss[]
  readonly attachments: readonly MarkdownHtmlAttachmentDescriptor[]
  readonly diff: { readonly before: string; readonly after: string }
  readonly choices: readonly MarkdownPasteAsMarkdownChoice[]
  readonly focusReturn: 'editor'
  readonly selection: MarkdownEditorSelection
}

export interface MarkdownPasteAsMarkdownSession {
  readonly sessionId: string
  readonly explicit: true
  readonly preview: MarkdownPasteAsMarkdownPreview
  readonly anchor: MarkdownPasteAsMarkdownAnchor
  readonly attachmentBatch: MarkdownAttachmentBatchIntent | null
  confirmed: boolean
}

export type MarkdownPasteAsMarkdownOpenResult =
  | { readonly ok: true; readonly session: MarkdownPasteAsMarkdownSession }
  | { readonly ok: false; readonly rejected: MarkdownPasteAsMarkdownRejection }

const gate = (input: {
  readonly explicit: boolean
  readonly composition?: boolean
  readonly readonly?: boolean
  readonly disabled?: boolean
  readonly previewOnly?: boolean
}): MarkdownPasteAsMarkdownRejection | undefined => {
  if (!input.explicit) return 'not-explicit'
  if (input.composition) return 'composition-active'
  if (input.readonly) return 'readonly'
  if (input.disabled) return 'disabled'
  if (input.previewOnly) return 'preview-only'
  return undefined
}

const sameAnchor = (expected: MarkdownPasteAsMarkdownAnchor, actual: MarkdownPasteAsMarkdownAnchor) =>
  expected.documentIdentity.id === actual.documentIdentity.id &&
  expected.documentIdentity.epoch === actual.documentIdentity.epoch &&
  expected.revision === actual.revision &&
  expected.source === actual.source &&
  expected.selection.start === actual.selection.start &&
  expected.selection.end === actual.selection.end &&
  (expected.selection.direction ?? 'none') ===
    (actual.selection.direction ?? 'none')

const insertAt = (source: string, selection: MarkdownEditorSelection, insert: string) =>
  `${source.slice(0, selection.start)}${insert}${source.slice(selection.end)}`

export const openMarkdownPasteAsMarkdown = (input: {
  readonly explicit: boolean
  readonly snapshot: MarkdownHtmlImportSnapshot
  readonly anchor: MarkdownPasteAsMarkdownAnchor
  readonly composition?: boolean
  readonly readonly?: boolean
  readonly disabled?: boolean
  readonly previewOnly?: boolean
}): MarkdownPasteAsMarkdownOpenResult => {
  const blocked = gate(input)
  if (blocked) return Object.freeze({ ok: false, rejected: blocked })
  const snapshot: MarkdownHtmlImportSnapshot = Object.freeze({
    explicit: input.snapshot.explicit,
    html: input.snapshot.html,
    markdown: input.snapshot.markdown,
    plain: input.snapshot.plain,
    sourceApplication: input.snapshot.sourceApplication,
  })
  const converted = convertMarkdownHtmlImportSnapshot({
    ...snapshot,
    explicit: true,
  })
  const markdown = converted.markdown.replace(/\n+$/, '')
  const plainText = snapshot.plain ?? markdown
  const before = input.anchor.source
  const after = insertAt(before, input.anchor.selection, markdown)
  const attachmentBatch =
    converted.attachments.length === 0
      ? null
      : createMarkdownAttachmentBatch({
          sourceKind: 'paste',
          documentIdentity: input.anchor.documentIdentity,
          revision: input.anchor.revision,
          range: {
            start: input.anchor.selection.start,
            end: input.anchor.selection.end,
          },
          items: converted.attachments.map((item) => ({
            mimeType: item.href ? 'image/*' : 'application/octet-stream',
            name: item.alt || 'attachment',
            byteLength: 0,
            kind: 'image',
          })),
        })
  const preview: MarkdownPasteAsMarkdownPreview = Object.freeze({
    markdown,
    plainText,
    losses: converted.losses,
    warnings: converted.losses,
    attachments: converted.attachments,
    diff: Object.freeze({ before, after }),
    choices: Object.freeze(['plain-text', 'markdown-import', 'cancel'] as const),
    focusReturn: 'editor',
    selection: input.anchor.selection,
  })
  return Object.freeze({
    ok: true,
    session: {
      sessionId: `${input.anchor.documentIdentity.id}:${input.anchor.revision}:paste-md`,
      explicit: true as const,
      preview,
      anchor: input.anchor,
      attachmentBatch,
      confirmed: false,
    },
  })
}

export const cancelMarkdownPasteAsMarkdown = (session: MarkdownPasteAsMarkdownSession) => {
  session.confirmed = false
  return Object.freeze({
    rejected: 'cancelled' as const,
    source: session.anchor.source,
    selection: session.anchor.selection,
    focusReturn: 'editor' as const,
  })
}

export const confirmMarkdownPasteAsMarkdown = (
  session: MarkdownPasteAsMarkdownSession,
  choice: MarkdownPasteAsMarkdownChoice,
  current: MarkdownPasteAsMarkdownAnchor,
):
  | { readonly rejected: MarkdownPasteAsMarkdownRejection; readonly source: string }
  | {
      readonly accepted: true
      readonly source: string
      readonly transaction: MarkdownEditorTransaction
      readonly attachmentBatch: MarkdownAttachmentBatchIntent | null
      readonly focusReturn: 'editor'
    } => {
  if (choice === 'cancel') {
    const cancelled = cancelMarkdownPasteAsMarkdown(session)
    return { rejected: cancelled.rejected, source: cancelled.source }
  }
  if (!sameAnchor(session.anchor, current)) {
    return { rejected: 'stale', source: current.source }
  }
  const insert = choice === 'plain-text' ? session.preview.plainText : session.preview.markdown
  const next = insertAt(session.anchor.source, session.anchor.selection, insert)
  const caret = session.anchor.selection.start + insert.length
  session.confirmed = true
  return Object.freeze({
    accepted: true as const,
    source: next,
    attachmentBatch: choice === 'markdown-import' ? session.attachmentBatch : null,
    focusReturn: 'editor' as const,
    transaction: Object.freeze({
      changes: Object.freeze([
        Object.freeze({
          from: session.anchor.selection.start,
          to: session.anchor.selection.end,
          insert,
        }),
      ]),
      expectedRevision: session.anchor.revision,
      history: 'separate' as const,
      origin: 'command' as const,
      metadata: Object.freeze({ command: 'paste-as-markdown', choice }),
      selection: Object.freeze({
        start: caret,
        end: caret,
        direction: 'none' as const,
      }),
    }),
  })
}

export interface MarkdownPastePreview {
  readonly markdown: string
  readonly loss: readonly string[]
}

export const previewPasteAsMarkdown = (html: string): MarkdownPastePreview => {
  const opened = openMarkdownPasteAsMarkdown({
    explicit: true,
    snapshot: { html, explicit: true },
    anchor: {
      documentIdentity: { id: 'preview', epoch: 0 },
      revision: 0,
      source: '',
      selection: { start: 0, end: 0, direction: 'none' },
    },
  })
  if (opened.ok === false) {
    return Object.freeze({ markdown: '', loss: [opened.rejected] })
  }
  return Object.freeze({
    markdown: opened.session.preview.markdown,
    loss: Object.freeze(
      opened.session.preview.losses.map((item) => item.code.replace(/^(?:tag|attr):/, '')),
    ),
  })
}

export const confirmPasteAsMarkdown = (
  html: string,
  offset: number,
): MarkdownEditorTransaction => {
  const anchor: MarkdownPasteAsMarkdownAnchor = {
    documentIdentity: { id: 'preview', epoch: 0 },
    revision: 0,
    source: '',
    selection: { start: offset, end: offset, direction: 'none' },
  }
  const opened = openMarkdownPasteAsMarkdown({
    explicit: true,
    snapshot: { html, explicit: true },
    anchor,
  })
  if (opened.ok === false) {
    return {
      changes: [],
      history: 'separate',
      origin: 'command',
      metadata: { rejected: opened.rejected },
    }
  }
  const confirmed = confirmMarkdownPasteAsMarkdown(opened.session, 'markdown-import', anchor)
  if ('rejected' in confirmed) {
    return {
      changes: [],
      history: 'separate',
      origin: 'command',
      metadata: { rejected: confirmed.rejected },
    }
  }
  return confirmed.transaction
}

export type MarkdownPasteAsMarkdownMutationKind =
  | 'auto-html-priority'
  | 'pre-confirm-mutation'
  | 'stale-insertion'
  | 'rich-paste-fallback'

export const evaluateMarkdownPasteAsMarkdownMutations = (html: string) => {
  const anchor: MarkdownPasteAsMarkdownAnchor = {
    documentIdentity: { id: 'doc', epoch: 1 },
    revision: 3,
    source: 'keep',
    selection: { start: 4, end: 4, direction: 'none' },
  }
  const implicit = openMarkdownPasteAsMarkdown({
    explicit: false,
    snapshot: { html, explicit: false },
    anchor,
  })
  const opened = openMarkdownPasteAsMarkdown({
    explicit: true,
    snapshot: { html, explicit: true },
    anchor,
  })
  const preConfirm = opened.ok ? opened.session.anchor.source === 'keep' && !opened.session.confirmed : false
  const stale = opened.ok
    ? confirmMarkdownPasteAsMarkdown(opened.session, 'markdown-import', {
        ...anchor,
        revision: 9,
        selection: { start: 0, end: 0, direction: 'none' },
      })
    : { rejected: 'stale' as const, source: 'keep' }
  const failed = openMarkdownPasteAsMarkdown({
    explicit: true,
    snapshot: { html: '<totally-broken', explicit: true },
    anchor,
  })
  const richFallback =
    failed.ok && /<p>|<div>/i.test(failed.session.preview.markdown + failed.session.preview.plainText)
  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'auto-html-priority' as const,
        equivalent: implicit.ok,
        accepted: false,
      }),
      Object.freeze({
        kind: 'pre-confirm-mutation' as const,
        equivalent: opened.ok && !preConfirm,
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-insertion' as const,
        equivalent: !('rejected' in stale),
        accepted: false,
      }),
      Object.freeze({
        kind: 'rich-paste-fallback' as const,
        equivalent: Boolean(richFallback),
        accepted: false,
      }),
    ]),
  })
}
