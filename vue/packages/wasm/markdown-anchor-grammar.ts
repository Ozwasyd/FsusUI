import { normalizeMarkdownSource } from './markdown'
import { readMarkdownAnchorOwnerBlocks } from './markdown-anchor-owners'

export const MARKDOWN_ANCHOR_ID = /^[a-z][a-z0-9-]{0,63}$/

export const MARKDOWN_ANCHOR_DIAGNOSTIC_CODES = Object.freeze([
  'anchor-invalid-id',
  'anchor-duplicate',
  'anchor-orphan',
  'anchor-cross-gap',
  'anchor-placement',
] as const)

export type MarkdownAnchorDiagnosticCode =
  (typeof MARKDOWN_ANCHOR_DIAGNOSTIC_CODES)[number]

export interface MarkdownAnchorRange {
  readonly start: number
  readonly end: number
}

export interface MarkdownAnchorValidNode {
  readonly ok: true
  readonly kind: 'anchor'
  readonly id: string
  readonly fragment: string
  readonly placement: 'line-end' | 'following-line'
  readonly ranges: {
    readonly full: MarkdownAnchorRange
    readonly marker: MarkdownAnchorRange
    readonly id: MarkdownAnchorRange
  }
}

export interface MarkdownAnchorInvalidNode {
  readonly ok: false
  readonly kind: 'anchor'
  readonly code: MarkdownAnchorDiagnosticCode
  readonly message: string
  readonly range: MarkdownAnchorRange
}

export type MarkdownAnchorNode =
  | MarkdownAnchorValidNode
  | MarkdownAnchorInvalidNode

const INLINE_CAPABLE = /^(#{1,6}\s+\S|\s*\S)/
const FENCE_DELIMITER = /^\s{0,3}(`{3,}|~{3,})/
const LATEX_DELIMITER = /^\s{0,3}\$\$/
const CONTAINER_OPEN = /^\s{0,3}:::\S/
const REGISTERED_ATOMIC_LINE = /^\s{0,3}::[a-z][a-z0-9-]*\[/

/**
 * A following-line anchor belongs to the block closed by the previous line.
 * Fenced code, LaTeX, `:::` containers, table rows, and single-line registered
 * directives are the atomic owners named by the fixed grammar.
 */
const isAtomicOwnerLine = (text: string) =>
  FENCE_DELIMITER.test(text) ||
  LATEX_DELIMITER.test(text) ||
  /^\s{0,3}:::/.test(text) ||
  REGISTERED_ATOMIC_LINE.test(text)

const fail = (
  start: number,
  end: number,
  code: MarkdownAnchorDiagnosticCode,
  message: string,
): MarkdownAnchorInvalidNode =>
  Object.freeze({
    ok: false,
    kind: 'anchor',
    code,
    message,
    range: Object.freeze({ start, end }),
  })

const splitLines = (source: string) => {
  const lines: {
    readonly text: string
    readonly start: number
    readonly end: number
  }[] = []
  // Match the renderer's newline rules without normalizing away raw offsets.
  let offset = 0
  for (const newline of source.matchAll(/\r\n?|\n/g)) {
    const end = newline.index
    lines.push({ text: source.slice(offset, end), start: offset, end })
    offset = end + newline[0].length
  }
  lines.push({ text: source.slice(offset), start: offset, end: source.length })
  return lines
}

type AnchorLine = ReturnType<typeof splitLines>[number]

const closesFence = (delimiter: string, text: string) => {
  const match = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(text)
  return (
    match !== null &&
    match[1]![0] === delimiter[0] &&
    match[1]!.length >= delimiter.length
  )
}

const nextClose = (
  lines: readonly AnchorLine[],
  from: number,
  closes: (text: string) => boolean,
) => {
  for (let index = from; index < lines.length; index += 1) {
    if (closes(lines[index]!.text)) return index
  }
  return -1
}

/**
 * Lines inside a fenced code, LaTeX, or `:::` container block are literal
 * source: a `^id` there is content, never an anchor and never a diagnostic.
 * An unclosed fence runs to the end of the document as CommonMark requires;
 * an unclosed `$$` or `:::name` keeps line-based scanning because the block
 * itself is already reported malformed by the projection parser.
 */
const markAtomicRegionLines = (lines: readonly AnchorLine[]) => {
  const inside = new Array<boolean>(lines.length).fill(false)
  let index = 0
  while (index < lines.length) {
    const text = lines[index]!.text
    const fence = FENCE_DELIMITER.exec(text)
    if (fence) {
      const close = nextClose(lines, index + 1, (line) =>
        closesFence(fence[1]!, line),
      )
      const last = close === -1 ? lines.length - 1 : close
      for (let cursor = index; cursor <= last; cursor += 1)
        inside[cursor] = true
      index = last + 1
      continue
    }
    const closer = LATEX_DELIMITER.test(text)
      ? /^\s{0,3}\$\$\s*$/
      : CONTAINER_OPEN.test(text)
        ? /^\s{0,3}:::\s*$/
        : undefined
    if (closer) {
      const close = nextClose(lines, index + 1, (line) => closer.test(line))
      if (close !== -1) {
        for (let cursor = index; cursor <= close; cursor += 1) {
          inside[cursor] = true
        }
        index = close + 1
        continue
      }
    }
    index += 1
  }
  return inside
}

export const parseMarkdownAnchorMarker = (
  text: string,
  start: number,
): MarkdownAnchorNode | null => {
  const match = /(?:^| )(\^([a-zA-Z0-9-]{1,64}))$/.exec(text)
  if (!match || match.index === undefined) return null
  const marker = match[1]!
  const id = match[2]!
  const inline = match[0].startsWith(' ')
  const markerStart = start + match.index + (inline ? 1 : 0)
  const markerEnd = markerStart + marker.length
  const ownerPrefix = text.slice(0, match.index)
  if (inline && (!ownerPrefix.trim() || /[ \t]$/.test(ownerPrefix))) {
    return fail(
      markerStart,
      markerEnd,
      'anchor-placement',
      'anchor requires a single leading space or exclusive line',
    )
  }
  if (!MARKDOWN_ANCHOR_ID.test(id)) {
    return fail(
      markerStart,
      markerEnd,
      'anchor-invalid-id',
      'anchor id must match [a-z][a-z0-9-]{0,63}',
    )
  }
  return Object.freeze({
    ok: true,
    kind: 'anchor',
    id,
    fragment: `#${id}`,
    placement: inline ? 'line-end' : 'following-line',
    ranges: Object.freeze({
      full: Object.freeze({ start: markerStart, end: markerEnd }),
      marker: Object.freeze({ start: markerStart, end: markerEnd }),
      id: Object.freeze({ start: markerStart + 1, end: markerEnd }),
    }),
  })
}

