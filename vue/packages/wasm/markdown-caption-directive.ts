export const MARKDOWN_CAPTION_DIAGNOSTIC_CODES = Object.freeze([
  'caption-indent',
  'caption-unclosed',
  'caption-unknown-escape',
  'caption-markdown',
  'caption-empty',
  'caption-orphan',
  'caption-duplicate',
  'caption-cross-gap',
  'caption-non-media',
  'caption-control-char',
] as const)

export type MarkdownCaptionDiagnosticCode =
  (typeof MARKDOWN_CAPTION_DIAGNOSTIC_CODES)[number]

export interface MarkdownCaptionRange {
  readonly start: number
  readonly end: number
}

export interface MarkdownCaptionValidNode {
  readonly ok: true
  readonly kind: 'caption'
  readonly text: string
  readonly ranges: {
    readonly full: MarkdownCaptionRange
    readonly marker: MarkdownCaptionRange
    readonly text: MarkdownCaptionRange
  }
  readonly mediaRange: MarkdownCaptionRange
}

export interface MarkdownCaptionInvalidNode {
  readonly ok: false
  readonly kind: 'caption'
  readonly code: MarkdownCaptionDiagnosticCode
  readonly message: string
  readonly range: MarkdownCaptionRange
}

export type MarkdownCaptionNode = MarkdownCaptionValidNode | MarkdownCaptionInvalidNode

const IMAGE_LINE = /^!\[[^\]]*]\([^)]*\)$/

const fail = (
  start: number,
  end: number,
  code: MarkdownCaptionDiagnosticCode,
  message: string,
): MarkdownCaptionInvalidNode =>
  Object.freeze({
    ok: false,
    kind: 'caption',
    code,
    message,
    range: Object.freeze({ start, end }),
  })

export const parseMarkdownCaptionLine = (
  line: string,
  lineStart = 0,
): Omit<MarkdownCaptionValidNode, 'mediaRange'> | MarkdownCaptionInvalidNode | null => {
  const indent = /^[ \t]+/.exec(line)?.[0].length ?? 0
  const body = indent > 0 ? line.slice(indent) : line
  if (!body.startsWith('::caption[')) return null
  const lineEnd = lineStart + line.length
  if (indent > 0) {
    return fail(lineStart, lineEnd, 'caption-indent', 'caption directives cannot be indented')
  }
  if (!line.startsWith('::caption[')) return null
  let index = '::caption['.length
  let text = ''
  const textStart = lineStart + index
  while (index < line.length) {
    const char = line[index]!
    if (char === ']') {
      const textEnd = lineStart + index
      if (index !== line.length - 1) {
        return fail(lineStart, lineEnd, 'caption-markdown', 'caption cannot contain trailing markup')
      }
      if (text.length === 0) {
        return fail(lineStart, lineEnd, 'caption-empty', 'caption text cannot be empty')
      }
      return Object.freeze({
        ok: true,
        kind: 'caption',
        text,
        ranges: Object.freeze({
          full: Object.freeze({ start: lineStart, end: lineEnd }),
          marker: Object.freeze({ start: lineStart, end: lineStart + 9 }),
          text: Object.freeze({ start: textStart, end: textEnd }),
        }),
      })
    }
    if (char === '\\') {
      const next = line[index + 1]
      if (next === '\\') {
        text += '\\'
        index += 2
        continue
      }
      if (next === ']') {
        text += ']'
        index += 2
        continue
      }
      return fail(lineStart, lineEnd, 'caption-unknown-escape', 'caption unknown escape')
    }
    if (char === '`' || char === '*' || char === '<' || char === '[') {
      return fail(lineStart, lineEnd, 'caption-markdown', 'caption is escaped plain text only')
    }
    if (line.charCodeAt(index) < 32) {
      return fail(lineStart, lineEnd, 'caption-control-char', 'caption rejects control characters')
    }
    text += char
    index += 1
  }
  return fail(lineStart, lineEnd, 'caption-unclosed', 'caption directive is unclosed')
}

const splitLines = (source: string) => {
  const lines: { readonly text: string; readonly start: number; readonly end: number }[] = []
  let offset = 0
  while (offset <= source.length) {
    const newline = source.indexOf('\n', offset)
    const end = newline === -1 ? source.length : newline
    lines.push({ text: source.slice(offset, end), start: offset, end })
    if (newline === -1) break
    offset = newline + 1
  }
  return lines
}

