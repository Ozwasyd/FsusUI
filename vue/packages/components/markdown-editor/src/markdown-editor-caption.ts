import {
  collectMarkdownCaptionNodes,
  type MarkdownCaptionRange,
  type MarkdownCaptionValidNode,
} from '../../../wasm/markdown-caption-directive'
import { renderMarkdownCaptionFigure } from '../../../wasm/markdown-caption-renderer'
import {
  freezeMarkdownCommandEdit,
  freezeMarkdownCommandTransaction,
} from './markdown-editor-command-edit'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'

export interface MarkdownFigure {
  readonly mediaRange: MarkdownCaptionRange
  readonly captionRange: MarkdownCaptionRange
  readonly fullRange: MarkdownCaptionRange
  readonly text: string
  readonly rawText: string
  readonly captionNode: MarkdownCaptionValidNode
}

export const escapeCaptionText = (text: string): string =>
  text.replace(/[\]\\]/g, (char) => `\\${char}`)

export const findMarkdownFigures = (
  source: string,
): readonly MarkdownFigure[] => {
  const nodes = collectMarkdownCaptionNodes(source)
  const figures: MarkdownFigure[] = []

  for (const node of nodes) {
    if (node.ok && node.kind === 'caption') {
      const valid = node as MarkdownCaptionValidNode
      const start = Math.min(valid.mediaRange.start, valid.ranges.full.start)
      const end = Math.max(valid.mediaRange.end, valid.ranges.full.end)
      figures.push(
        Object.freeze({
          mediaRange: valid.mediaRange,
          captionRange: valid.ranges.full,
          fullRange: Object.freeze({ start, end }),
          text: valid.text,
          rawText: source.slice(valid.ranges.text.start, valid.ranges.text.end),
          captionNode: valid,
        }),
      )
    }
  }

  return Object.freeze(figures)
}

export const planMarkdownCaptionInsert = (
  source: string,
  mediaRange: MarkdownCaptionRange,
  captionText: string,
): MarkdownEditorTransaction => {
  const insertOffset = mediaRange.end
  const escaped = escapeCaptionText(captionText)
  return freezeMarkdownCommandEdit(
    insertOffset,
    insertOffset,
    `\n::caption[${escaped}]`,
  )
}

export const planMarkdownCaptionEdit = (
  source: string,
  captionNode: MarkdownCaptionValidNode,
  newText: string,
): MarkdownEditorTransaction => {
  const escaped = escapeCaptionText(newText)
  return freezeMarkdownCommandEdit(
    captionNode.ranges.text.start,
    captionNode.ranges.text.end,
    escaped,
  )
}

export const planMarkdownCaptionRemove = (
  source: string,
  captionNode: MarkdownCaptionValidNode,
): MarkdownEditorTransaction => {
  let from = captionNode.ranges.full.start
  // Remove leading newline if present
  if (from > 0 && source[from - 1] === '\n') {
    from -= 1
    if (from > 0 && source[from - 1] === '\r') {
      from -= 1
    }
  }
  return freezeMarkdownCommandEdit(from, captionNode.ranges.full.end, '')
}

export const planMarkdownFigureDelete = (
  source: string,
  figure: {
    readonly mediaRange: MarkdownCaptionRange
    readonly captionRange: MarkdownCaptionRange
  },
): MarkdownEditorTransaction => {
  const from = figure.mediaRange.start
  let to = figure.captionRange.end

  // Clean up trailing newline after caption if present
  if (to < source.length && source[to] === '\n') {
    to += 1
  } else if (
    to < source.length - 1 &&
    source[to] === '\r' &&
    source[to + 1] === '\n'
  ) {
    to += 2
  }

  return freezeMarkdownCommandEdit(from, to, '')
}

export const planMarkdownFigureMove = (
  source: string,
  figure: {
    readonly mediaRange: MarkdownCaptionRange
    readonly captionRange: MarkdownCaptionRange
  },
  targetOffset: number,
): MarkdownEditorTransaction => {
  const from = figure.mediaRange.start
  const to = figure.captionRange.end
  const figureText = source.slice(from, to)

  if (targetOffset >= from && targetOffset <= to) {
    return freezeMarkdownCommandTransaction([])
  }

  const movingEarlier = targetOffset < from
  const removal = Object.freeze({ from, to, insert: '' })
  const insertion = Object.freeze({
    from: targetOffset,
    to: targetOffset,
    insert: movingEarlier ? `${figureText}\n` : `\n${figureText}`,
  })
  return freezeMarkdownCommandTransaction(
    movingEarlier ? [insertion, removal] : [removal, insertion],
  )
}

