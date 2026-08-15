import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'

import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import type { MarkdownEditorSelection } from './markdown-editor-transaction'

export const MARKDOWN_LIVE_REVEAL_STATES = Object.freeze([
  'inactive',
  'caret-inside',
  'selection-intersects',
  'pointer-requested',
  'property-editor-open',
  'diagnostic-reveal',
  'composition-active',
] as const)

export type MarkdownLiveRevealState = (typeof MARKDOWN_LIVE_REVEAL_STATES)[number]

export type MarkdownLiveRevealIntent =
  | 'idle'
  | 'pointer'
  | 'property-editor'
  | 'diagnostic'
  | 'escape'
  | 'focus-return'

export type MarkdownLiveRevealField =
  | 'destination'
  | 'alt'
  | 'title'
  | 'label'
  | 'language'
  | 'task-marker'

export type MarkdownLiveRevealRangeRole =
  | 'open'
  | 'close'
  | 'content'
  | 'destination'
  | 'title'
  | 'alt'
  | 'language'
  | 'task-marker'
  | 'label'
  | 'source-escape'

export interface MarkdownLiveRevealRange {
  readonly end: number
  readonly role: MarkdownLiveRevealRangeRole
  readonly start: number
}

export interface MarkdownLiveRevealTarget {
  readonly ancestors: readonly string[]
  readonly field?: MarkdownLiveRevealField
  readonly kind: string
  readonly markerKind: string
  readonly nodeId: string
  readonly nodeRange: Readonly<{ end: number; start: number }>
  readonly revealedRanges: readonly MarkdownLiveRevealRange[]
}

export interface MarkdownLiveRevealPlan {
  readonly focusReturn: Readonly<{ end: number; start: number }> | null
  readonly frozen: boolean
  readonly historyUnchanged: true
  readonly rejected?: 'composition-active' | 'preview'
  readonly selectionUnchanged: true
  readonly sourceUnchanged: true
  readonly state: MarkdownLiveRevealState
  readonly target: MarkdownLiveRevealTarget | null
}

export type MarkdownLiveRevealMutationKind =
  | 'block-wide-reveal'
  | 'dom-range'
  | 'plain-text-marker'
  | 'composition-switch'

const INLINE_BEARING = new Set([
  'heading',
  'paragraph',
  'list',
  'task',
  'quote',
  'table',
  'explicit-paragraph',
  'link',
  'image',
])

const isSpace = (value: string) =>
  value === ' ' || value === '\t' || value === '\n' || value === '\r'

const isWordChar = (value: string) => /[0-9A-Za-z\u00c0-\u024f]/.test(value)

const contains = (
  range: { readonly end: number; readonly start: number },
  offset: number,
) => range.start <= offset && offset <= range.end

const intersects = (
  range: { readonly end: number; readonly start: number },
  start: number,
  end: number,
) => range.start < end && start < range.end

const spanOf = (range: { readonly end: number; readonly start: number }) =>
  range.end - range.start

const rangeOf = (
  start: number,
  end: number,
  role: MarkdownLiveRevealRangeRole,
): MarkdownLiveRevealRange => Object.freeze({ end, role, start })

const countRun = (text: string, index: number, delimiter: string) => {
  let count = 0
  while (text[index + count] === delimiter) count += 1
  return count
}

const canOpenEmphasis = (
  text: string,
  index: number,
  delimiter: string,
  run: number,
) => {
  if (index + run >= text.length) return false
  const next = text[index + run]!
  if (isSpace(next)) return false
  if (
    delimiter === '_' &&
    index > 0 &&
    isWordChar(text[index - 1]!) &&
    isWordChar(next)
  ) {
    return false
  }
  return true
}

const canCloseEmphasis = (
  text: string,
  index: number,
  delimiter: string,
  run: number,
) => {
  if (index === 0) return false
  const previous = text[index - 1]!
  if (isSpace(previous)) return false
  if (
    delimiter === '_' &&
    index + run < text.length &&
    isWordChar(previous) &&
    isWordChar(text[index + run]!)
  ) {
    return false
  }
  return true
}

const scanEmphasisClose = (
  text: string,
  start: number,
  delimiter: string,
  length: number,
) => {
  let index = start
  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length) {
      index += 2
      continue
    }
    if (text[index] === '`') {
      const close = text.indexOf('`', index + 1)
      if (close === -1) break
      index = close + 1
      continue
    }
    if (text[index] === delimiter) {
      const closeRun = countRun(text, index, delimiter)
      if (closeRun >= length && canCloseEmphasis(text, index, delimiter, length)) {
        return index
      }
      index += closeRun
      continue
    }
    index += 1
  }
  return -1
}

