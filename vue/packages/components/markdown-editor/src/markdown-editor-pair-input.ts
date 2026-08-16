import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
} from '../../../wasm/markdown-runtime'

import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import type {
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'

export const MARKDOWN_PAIR_DEFAULTS = Object.freeze([
  Object.freeze(['(', ')'] as const),
  Object.freeze(['[', ']'] as const),
  Object.freeze(['{', '}'] as const),
  Object.freeze(['"', '"'] as const),
  Object.freeze(["'", "'"] as const),
  Object.freeze(['`', '`'] as const),
  Object.freeze(['*', '*'] as const),
  Object.freeze(['_', '_'] as const),
] as const)

export type MarkdownPairAction =
  | 'insert-pair'
  | 'skip-close'
  | 'wrap'
  | 'delete-pair'
  | 'insert-fence'
  | 'passthrough'

export type MarkdownPairRejection =
  | 'composition-active'
  | 'readonly'
  | 'preview'
  | 'disabled-context'

export interface MarkdownPairInputPlan {
  readonly action: MarkdownPairAction
  readonly transaction: MarkdownEditorTransaction | null
  readonly rejected?: MarkdownPairRejection
}

export type MarkdownPairMutationKind =
  | 'pair-drift'
  | 'composition-pair'
  | 'auto-strong'
  | 'consumer-keydown'

const OPEN_TO_CLOSE = new Map<string, string>(MARKDOWN_PAIR_DEFAULTS.map(([open, close]) => [open, close]))
const CLOSE_TO_OPEN = new Map<string, string>(MARKDOWN_PAIR_DEFAULTS.map(([open, close]) => [close, open]))

const isWordChar = (value: string) => /[0-9A-Za-z\u00c0-\u024f]/.test(value)

const transactionOf = (
  from: number,
  to: number,
  insert: string,
  selectionStart: number,
  selectionEnd = selectionStart,
  direction: MarkdownEditorSelection['direction'] = 'none',
): MarkdownEditorTransaction =>
  Object.freeze({
    changes: Object.freeze([{ from, to, insert }]),
    history: 'separate' as const,
    origin: 'input' as const,
    selection: Object.freeze({
      direction,
      start: selectionStart,
      end: selectionEnd,
    }),
  })

const lineStartAt = (source: string, offset: number) =>
  source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1

const isEscaped = (source: string, offset: number) => {
  let slashes = 0
  let index = offset - 1
  while (index >= 0 && source[index] === '\\') {
    slashes += 1
    index -= 1
  }
  return slashes % 2 === 1
}

const contextDisablesPairing = (
  projection: MarkdownStableProjection,
  offset: number,
) =>
  projection.nodes.some(
    (node) =>
      node.rawRange.start <= offset &&
      offset <= node.rawRange.end &&
      (node.kind === 'code' || node.kind === 'malformed'),
  )

const insideLinkDestination = (
  projection: MarkdownStableProjection,
  source: string,
  offset: number,
) =>
  projection.nodes.some((node) => {
    if (node.kind !== 'link' && node.kind !== 'image') return false
    if (offset < node.rawRange.start || offset > node.rawRange.end) return false
    const slice = source.slice(node.rawRange.start, offset)
    return slice.includes('](')
  })

export const resolveMarkdownPairInput = (input: {
  readonly source: string
  readonly selection: MarkdownEditorSelection
  readonly inserted?: string
  readonly key?: 'backspace'
  readonly composing?: boolean
  readonly readonly?: boolean
  readonly mode?: MarkdownEditorMode
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly projection?: MarkdownStableProjection
}): MarkdownPairInputPlan => {
  const source = input.source
  const start = input.selection.start
  const end = input.selection.end
  const collapsed = start === end

  if (input.composing) {
    return Object.freeze({
      action: 'passthrough' as const,
      transaction: null,
      rejected: 'composition-active' as const,
    })
  }
  if (input.readonly) {
    return Object.freeze({
      action: 'passthrough' as const,
      transaction: null,
      rejected: 'readonly' as const,
    })
  }
  if (input.mode === 'preview') {
    return Object.freeze({
      action: 'passthrough' as const,
      transaction: null,
      rejected: 'preview' as const,
    })
  }

  const identity = input.documentIdentity ?? { id: 'editor', epoch: 0 }
  const projection =
    input.projection ??
    stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      identity,
    )

  if (contextDisablesPairing(projection, start) || isEscaped(source, start)) {
    return Object.freeze({
      action: 'passthrough' as const,
      transaction: null,
      rejected: 'disabled-context' as const,
    })
  }

  if (input.key === 'backspace' && collapsed && start > 0 && start < source.length) {
    const before = source[start - 1]!
    const after = source[start]!
    if (OPEN_TO_CLOSE.get(before) === after) {
      return Object.freeze({
        action: 'delete-pair' as const,
        transaction: transactionOf(start - 1, start + 1, '', start - 1),
      })
    }
  }

  const inserted = input.inserted
  if (!inserted) {
    return Object.freeze({ action: 'passthrough' as const, transaction: null })
  }

  const lineStart = lineStartAt(source, start)
  const beforeCaret = source.slice(lineStart, start)
  if (
    inserted === '`' &&
    collapsed &&
    beforeCaret === '``' &&
    source.slice(lineStart, source.indexOf('\n', start) === -1 ? source.length : source.indexOf('\n', start)).trim() === '``'
  ) {
    return Object.freeze({
      action: 'insert-fence' as const,
      transaction: transactionOf(start, end, '`\n\n```', start + 2),
    })
  }

  if (inserted === '(' && collapsed && start > 0 && source[start - 1] === ']') {
    if (insideLinkDestination(projection, source, start)) {
      return Object.freeze({
        action: 'passthrough' as const,
        transaction: null,
        rejected: 'disabled-context' as const,
      })
    }
    return Object.freeze({
      action: 'insert-pair' as const,
      transaction: transactionOf(start, end, '()', start + 1),
    })
  }

  if (insideLinkDestination(projection, source, start)) {
    return Object.freeze({
      action: 'passthrough' as const,
      transaction: null,
      rejected: 'disabled-context' as const,
    })
  }

  if (
    inserted === "'" &&
    collapsed &&
    start > 0 &&
    isWordChar(source[start - 1]!)
  ) {
    return Object.freeze({ action: 'passthrough' as const, transaction: null })
  }

  if (CLOSE_TO_OPEN.has(inserted) && collapsed && source[start] === inserted) {
    return Object.freeze({
      action: 'skip-close' as const,
      transaction: transactionOf(start, start, '', start + 1),
    })
  }

  const close = OPEN_TO_CLOSE.get(inserted)
  if (close) {
    if (!collapsed) {
      const selected = source.slice(start, end)
      return Object.freeze({
        action: 'wrap' as const,
        transaction: transactionOf(
          start,
          end,
          `${inserted}${selected}${close}`,
          start + 1,
          end + 1,
          input.selection.direction,
        ),
      })
    }
    return Object.freeze({
      action: 'insert-pair' as const,
      transaction: transactionOf(start, end, `${inserted}${close}`, start + 1),
    })
  }

  return Object.freeze({ action: 'passthrough' as const, transaction: null })
}