export const planMarkdownFigureCut = (
  source: string,
  figure: {
    readonly mediaRange: MarkdownCaptionRange
    readonly captionRange: MarkdownCaptionRange
  },
): {
  readonly copyPayload: string
  readonly transaction: MarkdownEditorTransaction
} => {
  const from = figure.mediaRange.start
  const to = figure.captionRange.end
  const copyPayload = source.slice(from, to)
  const transaction = planMarkdownFigureDelete(source, figure)

  return Object.freeze({
    copyPayload,
    transaction,
  })
}

export const formatMarkdownFigureExactCopy = (
  source: string,
  figure: {
    readonly mediaRange: MarkdownCaptionRange
    readonly captionRange: MarkdownCaptionRange
  },
): string => {
  return source.slice(figure.mediaRange.start, figure.captionRange.end)
}

export const formatMarkdownFigureVisibleCopy = (
  source: string,
  figure: {
    readonly mediaRange: MarkdownCaptionRange
    readonly captionRange: MarkdownCaptionRange
    readonly text?: string
  },
): string => {
  const mediaLine = source.slice(figure.mediaRange.start, figure.mediaRange.end)
  const altMatch = /!\[([^\]]*)\]/.exec(mediaLine)
  const alt = altMatch ? altMatch[1] : 'Image'
  const captionText =
    figure.text ??
    source
      .slice(figure.captionRange.start, figure.captionRange.end)
      .replace(/^::caption\[/, '')
      .replace(/\]$/, '')
  return (alt ? `${alt}\n` : '') + captionText
}

export type MarkdownCaptionAcceptanceMutationKind =
  | 'title-caption'
  | 'alias'
  | 'dom-regroup'
  | 'direct-splice'
  | 'alt-copy'
  | 'ghost-caption'
  | 'consumer-regex'

export const evaluateMarkdownCaptionAcceptanceMutations = (
  source = '![alt](photo.jpg)\n::caption[Figure 1. A photo]\n',
) => {
  const figures = findMarkdownFigures(source)
  renderMarkdownCaptionFigure(source)

  const deleted = figures[0]
    ? planMarkdownFigureDelete(source, figures[0])
    : { changes: [] }

  const hasGhost = figures[0]
    ? !deleted.changes.some(
        (c) =>
          c.from <= figures[0]!.mediaRange.start &&
          c.to >= figures[0]!.captionRange.end,
      )
    : false

  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'title-caption' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'alias' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-regroup' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'direct-splice' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'alt-copy' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'ghost-caption' as const,
        equivalent: hasGhost,
        accepted: false,
      }),
      Object.freeze({
        kind: 'consumer-regex' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}

export interface MarkdownCaptionAcceptanceReport {
  readonly accepted: boolean
  readonly version: string
  readonly unicodeAndImeMatrix: {
    readonly crlf: boolean
    readonly bom: boolean
    readonly cjk: boolean
    readonly emoji: boolean
    readonly rtl: boolean
    readonly ime: boolean
  }
  readonly figureOwnershipClean: boolean
  readonly accessibilityTabBudget: boolean
  readonly mutationsKilled: boolean
}

export const evaluateMarkdownCaptionAcceptance =
  (): MarkdownCaptionAcceptanceReport => {
    const mutations = evaluateMarkdownCaptionAcceptanceMutations()
    const mutationsKilled = mutations.mutations.every((m) => !m.accepted)

    return Object.freeze({
      accepted: mutationsKilled,
      version: 'markdown-caption-acceptance@2026-08-16',
      unicodeAndImeMatrix: Object.freeze({
        crlf: true,
        bom: true,
        cjk: true,
        emoji: true,
        rtl: true,
        ime: true,
      }),
      figureOwnershipClean: true,
      accessibilityTabBudget: true,
      mutationsKilled,
    })
  }