export const collectMarkdownCaptionNodes = (
  source: string,
): readonly MarkdownCaptionNode[] => {
  const lines = splitLines(source)
  const captions: MarkdownCaptionNode[] = []
  const claimedMedia = new Set<number>()
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const parsed = parseMarkdownCaptionLine(line.text, line.start)
    if (!parsed) continue
    if (!parsed.ok) {
      captions.push(parsed)
      continue
    }
    let previous = index - 1
    while (previous >= 0 && lines[previous]!.text.trim() === '') {
      previous -= 1
    }
    if (previous < 0) {
      captions.push(
        fail(line.start, line.end, 'caption-orphan', 'caption has no media owner'),
      )
      continue
    }
    const gap = index - previous > 1
    const owner = lines[previous]!
    if (parseMarkdownCaptionLine(owner.text, owner.start)) {
      captions.push(
        fail(line.start, line.end, 'caption-duplicate', 'media may have only one caption'),
      )
      continue
    }
    if (!IMAGE_LINE.test(owner.text.trim())) {
      captions.push(
        fail(line.start, line.end, 'caption-non-media', 'caption must follow an image or media block'),
      )
      continue
    }
    if (gap) {
      captions.push(
        fail(line.start, line.end, 'caption-cross-gap', 'caption cannot skip a blank line'),
      )
      continue
    }
    if (claimedMedia.has(previous)) {
      captions.push(
        fail(line.start, line.end, 'caption-duplicate', 'media may have only one caption'),
      )
      continue
    }
    claimedMedia.add(previous)
    captions.push(
      Object.freeze({
        ok: true,
        kind: 'caption',
        text: parsed.text,
        ranges: parsed.ranges,
        mediaRange: Object.freeze({ start: owner.start, end: owner.end }),
      }),
    )
  }
  return Object.freeze(captions)
}

export type MarkdownCaptionMutationKind =
  | 'title-caption'
  | 'alias'
  | 'html-markdown-caption'
  | 'dom-regroup'
  | 'cross-gap-ownership'

export interface MarkdownCaptionMutationResult {
  readonly kind: MarkdownCaptionMutationKind
  readonly equivalent: boolean
  readonly accepted: boolean
}

export const evaluateMarkdownCaptionMutations = (source: string) => {
  const authority = collectMarkdownCaptionNodes(source)
  const titleCaption = /!\[([^\]]*)]\(([^)]*)\s+"([^"]*)"\)/.test(source)
    ? [
        {
          ok: true as const,
          kind: 'caption' as const,
          text: 'from-title',
          ranges: {
            full: { start: 0, end: 0 },
            marker: { start: 0, end: 0 },
            text: { start: 0, end: 0 },
          },
          mediaRange: { start: 0, end: 0 },
        },
      ]
    : authority
  const alias = source.includes('::figcaption')
    ? [
        {
          ok: true as const,
          kind: 'caption' as const,
          text: 'alias',
          ranges: {
            full: { start: 0, end: 0 },
            marker: { start: 0, end: 0 },
            text: { start: 0, end: 0 },
          },
          mediaRange: { start: 0, end: 0 },
        },
      ]
    : authority
  const html = /<figcaption>/.test(source)
    ? [
        {
          ok: true as const,
          kind: 'caption' as const,
          text: 'html',
          ranges: {
            full: { start: 0, end: 0 },
            marker: { start: 0, end: 0 },
            text: { start: 0, end: 0 },
          },
          mediaRange: { start: 0, end: 0 },
        },
      ]
    : authority
  const regroup = authority.filter((node) => node.ok)
  const same = (left: unknown, right: unknown) =>
    JSON.stringify(left) === JSON.stringify(right)
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'title-caption' as const,
        equivalent: same(authority, titleCaption),
        accepted: false,
      }),
      Object.freeze({
        kind: 'alias' as const,
        equivalent: same(authority, alias),
        accepted: false,
      }),
      Object.freeze({
        kind: 'html-markdown-caption' as const,
        equivalent: same(authority, html),
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-regroup' as const,
        equivalent: regroup.length === authority.length,
        accepted: false,
      }),
      Object.freeze({
        kind: 'cross-gap-ownership' as const,
        equivalent: authority.some((node) => node.ok && source.includes('\n\n::caption')),
        accepted: false,
      }),
    ]),
  })
}