export const collectMarkdownAnchorNodes = (
  source: string,
): readonly MarkdownAnchorNode[] => {
  if (!source.includes('^')) return Object.freeze([])
  const lines = splitLines(source)
  const insideAtomic = markAtomicRegionLines(lines)
  const encoder = new TextEncoder()
  const byteOffsets = [0]
  for (const [index, line] of lines.entries()) {
    const text = index === 0 ? line.text.replace(/^\uFEFF/, '') : line.text
    byteOffsets.push(byteOffsets[index]! + encoder.encode(text).byteLength + 1)
  }
  const ownerNodes = readMarkdownAnchorOwnerBlocks(
    normalizeMarkdownSource(source),
  )
  const finalLineOwners = ownerNodes.filter(
    (node) => node.kind === 'paragraph' || node.kind === 'quote',
  )
  const unboundListStarts = new Set(
    ownerNodes
      .filter((node) => node.kind === 'unbound-list')
      .map((node) => node.start),
  )
  const code = ownerNodes.filter((node) => node.kind === 'code')
  const tableEnds = new Set(
    ownerNodes.filter((node) => node.kind === 'table').map((node) => node.end),
  )
  let finalLineIndex = 0
  let codeIndex = 0
  const hasLineEndOwner = (index: number) => {
    const start = byteOffsets[index]!
    while (code[codeIndex] && code[codeIndex]!.end <= start) codeIndex += 1
    const literal = code[codeIndex]
    if (literal && literal.start <= start) return false
    while (
      finalLineOwners[finalLineIndex] &&
      finalLineOwners[finalLineIndex]!.end <= start
    )
      finalLineIndex += 1
    const owner = finalLineOwners[finalLineIndex]
    return !owner || owner.start > start || owner.end <= byteOffsets[index + 1]!
  }
  const nodes: MarkdownAnchorNode[] = []
  const hasPrecedingBlock = (index: number) => {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (lines[cursor]!.text.trim() !== '') return true
    }
    return false
  }
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    if (insideAtomic[index]) continue
    if (line.text.startsWith('^') && line.text !== '^') {
      const parsed = parseMarkdownAnchorMarker(line.text, line.start)
      if (!parsed) continue
      if (!parsed.ok) {
        nodes.push(parsed)
        continue
      }
      const previous = index === 0 ? undefined : lines[index - 1]
      if (!previous || previous.text.trim() === '') {
        const gap = previous !== undefined && hasPrecedingBlock(index)
        nodes.push(
          fail(
            line.start,
            line.end,
            gap ? 'anchor-cross-gap' : 'anchor-orphan',
            gap
              ? 'exclusive-line anchors must directly follow their owning block'
              : 'following-line anchors need an owning block',
          ),
        )
        continue
      }
      if (
        !isAtomicOwnerLine(previous.text) &&
        !tableEnds.has(byteOffsets[index]!)
      ) {
        nodes.push(
          fail(
            line.start,
            line.end,
            'anchor-placement',
            'exclusive-line anchors belong to fenced/table/atomic blocks',
          ),
        )
        continue
      }
      nodes.push(parsed)
      continue
    }
    if (!hasLineEndOwner(index)) continue
    const parsed = parseMarkdownAnchorMarker(line.text, line.start)
    if (!parsed) continue
    if (!parsed.ok) {
      nodes.push(parsed)
      continue
    }
    if (unboundListStarts.has(byteOffsets[index]!)) {
      nodes.push(
        fail(
          parsed.ranges.marker.start,
          parsed.ranges.marker.end,
          'anchor-placement',
          'nested list items do not have a fragment target',
        ),
      )
      continue
    }
    if (
      parsed.placement === 'line-end' &&
      !INLINE_CAPABLE.test(
        line.text.slice(0, -parsed.ranges.full.end + parsed.ranges.full.start),
      )
    ) {
      nodes.push(
        fail(
          parsed.ranges.full.start,
          parsed.ranges.full.end,
          'anchor-placement',
          'line-end anchors require an inline-capable block',
        ),
      )
      continue
    }
    nodes.push(parsed)
  }
  const count = new Map<string, number>()
  for (const node of nodes) {
    if (node.ok) count.set(node.id, (count.get(node.id) ?? 0) + 1)
  }
  return Object.freeze(
    nodes.map((node) =>
      node.ok && count.get(node.id)! > 1
        ? fail(
            node.ranges.marker.start,
            node.ranges.marker.end,
            'anchor-duplicate',
            'duplicate anchor ids have no target',
          )
        : node,
    ),
  )
}

