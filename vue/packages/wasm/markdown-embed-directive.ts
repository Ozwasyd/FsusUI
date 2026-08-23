export const MARKDOWN_EMBED_MODES = Object.freeze([
  'article',
  'heading',
  'block',
] as const)

export type MarkdownEmbedMode = (typeof MARKDOWN_EMBED_MODES)[number]

export const MARKDOWN_EMBED_DIAGNOSTIC_CODES = Object.freeze([
  'embed-indent',
  'embed-trailing-content',
  'embed-attribute-order',
  'embed-missing-target',
  'embed-missing-mode',
  'embed-unknown-attribute',
  'embed-empty-target',
  'embed-unknown-escape',
  'embed-control-char',
  'embed-bidi-char',
  'embed-newline-in-target',
  'embed-unclosed',
  'embed-invalid-mode',
  'embed-inferred-mode',
] as const)

export type MarkdownEmbedDiagnosticCode =
  (typeof MARKDOWN_EMBED_DIAGNOSTIC_CODES)[number]

export interface MarkdownEmbedSourceRange {
  readonly start: number
  readonly end: number
}

export interface MarkdownEmbedRanges {
  readonly full: MarkdownEmbedSourceRange
  readonly marker: MarkdownEmbedSourceRange
  readonly target: MarkdownEmbedSourceRange
  readonly mode: MarkdownEmbedSourceRange
}

export interface MarkdownEmbedValidNode {
  readonly ok: true
  readonly kind: 'embed'
  readonly target: string
  readonly mode: MarkdownEmbedMode
  readonly ranges: MarkdownEmbedRanges
}

export interface MarkdownEmbedInvalidNode {
  readonly ok: false
  readonly kind: 'embed'
  readonly code: MarkdownEmbedDiagnosticCode
  readonly message: string
  readonly range: MarkdownEmbedSourceRange
}

export type MarkdownEmbedNode = MarkdownEmbedValidNode | MarkdownEmbedInvalidNode

const BIDI_POINTS = new Set([
  0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066,
  0x2067, 0x2068, 0x2069,
])

const isEmbedMode = (value: string): value is MarkdownEmbedMode =>
  (MARKDOWN_EMBED_MODES as readonly string[]).includes(value)

const isControlChar = (code: number) =>
  (code >= 0 && code < 32) || code === 127

const isBidiChar = (code: number) => BIDI_POINTS.has(code)

const leadingWhitespaceWidth = (line: string) => {
  const match = /^[ \t]+/.exec(line)
  return match ? match[0].length : 0
}

const fail = (
  start: number,
  end: number,
  code: MarkdownEmbedDiagnosticCode,
  message: string,
): MarkdownEmbedInvalidNode =>
  Object.freeze({
    ok: false,
    kind: 'embed',
    code,
    message,
    range: Object.freeze({ start, end }),
  })

const parseQuoted = (
  source: string,
  openIndex: number,
):
  | {
      readonly ok: true
      readonly value: string
      readonly contentStart: number
      readonly closeIndex: number
    }
  | { readonly ok: false; readonly code: MarkdownEmbedDiagnosticCode } => {
  if (source[openIndex] !== '"') {
    return { ok: false, code: 'embed-unclosed' }
  }
  let index = openIndex + 1
  let value = ''
  while (index < source.length) {
    const char = source[index]!
    const code = source.charCodeAt(index)
    if (char === '"') {
      return {
        ok: true,
        value,
        contentStart: openIndex + 1,
        closeIndex: index,
      }
    }
    if (char === '\n' || char === '\r') {
      return { ok: false, code: 'embed-newline-in-target' }
    }
    if (char === '\\') {
      const next = source[index + 1]
      if (next === '\\') {
        value += '\\'
        index += 2
        continue
      }
      if (next === '"') {
        value += '"'
        index += 2
        continue
      }
      return { ok: false, code: 'embed-unknown-escape' }
    }
    if (isControlChar(code)) {
      return { ok: false, code: 'embed-control-char' }
    }
    if (isBidiChar(code)) {
      return { ok: false, code: 'embed-bidi-char' }
    }
    value += char
    index += 1
  }
  return { ok: false, code: 'embed-unclosed' }
}

const skipSpaces = (source: string, index: number) => {
  while (index < source.length && (source[index] === ' ' || source[index] === '\t')) {
    index += 1
  }
  return index
}

/**
 * Unique public embed grammar. Parses one source line (no trailing newline).
 * `lineStart` is the UTF-16 offset of the line inside the document being scanned.
 */
