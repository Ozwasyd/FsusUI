import {
  createMarkdownEditorProjection,
  createMarkdownSourceCoordinateMap,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'

import type {
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'

export type MarkdownBlockInputKey =
  | 'enter'
  | 'shift-enter'
  | 'backspace'
  | 'delete'
  | 'tab'
  | 'shift-tab'

export type MarkdownBlockInputContextKind =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'task'
  | 'quote'
  | 'code'
  | 'table'
  | 'atomic'
  | 'ordinary'

export type MarkdownBlockInputAction =
  | 'insert-break'
  | 'continue-list'
  | 'continue-quote'
  | 'exit-list'
  | 'exit-quote'
  | 'indent-list'
  | 'outdent-list'
  | 'indent-selection'
  | 'outdent-selection'
  | 'insert-spaces'
  | 'passthrough-tab'
  | 'delete-backward'
  | 'delete-forward'
  | 'merge-previous'
  | 'merge-next'
  | 'strip-marker'
  | 'table-hook'
  | 'noop'

export type MarkdownBlockInputPosition =
  | 'start'
  | 'middle'
  | 'end'
  | 'empty'
  | 'document-start'
  | 'document-end'

export type MarkdownBlockInputRejection = 'composition-active'

export interface MarkdownBlockInputIntent {
  readonly key: MarkdownBlockInputKey
  readonly context: MarkdownBlockInputContextKind
  readonly action: MarkdownBlockInputAction
  readonly nodeId: string | null
  readonly position: MarkdownBlockInputPosition
}

export interface MarkdownBlockInputPlan {
  readonly intent: MarkdownBlockInputIntent
  readonly transaction: MarkdownEditorTransaction | null
  readonly rejected?: MarkdownBlockInputRejection
}

export type MarkdownBlockInputMutationKind =
  | 'regex-context'
  | 'consumer-keydown'
  | 'dom-mutation'
  | 'full-normalize'

export interface MarkdownBlockInputMutationResult {
  readonly kind: MarkdownBlockInputMutationKind
  readonly equivalent: boolean
  readonly accepted: boolean
  readonly detail: string
}

const ATOMIC_KINDS = new Set(['image', 'latex', 'mermaid'])

const lineBoundsAt = (source: string, offset: number) => {
  const start = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1
  const newline = source.indexOf('\n', offset)
  const end = newline === -1 ? source.length : newline
  return { start, end }
}

const mapContextKind = (kind: string): MarkdownBlockInputContextKind => {
  if (kind === 'paragraph' || kind === 'explicit-paragraph') return 'paragraph'
  if (kind === 'heading') return 'heading'
  if (kind === 'list') return 'list'
  if (kind === 'task') return 'task'
  if (kind === 'quote') return 'quote'
  if (kind === 'code') return 'code'
  if (kind === 'table') return 'table'
  if (ATOMIC_KINDS.has(kind)) return 'atomic'
  return 'ordinary'
}

const smallestContainingNode = (
  nodes: readonly MarkdownStableSyntaxNode[],
  offset: number,
) => {
  const containing = nodes.filter(
    (node) => node.rawRange.start <= offset && offset <= node.rawRange.end,
  )
  if (containing.length === 0) return null
  return [...containing].sort((left, right) => {
    const span =
      left.rawRange.end -
      left.rawRange.start -
      (right.rawRange.end - right.rawRange.start)
    if (span !== 0) return span
    return left.id.localeCompare(right.id)
  })[0]!
}

const listMarkerOf = (line: string, kind: 'list' | 'task') => {
  let index = 0
  while (line[index] === ' ' || line[index] === '\t') index += 1
  const indent = line.slice(0, index)
  if (kind === 'task' || /[-*+]/.test(line[index] ?? '')) {
    const marker = line[index]
    if (marker !== '-' && marker !== '*' && marker !== '+') return null
    let cursor = index + 1
    if (line[cursor] === ' ') cursor += 1
    let task = ''
    if (line.startsWith('[', cursor) && line[cursor + 2] === ']') {
      task = line.slice(cursor, cursor + 3)
      cursor += 3
      if (line[cursor] === ' ') cursor += 1
    }
    return {
      indent,
      prefix: `${indent}${marker}${task ? ` ${task}` : ''} `,
      contentStart: lineBoundsContentStart(indent, cursor, line),
      ordered: false,
    }
  }
  let digits = ''
  while (line[index] && line[index]! >= '0' && line[index]! <= '9') {
    digits += line[index]
    index += 1
  }
  const closer = line[index]
  if (!digits || (closer !== '.' && closer !== ')')) return null
  index += 1
  if (line[index] === ' ') index += 1
  return {
    indent,
    prefix: `${indent}${digits}${closer} `,
    contentStart: lineBoundsContentStart(indent, index, line),
    ordered: true,
    number: Number(digits),
    closer,
  }
}

const lineBoundsContentStart = (
  indent: string,
  parsedEnd: number,
  line: string,
) => Math.min(Math.max(indent.length, parsedEnd), line.length)

const quotePrefixOf = (line: string) => {
  let index = 0
  while (line[index] === ' ' || line[index] === '\t') index += 1
  if (line[index] !== '>') return null
  let prefix = line.slice(0, index + 1)
  if (line[index + 1] === ' ') prefix += ' '
  return { prefix, contentStart: prefix.length }
}

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

const positionOf = (
  source: string,
  offset: number,
  node: MarkdownStableSyntaxNode | null,
  empty: boolean,
): MarkdownBlockInputPosition => {
  if (empty) return 'empty'
  if (offset === 0) return 'document-start'
  if (offset === source.length) return 'document-end'
  if (!node) return 'middle'
  if (offset <= node.rawRange.start) return 'start'
  const trailing =
    source[node.rawRange.end - 1] === '\n' ? node.rawRange.end - 1 : node.rawRange.end
  if (offset >= trailing) return 'end'
  return 'middle'
}

export const resolveMarkdownBlockInputContext = (input: {
  readonly source: string
  readonly offset: number
  readonly projection: MarkdownStableProjection
}): {
  readonly kind: MarkdownBlockInputContextKind
  readonly node: MarkdownStableSyntaxNode | null
} => {
  const node = smallestContainingNode(input.projection.nodes, input.offset)
  if (!node) return { kind: 'ordinary', node: null }
  return { kind: mapContextKind(node.kind), node }
}

const deleteGrapheme = (
  source: string,
  offset: number,
  direction: 'backward' | 'forward',
) => {
  const map = createMarkdownSourceCoordinateMap(source)
  if (direction === 'backward') {
    if (offset <= 0) return null
    const boundary = map.graphemeBoundaryAt(offset - 1)
    return transactionOf(boundary.start, offset, '', boundary.start)
  }
  if (offset >= source.length) return null
  const boundary = map.graphemeBoundaryAt(offset)
  return transactionOf(offset, boundary.end, '', offset)
}

const mergeAcross = (
  source: string,
  offset: number,
  direction: 'previous' | 'next',
) => {
  if (direction === 'previous') {
    if (offset <= 0) return null
    const previous = source[offset - 1] === '\n' ? offset - 1 : offset
    const from = source[previous - 1] === '\r' ? previous - 1 : previous
    if (source[from] !== '\n' && source[from] !== '\r') return null
    return transactionOf(from, offset, '', from)
  }
  if (offset >= source.length) return null
  let to = offset
  if (source[to] === '\r') to += 1
  if (source[to] === '\n') to += 1
  if (to === offset) return null
  return transactionOf(offset, to, '', offset)
}

const indentLines = (
  source: string,
  selection: MarkdownEditorSelection,
  outdent: boolean,
) => {
  const { start } = lineBoundsAt(source, selection.start)
  const last = lineBoundsAt(source, Math.max(selection.start, selection.end))
  const blockStart = start
  const blockEnd = last.end
  const block = source.slice(blockStart, blockEnd)
  const lines = block.split('\n')
  let deltaStart = 0
  let deltaEnd = 0
  let walked = 0
  const next = lines.map((line) => {
    if (!outdent) {
      if (blockStart + walked < selection.start) deltaStart += 2
      if (blockStart + walked < selection.end) deltaEnd += 2
      walked += line.length + 1
      return `  ${line}`
    }
    const removable = line.startsWith('  ')
      ? 2
      : line.startsWith(' ') || line.startsWith('\t')
        ? 1
        : 0
    if (blockStart + walked < selection.start) deltaStart -= removable
    if (blockStart + walked < selection.end) deltaEnd -= removable
    walked += line.length + 1
    return removable > 0 ? line.slice(removable) : line
  })
  return transactionOf(
    blockStart,
    blockEnd,
    next.join('\n'),
    Math.max(blockStart, selection.start + deltaStart),
    Math.max(blockStart, selection.end + deltaEnd),
    selection.direction,
  )
}

const planListEnter = (
  source: string,
  caret: number,
  kind: 'list' | 'task',
) => {
  const line = lineBoundsAt(source, caret)
  const text = source.slice(line.start, line.end)
  const marker = listMarkerOf(text, kind)
  if (!marker) return { action: 'insert-break' as const, transaction: transactionOf(caret, caret, '\n', caret + 1) }
  const content = text.slice(marker.contentStart)
  if (!content.trim()) {
    return {
      action: 'exit-list' as const,
      transaction: transactionOf(
        line.start,
        caret,
        marker.indent,
        line.start + marker.indent.length,
      ),
    }
  }
  const nextPrefix = marker.ordered
    ? `${marker.indent}${marker.number! + 1}${marker.closer} `
    : kind === 'task'
      ? `${marker.indent}${text[marker.indent.length]} [ ] `
      : marker.prefix
  return {
    action: 'continue-list' as const,
    transaction: transactionOf(caret, caret, `\n${nextPrefix}`, caret + 1 + nextPrefix.length),
  }
}

const planQuoteEnter = (source: string, caret: number) => {
  const line = lineBoundsAt(source, caret)
  const text = source.slice(line.start, line.end)
  const quote = quotePrefixOf(text)
  if (!quote) return { action: 'insert-break' as const, transaction: transactionOf(caret, caret, '\n', caret + 1) }
  const content = text.slice(quote.contentStart)
  if (!content.trim()) {
    return {
      action: 'exit-quote' as const,
      transaction: transactionOf(line.start, caret, '', line.start),
    }
  }
  return {
    action: 'continue-quote' as const,
    transaction: transactionOf(
      caret,
      caret,
      `\n${quote.prefix}`,
      caret + 1 + quote.prefix.length,
    ),
  }
}

const planStripMarker = (
  source: string,
  caret: number,
  kind: 'list' | 'task' | 'quote',
) => {
  const line = lineBoundsAt(source, caret)
  const text = source.slice(line.start, line.end)
  if (kind === 'quote') {
    const quote = quotePrefixOf(text)
    if (!quote || caret !== line.start + quote.contentStart) return null
    return transactionOf(line.start, line.start + quote.contentStart, '', line.start)
  }
  const marker = listMarkerOf(text, kind)
  if (!marker || caret !== line.start + marker.contentStart) return null
  return transactionOf(line.start, line.start + marker.contentStart, marker.indent, line.start + marker.indent.length)
}

export const resolveMarkdownBlockInputIntent = (input: {
  readonly source: string
  readonly selection: MarkdownEditorSelection
  readonly key: MarkdownBlockInputKey
  readonly composing?: boolean
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly projection?: MarkdownStableProjection
}): MarkdownBlockInputPlan => {
  const source = input.source
  const selection = input.selection
  const caret = selection.start
  const collapsed = selection.start === selection.end
  const identity = input.documentIdentity ?? { id: 'editor', epoch: 0 }
  const projection =
    input.projection ??
    stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      identity,
    )
  const context = resolveMarkdownBlockInputContext({
    source,
    offset: caret,
    projection,
  })
  const line = lineBoundsAt(source, caret)
  const lineText = source.slice(line.start, line.end)
  const empty =
    context.kind === 'list' || context.kind === 'task'
      ? Boolean(listMarkerOf(lineText, context.kind) && !lineText.slice(listMarkerOf(lineText, context.kind)!.contentStart).trim())
      : context.kind === 'quote'
        ? Boolean(quotePrefixOf(lineText) && !lineText.slice(quotePrefixOf(lineText)!.contentStart).trim())
        : Boolean(context.node && source.slice(context.node.rawRange.start, context.node.rawRange.end).trim() === '')
  const position = positionOf(source, caret, context.node, empty)
  const baseIntent = {
    key: input.key,
    context: context.kind,
    nodeId: context.node?.id ?? null,
    position,
  }

  if (input.composing) {
    return Object.freeze({
      intent: Object.freeze({ ...baseIntent, action: 'noop' as const }),
      transaction: null,
      rejected: 'composition-active' as const,
    })
  }

  const finish = (
    action: MarkdownBlockInputAction,
    transaction: MarkdownEditorTransaction | null,
  ): MarkdownBlockInputPlan =>
    Object.freeze({
      intent: Object.freeze({ ...baseIntent, action }),
      transaction,
    })

  if (!collapsed && (input.key === 'tab' || input.key === 'shift-tab')) {
    return finish(
      input.key === 'tab' ? 'indent-selection' : 'outdent-selection',
      indentLines(source, selection, input.key === 'shift-tab'),
    )
  }

  if (!collapsed && (input.key === 'backspace' || input.key === 'delete' || input.key === 'enter' || input.key === 'shift-enter')) {
    if (input.key === 'enter' || input.key === 'shift-enter') {
      return finish(
        'insert-break',
        transactionOf(selection.start, selection.end, '\n', selection.start + 1),
      )
    }
    return finish(
      input.key === 'backspace' ? 'delete-backward' : 'delete-forward',
      transactionOf(selection.start, selection.end, '', selection.start),
    )
  }

  if (context.kind === 'table') {
    return finish('table-hook', null)
  }

  if (input.key === 'tab') {
    if (context.kind === 'list' || context.kind === 'task') {
      return finish('indent-list', indentLines(source, selection, false))
    }
    if (context.kind === 'code') {
      return finish('insert-spaces', transactionOf(caret, caret, '  ', caret + 2))
    }
    return finish('passthrough-tab', null)
  }

  if (input.key === 'shift-tab') {
    if (context.kind === 'list' || context.kind === 'task') {
      return finish('outdent-list', indentLines(source, selection, true))
    }
    return finish('passthrough-tab', null)
  }

  if (input.key === 'shift-enter') {
    return finish('insert-break', transactionOf(caret, caret, '\n', caret + 1))
  }

  if (input.key === 'enter') {
    if (context.kind === 'list' || context.kind === 'task') {
      const planned = planListEnter(source, caret, context.kind)
      return finish(planned.action, planned.transaction)
    }
    if (context.kind === 'quote') {
      const planned = planQuoteEnter(source, caret)
      return finish(planned.action, planned.transaction)
    }
    return finish('insert-break', transactionOf(caret, caret, '\n', caret + 1))
  }

  if (input.key === 'backspace') {
    if (context.kind === 'list' || context.kind === 'task' || context.kind === 'quote') {
      const stripped = planStripMarker(source, caret, context.kind)
      if (stripped) return finish('strip-marker', stripped)
    }
    const merged = mergeAcross(source, caret, 'previous')
    if (merged && (position === 'start' || position === 'document-start')) {
      return finish('merge-previous', merged)
    }
    return finish('delete-backward', deleteGrapheme(source, caret, 'backward'))
  }

  if (input.key === 'delete') {
    const merged = mergeAcross(source, caret, 'next')
    if (merged && (position === 'end' || position === 'document-end')) {
      return finish('merge-next', merged)
    }
    return finish('delete-forward', deleteGrapheme(source, caret, 'forward'))
  }

  return finish('noop', null)
}

export const evaluateMarkdownBlockInputMutations = (source = '```\n- not a list\n```\n') => {
  const authority = resolveMarkdownBlockInputIntent({
    source,
    selection: { start: source.indexOf('-'), end: source.indexOf('-') + 12 },
    key: 'enter',
  })
  const line = source.slice(
    source.lastIndexOf('\n', source.indexOf('-')) + 1,
    source.indexOf('\n', source.indexOf('-')),
  )
  const regexThinksList = /^(\s*)([-*+])\s+/.test(line)
  const regexTransaction = regexThinksList
    ? transactionOf(
        source.indexOf('-') + 12,
        source.indexOf('-') + 12,
        '\n- ',
        source.indexOf('-') + 16,
      )
    : null
  const consumerKeydown = `${source}\n- `
  const domGuess = source.replace(/```[\s\S]*```/, line)
  const normalized = source.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '')

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'regex-context' as const,
        equivalent:
          regexTransaction?.changes[0]?.insert ===
          authority.transaction?.changes[0]?.insert,
        accepted: authority.intent.context === 'list',
        detail: 'current-line regex is not the syntax authority',
      }),
      Object.freeze({
        kind: 'consumer-keydown' as const,
        equivalent: consumerKeydown === source,
        accepted: false,
        detail: 'consumer keydown must not mutate source outside a transaction',
      }),
      Object.freeze({
        kind: 'dom-mutation' as const,
        equivalent: domGuess === source,
        accepted: false,
        detail: 'DOM or rendered text is not a syntax context',
      }),
      Object.freeze({
        kind: 'full-normalize' as const,
        equivalent: normalized === source,
        accepted: normalized !== source && authority.intent.action === 'insert-break',
        detail: 'Enter must not rewrite unedited BOM or newlines',
      }),
    ]),
  })
}