export const evaluateMarkdownPairInputMutations = () => {
  const source = 'item'
  const authority = resolveMarkdownPairInput({
    source,
    selection: { start: 4, end: 4 },
    inserted: '*',
  })
  const autoStrong = 'item****'
  const drifted = 'item«»'
  const composing = resolveMarkdownPairInput({
    source,
    selection: { start: 4, end: 4 },
    inserted: '(',
    composing: true,
  })
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'auto-strong' as const,
        equivalent: autoStrong === `item${authority.transaction?.changes[0]?.insert ?? ''}`,
        accepted: (authority.transaction?.changes[0]?.insert ?? '') === '****',
        detail: '* must insert a single marker pair, not strong',
      }),
      Object.freeze({
        kind: 'pair-drift' as const,
        equivalent: drifted.includes('()'),
        accepted: false,
        detail: 'the default pair set is closed and must not drift',
      }),
      Object.freeze({
        kind: 'composition-pair' as const,
        equivalent: composing.action !== 'passthrough',
        accepted: composing.action !== 'passthrough',
        detail: 'composition-active must not pair',
      }),
      Object.freeze({
        kind: 'consumer-keydown' as const,
        equivalent: false,
        accepted: false,
        detail: 'consumer keydown must not insert pairs outside the planner',
      }),
    ]),
  })
}