interface MarkerCandidate {
  readonly field?: MarkdownLiveRevealField
  readonly kind: string
  readonly markerKind: string
  readonly nodeId: string
  readonly nodeRange: { end: number; start: number }
  readonly parentId: string | null
  readonly revealedRanges: readonly MarkdownLiveRevealRange[]
}

const pushEmphasis = (
  text: string,
  base: number,
  nodeId: string,
  kind: string,
  output: MarkerCandidate[],
) => {
  let index = 0
  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length) {
      index += 2
      continue
    }
    const delimiter = text[index]
    if (delimiter !== '*' && delimiter !== '_') {
      index += 1
      continue
    }
    const openRun = countRun(text, index, delimiter)
    let matched = false
    for (let length = Math.min(openRun, 3); length > 0; length -= 1) {
      if (!canOpenEmphasis(text, index, delimiter, length)) continue
      const close = scanEmphasisClose(text, index + length, delimiter, length)
      if (close <= index + length) continue
      const inner = text.slice(index + length, close)
      if (!inner) continue
      const start = base + index
      const end = base + close + length
      output.push({
        kind,
        markerKind: length === 1 ? 'emphasis' : length === 2 ? 'strong' : 'strong-emphasis',
        nodeId,
        nodeRange: { end, start },
        parentId: nodeId,
        revealedRanges: Object.freeze([
          rangeOf(start, start + length, 'open'),
          rangeOf(start + length, base + close, 'content'),
          rangeOf(base + close, end, 'close'),
        ]),
      })
      pushEmphasis(inner, start + length, nodeId, kind, output)
      index = close + length
      matched = true
      break
    }
    if (!matched) index += Math.max(1, openRun)
  }
}

const pushInlineCode = (
  text: string,
  base: number,
  nodeId: string,
  kind: string,
  output: MarkerCandidate[],
) => {
  let index = 0
  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length) {
      index += 2
      continue
    }
    if (text[index] !== '`') {
      index += 1
      continue
    }
    const openRun = countRun(text, index, '`')
    const close = text.indexOf('`'.repeat(openRun), index + openRun)
    if (close === -1) {
      index += openRun
      continue
    }
    const start = base + index
    const end = base + close + openRun
    output.push({
      kind,
      markerKind: 'code',
      nodeId,
      nodeRange: { end, start },
      parentId: nodeId,
      revealedRanges: Object.freeze([
        rangeOf(start, start + openRun, 'open'),
        rangeOf(start + openRun, base + close, 'content'),
        rangeOf(base + close, end, 'close'),
      ]),
    })
    index = close + openRun
  }
}

const partitionLink = (
  slice: string,
  base: number,
  node: MarkdownStableSyntaxNode,
): MarkerCandidate | null => {
  const image = slice.startsWith('![')
  const openEnd = image ? 2 : slice.startsWith('<') ? 1 : 1
  const labelClose = slice.indexOf(']', openEnd)
  if (labelClose === -1) {
    return {
      field: image ? 'alt' : 'label',
      kind: node.kind,
      markerKind: image ? 'image' : 'link',
      nodeId: node.id,
      nodeRange: { ...node.rawRange },
      parentId: null,
      revealedRanges: Object.freeze([
        rangeOf(node.rawRange.start, node.rawRange.end, 'source-escape'),
      ]),
    }
  }
  const after = slice.slice(labelClose + 1)
  const destOpen = after.startsWith('(') ? labelClose + 1 : after.startsWith('[') ? labelClose + 1 : -1
  const destClose =
    destOpen === -1
      ? slice.startsWith('<')
        ? slice.lastIndexOf('>')
        : -1
      : slice.indexOf(after.startsWith('(') ? ')' : ']', destOpen + 1)
  const ranges: MarkdownLiveRevealRange[] = [
    rangeOf(base, base + openEnd, 'open'),
    rangeOf(base + openEnd, base + labelClose, image ? 'alt' : 'label'),
  ]
  if (destOpen !== -1 && destClose !== -1) {
    ranges.push(rangeOf(base + labelClose, base + destOpen + 1, 'open'))
    const destBody = slice.slice(destOpen + 1, destClose).trim()
    const titleMatch = destBody.match(/\s+"([^"]*)"\s*$/)
    const destEnd = titleMatch
      ? base + destOpen + 1 + destBody.length - titleMatch[0].length
      : base + destClose
    ranges.push(rangeOf(base + destOpen + 1, destEnd, 'destination'))
    if (titleMatch) {
      ranges.push(rangeOf(destEnd, base + destClose, 'title'))
    }
    ranges.push(rangeOf(base + destClose, base + destClose + 1, 'close'))
  } else if (slice.startsWith('<') && destClose !== -1) {
    ranges.push(rangeOf(base + 1, base + destClose, 'destination'))
    ranges.push(rangeOf(base + destClose, base + destClose + 1, 'close'))
  }
  return {
    field: image ? 'alt' : 'destination',
    kind: node.kind,
    markerKind: image ? 'image' : 'link',
    nodeId: node.id,
    nodeRange: { ...node.rawRange },
    parentId: null,
    revealedRanges: Object.freeze(ranges),
  }
}

