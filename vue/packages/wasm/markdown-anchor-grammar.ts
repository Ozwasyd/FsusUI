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

export type MarkdownAnchorNode = MarkdownAnchorValidNode | MarkdownAnchorInvalidNode

const INLINE_CAPABLE = /^(#{1,6}\s+\S|\s*\S)/
const FENCE_OR_TABLE = /^(```|:::|\|)/

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
  const lines: { readonly text: string; readonly start: number; readonly end: number }[] = []
  let offset = 0
  while (offset <= source.length) {
    const newline = source.indexOf('\n', offset)
    const rawEnd = newline === -1 ? source.length : newline
    const end =
      rawEnd > offset && source[rawEnd - 1] === '\r' ? rawEnd - 1 : rawEnd
    lines.push({ text: source.slice(offset, end), start: offset, end })
    if (newline === -1) break
    offset = newline + 1
  }
  return lines
}

export const parseMarkdownAnchorMarker = (
  text: string,
  start: number,
): MarkdownAnchorNode | null => {
  const match = /(?:^| )(\^([a-zA-Z0-9-]{1,64}))$/.exec(text)
  if (!match || match.index === undefined) return null
  const marker = match[1]!
  const id = match[2]!
  const markerStart = start + match.index + (match[0].startsWith(' ') ? 1 : 0)
  const markerEnd = markerStart + marker.length
  if (!match[0].startsWith(' ') && match.index !== 0) {
    return fail(markerStart, markerEnd, 'anchor-placement', 'anchor requires a single leading space or exclusive line')
  }
  if (!MARKDOWN_ANCHOR_ID.test(id)) {
    return fail(markerStart, markerEnd, 'anchor-invalid-id', 'anchor id must match [a-z][a-z0-9-]{0,63}')
  }
  return Object.freeze({
    ok: true,
    kind: 'anchor',
    id,
    fragment: `#${id}`,
    placement: match.index === 0 ? 'following-line' : 'line-end',
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
  const lines = splitLines(source)
  const nodes: MarkdownAnchorNode[] = []
  const seen = new Map<string, number>()
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    if (line.text.startsWith('^') && line.text !== '^') {
      const parsed = parseMarkdownAnchorMarker(line.text, line.start)
      if (!parsed) continue
      if (!parsed.ok) {
        nodes.push(parsed)
        continue
      }
      const previous = index === 0 ? undefined : lines[index - 1]
      if (!previous || previous.text.trim() === '') {
        nodes.push(
          fail(line.start, line.end, 'anchor-orphan', 'following-line anchors need an owning block'),
        )
        continue
      }
      if (!FENCE_OR_TABLE.test(previous.text) && previous.text.trim() !== '```') {
        const gap = previous.text.trim() === ''
        nodes.push(
          fail(
            line.start,
            line.end,
            gap ? 'anchor-cross-gap' : 'anchor-placement',
            'exclusive-line anchors belong to fenced/table/atomic blocks',
          ),
        )
        continue
      }
      if (seen.has(parsed.id)) {
        nodes.push(
          fail(line.start, line.end, 'anchor-duplicate', 'duplicate anchor ids are not renamed'),
        )
        continue
      }
      seen.set(parsed.id, index)
      nodes.push(parsed)
      continue
    }
    const parsed = parseMarkdownAnchorMarker(line.text, line.start)
    if (!parsed) continue
    if (!parsed.ok) {
      nodes.push(parsed)
      continue
    }
    if (parsed.placement === 'line-end' && !INLINE_CAPABLE.test(line.text.slice(0, -parsed.ranges.full.end + parsed.ranges.full.start))) {
      nodes.push(
        fail(parsed.ranges.full.start, parsed.ranges.full.end, 'anchor-placement', 'line-end anchors require an inline-capable block'),
      )
      continue
    }
    if (seen.has(parsed.id)) {
      nodes.push(
        fail(parsed.ranges.full.start, parsed.ranges.full.end, 'anchor-duplicate', 'duplicate anchor ids are not renamed'),
      )
      continue
    }
    seen.set(parsed.id, index)
    nodes.push(parsed)
  }
  return Object.freeze(nodes)
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
    const valid = authority.filter((node) => node.ok) as MarkdownAnchorValidNode[]
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
