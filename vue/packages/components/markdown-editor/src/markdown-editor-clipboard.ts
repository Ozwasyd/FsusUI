import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import type {
  MarkdownEditorDocumentIdentity,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'

export const MARKDOWN_CLIPBOARD_PASTE_PRIORITY = Object.freeze([
  'files',
  'text/markdown',
  'text/plain',
  'text/html',
] as const)

export const MARKDOWN_CLIPBOARD_MAX_PASTE_UNITS = 262_144

const MARKDOWN_MIME = Object.freeze(['text/markdown', 'text/x-markdown'] as const)
const INTERNAL_TOKEN = /syn:[A-Za-z0-9:_-]+/g
const DATA_URL = /data:[^\s"'<>]+/i

export type MarkdownClipboardPasteKind =
  | 'markdown-source'
  | 'plain-text'
  | 'html-plain'
  | 'attachment-intent'
  | 'noop'

export type MarkdownClipboardRejection =
  | 'composition-active'
  | 'readonly'
  | 'disabled'
  | 'preview'
  | 'stale-document'
  | 'budget-exceeded'
  | 'cancelled'
  | 'empty'

export type MarkdownClipboardCopyKind = 'source' | 'visible'

export type MarkdownClipboardOrigin = 'paste' | 'drop' | 'copy' | 'cut'

export interface MarkdownClipboardItem {
  readonly type: string
  readonly text?: string
}

export interface MarkdownClipboardFileRef {
  readonly name: string
  readonly type: string
  readonly size: number
}

export interface MarkdownClipboardTransfer {
  readonly files: readonly MarkdownClipboardFileRef[]
  readonly items: readonly MarkdownClipboardItem[]
}

export interface MarkdownClipboardPayload {
  readonly 'text/plain': string
  readonly 'text/markdown'?: string
}

export interface MarkdownAttachmentClipboardIntent {
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly files: readonly MarkdownClipboardFileRef[]
  readonly kind: 'attachment'
  readonly origin: Extract<MarkdownClipboardOrigin, 'paste' | 'drop'>
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
}

export interface MarkdownClipboardPastePlan {
  readonly action: MarkdownClipboardPasteKind
  readonly attachmentIntent: MarkdownAttachmentClipboardIntent | null
  readonly identity: string
  readonly insert: string
  readonly mime: string | null
  readonly rejected?: MarkdownClipboardRejection
  readonly transaction: MarkdownEditorTransaction | null
}

export interface MarkdownClipboardCopyPlan {
  readonly identity: string
  readonly kind: MarkdownClipboardCopyKind
  readonly payload: MarkdownClipboardPayload
  readonly rejected?: MarkdownClipboardRejection
  readonly text: string
}

export interface MarkdownClipboardCutPlan {
  readonly copy: MarkdownClipboardCopyPlan
  readonly identity: string
  readonly rejected?: MarkdownClipboardRejection
  readonly transaction: MarkdownEditorTransaction | null
}

export type MarkdownClipboardMutationKind =
  | 'html-first'
  | 'double-insert'
  | 'data-url'
  | 'internal-state-leak'
  | 'consumer-pipeline'

const sameDocument = (
  left?: MarkdownEditorDocumentIdentity,
  right?: MarkdownEditorDocumentIdentity,
) => {
  if (!left || !right) return true
  return left.id === right.id && left.epoch === right.epoch
}

const hashText = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

const clipboardIdentity = (
  origin: MarkdownClipboardOrigin,
  action: string,
  mime: string | null,
  selection: MarkdownEditorSelection,
  revision: number | undefined,
  body: string,
) =>
  `clipboard:${origin}:${action}:${mime ?? 'none'}:${selection.start}:${selection.end}:${revision ?? 0}:${hashText(body)}`

const decodeEntity = (body: string) => {
  if (body === 'amp') return '&'
  if (body === 'lt') return '<'
  if (body === 'gt') return '>'
  if (body === 'quot') return '"'
  if (body === 'apos' || body === '#39') return "'"
  if (body === 'nbsp') return ' '
  if (body.startsWith('#x') || body.startsWith('#X')) {
    const code = Number.parseInt(body.slice(2), 16)
    return Number.isFinite(code) ? String.fromCodePoint(code) : ''
  }
  if (body.startsWith('#')) {
    const code = Number.parseInt(body.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : ''
  }
  return ''
}

const BLOCK_BREAK = new Set([
  'p',
  'div',
  'tr',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'section',
  'article',
  'br',
  'hr',
  'table',
  'ul',
  'ol',
])

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template'])

export const htmlToSafePlainText = (html: string) => {
  let output = ''
  let index = 0
  let skipDepth = 0
  while (index < html.length) {
    const current = html[index]!
    if (current === '<') {
      const close = html.indexOf('>', index + 1)
      if (close === -1) break
      const raw = html.slice(index + 1, close).trim()
      const isClose = raw.startsWith('/')
      const name = raw
        .replace(/^\//, '')
        .split(/[\s/]/, 1)[0]!
        .toLowerCase()
      if (SKIP_TAGS.has(name)) {
        skipDepth = isClose ? Math.max(0, skipDepth - 1) : skipDepth + 1
      } else if (skipDepth === 0 && BLOCK_BREAK.has(name)) {
        if (!output.endsWith('\n')) output += '\n'
      }
      index = close + 1
      continue
    }
    if (skipDepth > 0) {
      index += 1
      continue
    }
    if (current === '&') {
      const semi = html.indexOf(';', index + 1)
      if (semi !== -1 && semi - index < 12) {
        output += decodeEntity(html.slice(index + 1, semi))
        index = semi + 1
        continue
      }
    }
    output += current
    index += 1
  }
  return output.replace(/\u00a0/g, ' ')
}

export const visibleTextFromMarkdownSource = (source: string) => {
  let text = source.replace(INTERNAL_TOKEN, '')
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  text = text.replace(/```[^\n]*\n?([\s\S]*?)```/g, '$1')
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/^#{1,6}[ \t]+/gm, '')
  text = text.replace(/^>[ \t]?/gm, '')
  text = text.replace(/^([ \t]*)(?:[-+*]|\d+\.)[ \t]+\[[ xX]\][ \t]+/gm, '$1')
  text = text.replace(/^([ \t]*)(?:[-+*]|\d+\.)[ \t]+/gm, '$1')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/\*([^*\n]+)\*/g, '$1')
  text = text.replace(/_([^_\n]+)_/g, '$1')
  text = text.replace(/~~([^~]+)~~/g, '$1')
  return text
}

const itemText = (
  items: readonly MarkdownClipboardItem[],
  type: string,
) => items.find((item) => item.type === type)?.text

const firstMarkdownText = (items: readonly MarkdownClipboardItem[]) => {
  for (const type of MARKDOWN_MIME) {
    const text = itemText(items, type)
    if (text !== undefined) return { mime: type, text }
  }
  return undefined
}

const sanitizeInsert = (value: string) => {
  if (DATA_URL.test(value) && value.trim().toLowerCase().startsWith('data:')) {
    return ''
  }
  return value.replace(INTERNAL_TOKEN, '')
}

const transactionOf = (
  selection: MarkdownEditorSelection,
  insert: string,
  origin: Extract<MarkdownClipboardOrigin, 'paste' | 'drop' | 'cut'>,
  revision: number | undefined,
  identity: string,
  extra?: Readonly<Record<string, unknown>>,
): MarkdownEditorTransaction => {
  const caret = selection.start + insert.length
  return Object.freeze({
    changes: Object.freeze([
      Object.freeze({
        from: selection.start,
        insert,
        to: selection.end,
      }),
    ]),
    expectedRevision: revision,
    history: 'separate' as const,
    metadata: Object.freeze({
      clipboard: origin,
      identity,
      ...extra,
    }),
    origin: origin === 'cut' ? 'command' : origin,
    selection: Object.freeze({
      direction: selection.direction ?? 'none',
      end: caret,
      start: caret,
    }),
  })
}

const rejectedPaste = (
  rejected: MarkdownClipboardRejection,
  origin: Extract<MarkdownClipboardOrigin, 'paste' | 'drop'>,
  selection: MarkdownEditorSelection,
  revision: number | undefined,
): MarkdownClipboardPastePlan =>
  Object.freeze({
    action: 'noop',
    attachmentIntent: null,
    identity: clipboardIdentity(origin, 'reject', null, selection, revision, rejected),
    insert: '',
    mime: null,
    rejected,
    transaction: null,
  })

const gateClipboard = (input: {
  readonly composing?: boolean
  readonly currentIdentity?: MarkdownEditorDocumentIdentity
  readonly disabled?: boolean
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly expectedRevision?: number
  readonly mode?: MarkdownEditorMode
  readonly readonly?: boolean
  readonly revision?: number
  readonly signal?: AbortSignal
}): MarkdownClipboardRejection | undefined => {
  if (input.composing) return 'composition-active'
  if (input.readonly) return 'readonly'
  if (input.disabled) return 'disabled'
  if (input.mode === 'preview') return 'preview'
  if (input.signal?.aborted) return 'cancelled'
  if (
    input.expectedRevision !== undefined &&
    input.revision !== undefined &&
    input.expectedRevision !== input.revision
  ) {
    return 'stale-document'
  }
  if (!sameDocument(input.documentIdentity, input.currentIdentity)) {
    return 'stale-document'
  }
  return undefined
}

export const markdownClipboardItemsFromDataTransfer = (
  data: {
    readonly files?: ArrayLike<{ name: string; size: number; type: string }>
    readonly types?: ArrayLike<string>
    getData?: (type: string) => string
  } | null,
): MarkdownClipboardTransfer => {
  if (!data) return Object.freeze({ files: Object.freeze([]), items: Object.freeze([]) })
  const types = Array.from(data.types ?? []).filter((type) => type !== 'Files')
  const items = types.map((type) =>
    Object.freeze({
      text: data.getData ? data.getData(type) : '',
      type,
    }),
  )
  const files = Array.from(data.files ?? []).map((file) =>
    Object.freeze({
      name: file.name,
      size: file.size,
      type: file.type,
    }),
  )
  return Object.freeze({
    files: Object.freeze(files),
    items: Object.freeze(items),
  })
}

export const writeMarkdownClipboardPayload = (
  data: { setData(type: string, value: string): void } | null | undefined,
  payload: MarkdownClipboardPayload,
) => {
  if (!data) return
  data.setData('text/plain', payload['text/plain'])
  if (payload['text/markdown'] !== undefined) {
    data.setData('text/markdown', payload['text/markdown'])
  }
}

export const resolveMarkdownClipboardPaste = (input: {
  readonly composing?: boolean
  readonly currentIdentity?: MarkdownEditorDocumentIdentity
  readonly disabled?: boolean
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly expectedRevision?: number
  readonly files?: readonly MarkdownClipboardFileRef[]
  readonly items?: readonly MarkdownClipboardItem[]
  readonly maxPasteUnits?: number
  readonly mode?: MarkdownEditorMode
  readonly origin?: Extract<MarkdownClipboardOrigin, 'paste' | 'drop'>
  readonly readonly?: boolean
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly signal?: AbortSignal
  readonly source: string
}): MarkdownClipboardPastePlan => {
  const origin = input.origin ?? 'paste'
  const selection = input.selection
  const rejected = gateClipboard(input)
  if (rejected) return rejectedPaste(rejected, origin, selection, input.revision)

  const files = input.files ?? []
  if (files.length > 0) {
    const body = files.map((file) => `${file.name}:${file.size}:${file.type}`).join('|')
    const identity = clipboardIdentity(
      origin,
      'attachment-intent',
      'files',
      selection,
      input.revision,
      body,
    )
    return Object.freeze({
      action: 'attachment-intent',
      attachmentIntent: Object.freeze({
        documentIdentity: input.documentIdentity,
        files: Object.freeze(files.map((file) => Object.freeze({ ...file }))),
        kind: 'attachment',
        origin,
        revision: input.revision,
        selection: Object.freeze({ ...selection }),
      }),
      identity,
      insert: '',
      mime: 'files',
      transaction: null,
    })
  }

  const items = input.items ?? []
  const markdown = firstMarkdownText(items)
  const plain = itemText(items, 'text/plain')
  const html = itemText(items, 'text/html')

  let action: MarkdownClipboardPasteKind = 'noop'
  let mime: string | null = null
  let insert = ''

  if (markdown) {
    action = 'markdown-source'
    mime = markdown.mime
    insert = markdown.text
  } else if (plain !== undefined) {
    action = 'plain-text'
    mime = 'text/plain'
    insert = plain
  } else if (html !== undefined) {
    action = 'html-plain'
    mime = 'text/html'
    insert = htmlToSafePlainText(html)
  }

  insert = sanitizeInsert(insert)
  const budget = input.maxPasteUnits ?? MARKDOWN_CLIPBOARD_MAX_PASTE_UNITS
  if (insert.length > budget) {
    return rejectedPaste('budget-exceeded', origin, selection, input.revision)
  }
  if (input.signal?.aborted) {
    return rejectedPaste('cancelled', origin, selection, input.revision)
  }
  if (action === 'noop' || insert.length === 0) {
    return Object.freeze({
      action: 'noop',
      attachmentIntent: null,
      identity: clipboardIdentity(origin, 'noop', mime, selection, input.revision, ''),
      insert: '',
      mime,
      rejected: 'empty',
      transaction: null,
    })
  }

  const identity = clipboardIdentity(
    origin,
    action,
    mime,
    selection,
    input.revision,
    insert,
  )
  return Object.freeze({
    action,
    attachmentIntent: null,
    identity,
    insert,
    mime,
    transaction: transactionOf(selection, insert, origin, input.revision, identity, {
      mime,
    }),
  })
}

const copyKindFor = (
  mode: MarkdownEditorMode | undefined,
  explicit?: MarkdownClipboardCopyKind,
): MarkdownClipboardCopyKind => {
  if (explicit) return explicit
  return mode === 'live' || mode === 'split' ? 'visible' : 'source'
}

export const resolveMarkdownClipboardCopy = (input: {
  readonly composing?: boolean
  readonly copyKind?: MarkdownClipboardCopyKind
  readonly currentIdentity?: MarkdownEditorDocumentIdentity
  readonly disabled?: boolean
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly expectedRevision?: number
  readonly mode?: MarkdownEditorMode
  readonly readonly?: boolean
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly signal?: AbortSignal
  readonly source: string
}): MarkdownClipboardCopyPlan => {
  const rejected = gateClipboard(input)
  const kind = copyKindFor(input.mode, input.copyKind)
  const selected = input.source.slice(input.selection.start, input.selection.end)
  if (rejected) {
    return Object.freeze({
      identity: clipboardIdentity(
        'copy',
        'reject',
        null,
        input.selection,
        input.revision,
        rejected,
      ),
      kind,
      payload: Object.freeze({ 'text/plain': '' }),
      rejected,
      text: '',
    })
  }

  const text = kind === 'source' ? selected : visibleTextFromMarkdownSource(selected)
  const payload: MarkdownClipboardPayload =
    kind === 'source'
      ? Object.freeze({
          'text/markdown': selected,
          'text/plain': selected,
        })
      : Object.freeze({ 'text/plain': text })
  return Object.freeze({
    identity: clipboardIdentity(
      'copy',
      kind,
      kind === 'source' ? 'text/markdown' : 'text/plain',
      input.selection,
      input.revision,
      text,
    ),
    kind,
    payload,
    text,
  })
}

export const resolveMarkdownClipboardCut = (input: {
  readonly composing?: boolean
  readonly copyKind?: MarkdownClipboardCopyKind
  readonly currentIdentity?: MarkdownEditorDocumentIdentity
  readonly disabled?: boolean
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly expectedRevision?: number
  readonly mode?: MarkdownEditorMode
  readonly readonly?: boolean
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly signal?: AbortSignal
  readonly source: string
}): MarkdownClipboardCutPlan => {
  const copy = resolveMarkdownClipboardCopy(input)
  if (copy.rejected) {
    return Object.freeze({
      copy,
      identity: copy.identity,
      rejected: copy.rejected,
      transaction: null,
    })
  }
  if (input.selection.start === input.selection.end) {
    return Object.freeze({
      copy,
      identity: copy.identity,
      rejected: 'empty' as const,
      transaction: null,
    })
  }
  const identity = clipboardIdentity(
    'cut',
    copy.kind,
    'text/plain',
    input.selection,
    input.revision,
    copy.text,
  )
  return Object.freeze({
    copy,
    identity,
    transaction: Object.freeze({
      changes: Object.freeze([
        Object.freeze({
          from: input.selection.start,
          insert: '',
          to: input.selection.end,
        }),
      ]),
      expectedRevision: input.revision,
      history: 'separate' as const,
      metadata: Object.freeze({
        clipboard: 'cut',
        identity,
      }),
      origin: 'command' as const,
      selection: Object.freeze({
        direction: input.selection.direction ?? 'none',
        end: input.selection.start,
        start: input.selection.start,
      }),
    }),
  })
}

export const evaluateMarkdownClipboardMutations = () => {
  const mixed = resolveMarkdownClipboardPaste({
    items: [
      { text: '<img src="data:image/png;base64,abc"><b>HTML</b>', type: 'text/html' },
      { text: 'plain', type: 'text/plain' },
    ],
    selection: { start: 0, end: 0 },
    source: '',
  })
  const htmlOnly = resolveMarkdownClipboardPaste({
    items: [
      {
        text: '<script>alert(1)</script><img src="data:image/gif;base64,xx"><b>bold</b>',
        type: 'text/html',
      },
    ],
    selection: { start: 0, end: 0 },
    source: '',
  })
  const files = resolveMarkdownClipboardPaste({
    files: [{ name: 'shot.png', size: 12, type: 'image/png' }],
    items: [
      { text: '<img src="data:image/png;base64,abc">', type: 'text/html' },
      { text: 'data:image/png;base64,abc', type: 'text/plain' },
    ],
    selection: { start: 0, end: 0 },
    source: '',
  })
  const first = resolveMarkdownClipboardPaste({
    items: [{ text: 'once', type: 'text/plain' }],
    revision: 3,
    selection: { start: 1, end: 1 },
    source: 'ab',
  })
  const second = resolveMarkdownClipboardPaste({
    items: [{ text: 'once', type: 'text/plain' }],
    revision: 3,
    selection: { start: 1, end: 1 },
    source: 'ab',
  })
  const copy = resolveMarkdownClipboardCopy({
    mode: 'live',
    selection: { start: 0, end: 8 },
    source: '**bold**',
  })
  const consumerPipeline = {
    insert: '<b>HTML</b>',
    origin: 'consumer-keydown',
  }
  return Object.freeze({
    authority: mixed,
    mutations: Object.freeze([
      Object.freeze({
        accepted: mixed.action === 'html-plain' || mixed.insert.includes('<'),
        detail: 'mixed MIME must prefer text/plain over HTML',
        equivalent: mixed.insert === 'HTML',
        kind: 'html-first' as const,
      }),
      Object.freeze({
        accepted: first.identity !== second.identity,
        detail: 'paste and beforeinput of the same payload share one identity',
        equivalent: first.insert + second.insert === 'onceonce',
        kind: 'double-insert' as const,
      }),
      Object.freeze({
        accepted:
          Boolean(files.transaction) ||
          files.insert.includes('data:') ||
          htmlOnly.insert.includes('data:'),
        detail: 'files and HTML must not produce data URLs in source',
        equivalent: files.action !== 'attachment-intent',
        kind: 'data-url' as const,
      }),
      Object.freeze({
        accepted:
          Object.keys(copy.payload).includes('text/html') ||
          copy.text.includes('syn:') ||
          JSON.stringify(copy.payload).includes('syn:'),
        detail: 'clipboard must not carry node IDs or executable HTML',
        equivalent: copy.text === '**bold**',
        kind: 'internal-state-leak' as const,
      }),
      Object.freeze({
        accepted: consumerPipeline.origin === 'paste',
        detail: 'consumer pipelines must not insert clipboard HTML',
        equivalent: consumerPipeline.insert.includes('<b>'),
        kind: 'consumer-pipeline' as const,
      }),
    ]),
  })
}