const partitionFence = (
  slice: string,
  node: MarkdownStableSyntaxNode,
): MarkerCandidate => {
  const firstLine = slice.split('\n', 1)[0] ?? ''
  const fence = firstLine.match(/^(`{3,}|~{3,})/)
  const language = fence
    ? firstLine.slice(fence[0].length).trim()
    : ''
  const openEnd = node.rawRange.start + firstLine.length
  const lastBreak = slice.lastIndexOf('\n')
  const lastLine = lastBreak === -1 ? '' : slice.slice(lastBreak + 1)
  const closed = Boolean(fence && lastLine.startsWith(fence[1] ?? fence[0]!))
  const ranges: MarkdownLiveRevealRange[] = [
    rangeOf(node.rawRange.start, openEnd, language ? 'language' : 'open'),
  ]
  if (closed) {
    ranges.push(
      rangeOf(node.rawRange.start + lastBreak + 1, node.rawRange.end, 'close'),
    )
  } else {
    ranges.push(rangeOf(node.rawRange.start, node.rawRange.end, 'source-escape'))
  }
  return {
    field: language ? 'language' : undefined,
    kind: node.kind,
    markerKind: node.kind === 'mermaid' || node.kind === 'latex' ? node.kind : 'fence',
    nodeId: node.id,
    nodeRange: { ...node.rawRange },
    parentId: null,
    revealedRanges: Object.freeze(ranges),
  }
}

const partitionHeading = (
  slice: string,
  node: MarkdownStableSyntaxNode,
): MarkerCandidate => {
  let hashes = 0
  while (slice[hashes] === '#') hashes += 1
  const openEnd = slice[hashes] === ' ' ? hashes + 1 : hashes
  return {
    kind: node.kind,
    markerKind: 'heading',
    nodeId: node.id,
    nodeRange: { ...node.rawRange },
    parentId: null,
    revealedRanges: Object.freeze([
      rangeOf(node.rawRange.start, node.rawRange.start + openEnd, 'open'),
    ]),
  }
}

const partitionList = (
  slice: string,
  node: MarkdownStableSyntaxNode,
): MarkerCandidate => {
  const match = slice.match(/^([ \t]*)(?:[-+*]|\d+[.)])[ \t]+(?:\[([ xX])\][ \t]+)?/)
  if (!match) {
    return {
      kind: node.kind,
      markerKind: node.kind,
      nodeId: node.id,
      nodeRange: { ...node.rawRange },
      parentId: null,
      revealedRanges: Object.freeze([]),
    }
  }
  const prefix = match[0]
  const task = match[2] !== undefined
  const ranges: MarkdownLiveRevealRange[] = [
    rangeOf(node.rawRange.start, node.rawRange.start + prefix.length, 'open'),
  ]
  if (task) {
    const box = prefix.lastIndexOf('[')
    ranges.push(
      rangeOf(
        node.rawRange.start + box,
        node.rawRange.start + box + 3,
        'task-marker',
      ),
    )
  }
  return {
    field: task ? 'task-marker' : undefined,
    kind: node.kind,
    markerKind: task ? 'task' : 'list',
    nodeId: node.id,
    nodeRange: { ...node.rawRange },
    parentId: null,
    revealedRanges: Object.freeze(ranges),
  }
}

const partitionExplicit = (node: MarkdownStableSyntaxNode, slice: string): MarkerCandidate => {
  const startLine = slice.split('\n', 1)[0] ?? ''
  const openLen = startLine.trim() === '::p' ? startLine.length : 3
  const lastBreak = slice.lastIndexOf('\n')
  const lastLine = lastBreak === -1 ? '' : slice.slice(lastBreak + 1)
  const ranges = [
    rangeOf(node.rawRange.start, node.rawRange.start + openLen, 'open'),
  ]
  if (lastLine.trim() === '::') {
    ranges.push(
      rangeOf(node.rawRange.start + lastBreak + 1, node.rawRange.end, 'close'),
    )
  }
  return {
    kind: node.kind,
    markerKind: 'explicit-paragraph',
    nodeId: node.id,
    nodeRange: { ...node.rawRange },
    parentId: null,
    revealedRanges: Object.freeze(ranges),
  }
}

const collectCandidates = (
  source: string,
  projection: MarkdownStableProjection,
): MarkerCandidate[] => {
  const candidates: MarkerCandidate[] = []
  for (const node of projection.nodes) {
    const slice = source.slice(node.rawRange.start, node.rawRange.end)
    if (node.kind === 'link' || node.kind === 'image') {
      const partitioned = partitionLink(slice, node.rawRange.start, node)
      if (partitioned) candidates.push(partitioned)
    } else if (node.kind === 'heading') {
      candidates.push(partitionHeading(slice, node))
    } else if (node.kind === 'list' || node.kind === 'task') {
      candidates.push(partitionList(slice, node))
    } else if (node.kind === 'code' || node.kind === 'mermaid' || node.kind === 'latex') {
      candidates.push(partitionFence(slice, node))
    } else if (node.kind === 'explicit-paragraph') {
      candidates.push(partitionExplicit(node, slice))
    } else if (node.kind === 'malformed' || node.kind === 'footnote') {
      candidates.push({
        field: node.kind === 'footnote' ? 'label' : undefined,
        kind: node.kind,
        markerKind: node.kind,
        nodeId: node.id,
        nodeRange: { ...node.rawRange },
        parentId: null,
        revealedRanges: Object.freeze([
          rangeOf(
            node.rawRange.start,
            node.rawRange.end,
            node.kind === 'malformed' ? 'source-escape' : 'label',
          ),
        ]),
      })
    } else if (node.kind === 'quote') {
      const prefix = slice.match(/^>[ \t]?/)
      if (prefix) {
        candidates.push({
          kind: node.kind,
          markerKind: 'quote',
          nodeId: node.id,
          nodeRange: { ...node.rawRange },
          parentId: null,
          revealedRanges: Object.freeze([
            rangeOf(
              node.rawRange.start,
              node.rawRange.start + prefix[0].length,
              'open',
            ),
          ]),
        })
      }
    }
    if (INLINE_BEARING.has(node.kind)) {
      pushEmphasis(slice, node.rawRange.start, node.id, node.kind, candidates)
      pushInlineCode(slice, node.rawRange.start, node.id, node.kind, candidates)
    }
  }
  return candidates
}

const pickInnermost = (
  candidates: readonly MarkerCandidate[],
  start: number,
  end: number,
  field?: MarkdownLiveRevealField,
) => {
  const hits = candidates.filter((candidate) => {
    if (field && candidate.field !== field) {
      return candidate.revealedRanges.some((range) => range.role === field)
    }
    return start === end
      ? contains(candidate.nodeRange, start)
      : intersects(candidate.nodeRange, start, end)
  })
  hits.sort((left, right) => {
    const span = spanOf(left.nodeRange) - spanOf(right.nodeRange)
    if (span !== 0) return span
    return right.nodeRange.start - left.nodeRange.start
  })
  return hits[0]
}

const toTarget = (
  candidate: MarkerCandidate,
  ancestors: readonly string[],
  field?: MarkdownLiveRevealField,
): MarkdownLiveRevealTarget =>
  Object.freeze({
    ancestors,
    field: field ?? candidate.field,
    kind: candidate.kind,
    markerKind: candidate.markerKind,
    nodeId: candidate.nodeId,
    nodeRange: Object.freeze({ ...candidate.nodeRange }),
    revealedRanges: candidate.revealedRanges,
  })

const inactive = (
  selection: MarkdownEditorSelection,
  extras: Partial<MarkdownLiveRevealPlan> = {},
): MarkdownLiveRevealPlan =>
  Object.freeze({
    focusReturn: extras.focusReturn ?? null,
    frozen: extras.frozen ?? false,
    historyUnchanged: true,
    rejected: extras.rejected,
    selectionUnchanged: true,
    sourceUnchanged: true,
    state: extras.state ?? 'inactive',
    target: extras.target ?? null,
  })

export const resolveMarkdownLiveSyntaxReveal = (input: {
  readonly composing?: boolean
  readonly diagnosticNodeId?: string
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly field?: MarkdownLiveRevealField
  readonly intent?: MarkdownLiveRevealIntent
  readonly mode?: MarkdownEditorMode
  readonly pointerOffset?: number
  readonly previous?: MarkdownLiveRevealPlan
  readonly projection?: MarkdownStableProjection
  readonly propertyNodeId?: string
  readonly selection: MarkdownEditorSelection
  readonly source: string
}): MarkdownLiveRevealPlan => {
  const selection = input.selection
  const focusReturn = Object.freeze({
    end: selection.end,
    start: selection.start,
  })
  if (input.mode === 'preview') {
    return inactive(selection, { rejected: 'preview' })
  }
  if (input.intent === 'escape' || input.intent === 'focus-return') {
    return inactive(selection, { focusReturn })
  }
  if (input.composing) {
    return Object.freeze({
      focusReturn,
      frozen: true,
      historyUnchanged: true as const,
      rejected: 'composition-active' as const,
      selectionUnchanged: true as const,
      sourceUnchanged: true as const,
      state: 'composition-active' as const,
      target: input.previous?.target ?? null,
    })
  }

  const identity = input.documentIdentity ?? { epoch: 0, id: 'reveal' }
  const projection =
    input.projection ??
    stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(input.source),
      identity,
    )
  const candidates = collectCandidates(input.source, projection)

  if (input.intent === 'property-editor') {
    const hit =
      (input.propertyNodeId
        ? candidates.find((candidate) => candidate.nodeId === input.propertyNodeId)
        : undefined) ??
      pickInnermost(candidates, selection.start, selection.end, input.field)
    return Object.freeze({
      focusReturn,
      frozen: false,
      historyUnchanged: true as const,
      selectionUnchanged: true as const,
      sourceUnchanged: true as const,
      state: 'property-editor-open' as const,
      target: hit ? toTarget(hit, [], input.field) : null,
    })
  }

  if (input.intent === 'diagnostic') {
    const hit =
      candidates.find((candidate) => candidate.nodeId === input.diagnosticNodeId) ??
      candidates.find((candidate) => candidate.markerKind === 'malformed') ??
      pickInnermost(candidates, selection.start, selection.end)
    return Object.freeze({
      focusReturn,
      frozen: false,
      historyUnchanged: true as const,
      selectionUnchanged: true as const,
      sourceUnchanged: true as const,
      state: 'diagnostic-reveal' as const,
      target: hit ? toTarget(hit, []) : null,
    })
  }

  const pointer = input.intent === 'pointer'
  const offset = pointer
    ? (input.pointerOffset ?? selection.start)
    : selection.start
  const end = pointer || selection.start === selection.end ? offset : selection.end
  const hit = pickInnermost(candidates, offset, end, input.field)
  if (!hit || hit.revealedRanges.length === 0) {
    return inactive(selection, { focusReturn })
  }

  const state: MarkdownLiveRevealState = pointer
    ? 'pointer-requested'
    : selection.start !== selection.end
      ? 'selection-intersects'
      : 'caret-inside'

  return Object.freeze({
    focusReturn,
    frozen: false,
    historyUnchanged: true as const,
    selectionUnchanged: true as const,
    sourceUnchanged: true as const,
    state,
    target: toTarget(hit, []),
  })
}

export const evaluateMarkdownLiveRevealMutations = () => {
  const source = 'See **bold** and more.\n'
  const identity = { epoch: 1, id: 'reveal' }
  const authority = resolveMarkdownLiveSyntaxReveal({
    documentIdentity: identity,
    selection: { direction: 'none', end: 8, start: 8 },
    source,
  })
  const block = authority.target?.nodeRange
  const paragraph = source.length
  const domGuess = source.indexOf('bold')
  const composing = resolveMarkdownLiveSyntaxReveal({
    composing: true,
    documentIdentity: identity,
    previous: authority,
    selection: { direction: 'none', end: 0, start: 0 },
    source,
  })
  const switched = composing.target?.nodeRange.start !== authority.target?.nodeRange.start
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        accepted:
          Boolean(block && block.start === 0 && block.end === paragraph) ||
          authority.target?.revealedRanges.some(
            (range) => range.start === 0 && range.end === paragraph,
          ),
        detail: 'reveal must not show the whole block as source',
        equivalent: block?.end === paragraph,
        kind: 'block-wide-reveal' as const,
      }),
      Object.freeze({
        accepted: authority.target?.revealedRanges.some(
          (range) => range.start === domGuess && range.role === 'open',
        ),
        detail: 'reveal ranges must not come from DOM/text offsets',
        equivalent: source.slice(domGuess, domGuess + 4) === 'bold',
        kind: 'dom-range' as const,
      }),
      Object.freeze({
        accepted: authority.target?.markerKind === 'plain',
        detail: 'ordinary words are not markers',
        equivalent: source.includes('See'),
        kind: 'plain-text-marker' as const,
      }),
      Object.freeze({
        accepted: composing.state !== 'composition-active' || switched,
        detail: 'composition must freeze reveal target switching',
        equivalent: composing.frozen,
        kind: 'composition-switch' as const,
      }),
    ]),
  })
}