export const parseMarkdownEmbedLine = (
  line: string,
  lineStart = 0,
): MarkdownEmbedNode | null => {
  const indent = leadingWhitespaceWidth(line)
  const body = indent > 0 ? line.slice(indent) : line
  if (!body.startsWith('::embed[')) {
    return null
  }

  const lineEnd = lineStart + line.length
  if (indent > 0) {
    return fail(lineStart, lineEnd, 'embed-indent', 'embed directives cannot be indented')
  }

  const markerEnd = lineStart + '::embed'.length
  let cursor = '::embed['.length
  cursor = skipSpaces(line, cursor)

  if (!line.startsWith('target=', cursor)) {
    if (line.startsWith('mode=', cursor)) {
      return fail(
        lineStart,
        lineEnd,
        'embed-attribute-order',
        'embed attributes must appear as target then mode',
      )
    }
    return fail(lineStart, lineEnd, 'embed-missing-target', 'embed target is required')
  }
  cursor += 'target='.length
  const targetQuote = parseQuoted(line, cursor)
  if (!targetQuote.ok) {
    return fail(lineStart, lineEnd, targetQuote.code, 'embed target is invalid')
  }
  if (targetQuote.value.length === 0) {
    return fail(lineStart, lineEnd, 'embed-empty-target', 'embed target cannot be empty')
  }
  const targetRange = Object.freeze({
    start: lineStart + targetQuote.contentStart,
    end: lineStart + targetQuote.closeIndex,
  })
  cursor = targetQuote.closeIndex + 1
  cursor = skipSpaces(line, cursor)

  if (!line.startsWith('mode=', cursor)) {
    return fail(lineStart, lineEnd, 'embed-missing-mode', 'embed mode is required')
  }
  cursor += 'mode='.length
  const modeQuote = parseQuoted(line, cursor)
  if (!modeQuote.ok) {
    return fail(lineStart, lineEnd, modeQuote.code, 'embed mode is invalid')
  }
  const modeRange = Object.freeze({
    start: lineStart + modeQuote.contentStart,
    end: lineStart + modeQuote.closeIndex,
  })
  if (!isEmbedMode(modeQuote.value)) {
    const inferred = modeQuote.value.toLowerCase()
    if (isEmbedMode(inferred) && inferred !== modeQuote.value) {
      return fail(
        lineStart,
        lineEnd,
        'embed-inferred-mode',
        'embed mode is not inferred or normalized',
      )
    }
    return fail(
      lineStart,
      lineEnd,
      'embed-invalid-mode',
      'embed mode must be article, heading, or block',
    )
  }
  cursor = modeQuote.closeIndex + 1
  cursor = skipSpaces(line, cursor)
  if (line[cursor] !== ']') {
    return fail(
      lineStart,
      lineEnd,
      'embed-unknown-attribute',
      'embed directives reject extra attributes',
    )
  }
  cursor += 1
  if (cursor !== line.length) {
    return fail(
      lineStart,
      lineEnd,
      'embed-trailing-content',
      'embed directives cannot have trailing content',
    )
  }

  return Object.freeze({
    ok: true,
    kind: 'embed',
    target: targetQuote.value,
    mode: modeQuote.value,
    ranges: Object.freeze({
      full: Object.freeze({ start: lineStart, end: lineEnd }),
      marker: Object.freeze({ start: lineStart, end: markerEnd }),
      target: targetRange,
      mode: modeRange,
    }),
  })
}

export const collectMarkdownEmbedNodes = (
  source: string,
): readonly MarkdownEmbedNode[] => {
  const nodes: MarkdownEmbedNode[] = []
  let offset = 0
  while (offset <= source.length) {
    const newline = source.indexOf('\n', offset)
    const end = newline === -1 ? source.length : newline
    const line = source.slice(offset, end)
    const parsed = parseMarkdownEmbedLine(line, offset)
    if (parsed) nodes.push(parsed)
    if (newline === -1) break
    offset = newline + 1
  }
  return Object.freeze(nodes)
}

export const formatMarkdownEmbedDirective = (
  target: string,
  mode: MarkdownEmbedMode,
): string => {
  const escaped = target.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `::embed[target="${escaped}" mode="${mode}"]`
}

export interface MarkdownEmbedCommandPlan {
  readonly from: number
  readonly to: number
  readonly insert: string
}

export const planMarkdownEmbedInsert = (
  source: string,
  selection: MarkdownEmbedSourceRange,
  target: string,
  mode: MarkdownEmbedMode,
): MarkdownEmbedCommandPlan => {
  const parsed = parseMarkdownEmbedLine(
    formatMarkdownEmbedDirective(target, mode),
  )
  if (!parsed || !parsed.ok) {
    throw new Error('embed insert requires a valid target and mode')
  }
  const at = Math.max(0, Math.min(source.length, selection.start))
  const prefix = at > 0 && source[at - 1] !== '\n' ? '\n' : ''
  const suffix = at < source.length && source[at] !== '\n' ? '\n' : ''
  const insert = `${prefix}${formatMarkdownEmbedDirective(target, mode)}${suffix}`
  return Object.freeze({ from: at, to: at, insert })
}