export type MarkdownAnchorMutationKind =
  | 'alias'
  | 'auto-id'
  | 'dom-post-process'
  | 'first-wins'
  | 'cross-gap-ownership'

export const evaluateMarkdownBlockAnchorMutations = (source: string) => {
  const authority = collectMarkdownAnchorNodes(source)
  const alias = /\{#([a-z0-9-]+)\}/.test(source)
    ? [{ ok: true, kind: 'anchor', id: 'alias', fragment: '#alias' }]
    : authority
  const autoId = authority.some((node) => node.ok)
    ? authority
    : [{ ok: true, kind: 'anchor', id: 'auto', fragment: '#auto' }]
  const firstWins = (() => {
    const valid = authority.filter(
      (node) => node.ok,
    ) as MarkdownAnchorValidNode[]
    if (valid.length <= 1) return valid
    return [valid[0]]
  })()
  const poison = Object.freeze({
    ok: true as const,
    kind: 'anchor' as const,
    id: 'poisoned',
    fragment: '#poisoned',
    placement: 'line-end' as const,
    ranges: {
      full: { start: 0, end: 0 },
      marker: { start: 0, end: 0 },
      id: { start: 0, end: 0 },
    },
  })
  const same = (left: unknown, right: unknown) =>
    JSON.stringify(left) === JSON.stringify(right)
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'alias' as const,
        equivalent: same(authority, [...alias, poison]),
        accepted: false,
      }),
      Object.freeze({
        kind: 'auto-id' as const,
        equivalent: same(authority, [...autoId, poison]),
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-post-process' as const,
        equivalent: same(authority, [poison]),
        accepted: false,
      }),
      Object.freeze({
        kind: 'first-wins' as const,
        equivalent: same(authority, [...firstWins, poison]),
        accepted: false,
      }),
      Object.freeze({
        kind: 'cross-gap-ownership' as const,
        equivalent: same(authority, [poison]),
        accepted: false,
      }),
    ]),
  })
}