export const planMarkdownEmbedEdit = (
  node: MarkdownEmbedValidNode,
  target: string,
  mode: MarkdownEmbedMode,
): MarkdownEmbedCommandPlan =>
  Object.freeze({
    from: node.ranges.full.start,
    to: node.ranges.full.end,
    insert: formatMarkdownEmbedDirective(target, mode),
  })

export const planMarkdownEmbedRemove = (
  node: MarkdownEmbedValidNode,
  source: string,
): MarkdownEmbedCommandPlan => {
  let to = node.ranges.full.end
  if (source[to] === '\n') to += 1
  return Object.freeze({ from: node.ranges.full.start, to, insert: '' })
}

export type MarkdownEmbedMutationKind =
  | 'wikilink'
  | 'inferred-mode'
  | 'extra-style-attr'
  | 'consumer-regex'

export interface MarkdownEmbedMutationResult {
  readonly kind: MarkdownEmbedMutationKind
  readonly equivalent: boolean
  readonly accepted: boolean
}

export interface MarkdownEmbedMutationReport {
  readonly authority: readonly MarkdownEmbedNode[]
  readonly mutations: readonly MarkdownEmbedMutationResult[]
}

const consumerRegexScan = (source: string): MarkdownEmbedNode[] => {
  const nodes: MarkdownEmbedNode[] = []
  const wikilink = /\[\[([^\]]+)\]\]/g
  for (const match of source.matchAll(wikilink)) {
    const start = match.index ?? 0
    nodes.push({
      ok: true,
      kind: 'embed',
      target: match[1] ?? '',
      mode: 'article',
      ranges: {
        full: { start, end: start + match[0].length },
        marker: { start, end: start + 2 },
        target: { start: start + 2, end: start + match[0].length - 2 },
        mode: { start, end: start },
      },
    })
  }
  const loose = /::embed\[[^\]]*\]/g
  for (const match of source.matchAll(loose)) {
    const start = match.index ?? 0
    nodes.push({
      ok: true,
      kind: 'embed',
      target: 'inferred',
      mode: 'article',
      ranges: {
        full: { start, end: start + match[0].length },
        marker: { start, end: start + 7 },
        target: { start, end: start },
        mode: { start, end: start },
      },
    })
  }
  return nodes
}

const inferModeScan = (source: string): MarkdownEmbedNode[] =>
  collectMarkdownEmbedNodes(source).map((node) => {
    if (node.ok) return node
    if (node.code === 'embed-inferred-mode' || node.code === 'embed-invalid-mode') {
      const line = source.slice(node.range.start, node.range.end)
      const modeMatch = /mode="([^"]*)"/.exec(line)
      const inferred = modeMatch?.[1]?.toLowerCase()
      if (inferred && isEmbedMode(inferred)) {
        return {
          ok: true,
          kind: 'embed',
          target: 'inferred',
          mode: inferred,
          ranges: {
            full: node.range,
            marker: node.range,
            target: node.range,
            mode: node.range,
          },
        }
      }
    }
    return node
  })

const extraAttrScan = (source: string): MarkdownEmbedNode[] =>
  collectMarkdownEmbedNodes(source).map((node) => {
    if (node.ok) return node
    if (node.code === 'embed-unknown-attribute') {
      return {
        ok: true,
        kind: 'embed',
        target: 'styled',
        mode: 'article',
        ranges: {
          full: node.range,
          marker: node.range,
          target: node.range,
          mode: node.range,
        },
      }
    }
    return node
  })

const sameAuthority = (
  left: readonly MarkdownEmbedNode[],
  right: readonly MarkdownEmbedNode[],
) => JSON.stringify(left) === JSON.stringify(right)

export const evaluateMarkdownEmbedMutations = (
  source: string,
): MarkdownEmbedMutationReport => {
  const authority = collectMarkdownEmbedNodes(source)
  const wikilink = consumerRegexScan(source)
  const inferred = inferModeScan(source)
  const extra = extraAttrScan(source)
  const mutations = Object.freeze([
    Object.freeze({
      kind: 'wikilink' as const,
      equivalent: sameAuthority(authority, wikilink),
      accepted: false,
    }),
    Object.freeze({
      kind: 'inferred-mode' as const,
      equivalent: sameAuthority(authority, inferred),
      accepted: false,
    }),
    Object.freeze({
      kind: 'extra-style-attr' as const,
      equivalent: sameAuthority(authority, extra),
      accepted: false,
    }),
    Object.freeze({
      kind: 'consumer-regex' as const,
      equivalent: sameAuthority(authority, wikilink),
      accepted: false,
    }),
  ])
  return Object.freeze({ authority, mutations })
}
