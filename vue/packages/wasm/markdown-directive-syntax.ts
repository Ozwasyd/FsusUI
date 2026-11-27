import { collectMarkdownAnchorNodes } from './markdown-anchor-grammar'
import { collectMarkdownCaptionNodes } from './markdown-caption-directive'
import {
  collectMarkdownEmbedNodes,
  type MarkdownEmbedNode,
} from './markdown-embed-directive'
import type { MarkdownParserSyntaxNode } from './markdown-syntax-collect'

export interface MarkdownDirectiveDiagnostic {
  readonly code: string
  readonly message: string
  readonly normalizedRange: MarkdownParserSyntaxNode['contentRanges'][number]
}

export interface MarkdownDirectiveCollectResult {
  readonly nodes: MarkdownParserSyntaxNode[]
  readonly diagnostics: readonly MarkdownDirectiveDiagnostic[]
  readonly embeds: readonly MarkdownEmbedNode[]
}

const utf16ToUtf8 = (source: string, utf16: number): number => {
  let utf8 = 0
  let index = 0
  while (index < utf16 && index < source.length) {
    const code = source.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      utf8 += 4
      index += 2
    } else if (code <= 0x7f) {
      utf8 += 1
      index += 1
    } else if (code <= 0x7ff) {
      utf8 += 2
      index += 1
    } else {
      utf8 += 3
      index += 1
    }
  }
  return utf8
}

const overlaps = (
  node: MarkdownParserSyntaxNode,
  start: number,
  end: number,
) => node.start < end && start < node.end

/**
 * Fold unique directive grammar into the sole projection parser node list.
 * Offsets stay on the normalized UTF-8 coordinate space used by the C++ collector.
 */
export const mergeMarkdownDirectiveSyntax = (
  normalizedSource: string,
  parserNodes: readonly MarkdownParserSyntaxNode[],
): MarkdownDirectiveCollectResult => {
  const embeds = collectMarkdownEmbedNodes(normalizedSource)
  const captions = collectMarkdownCaptionNodes(normalizedSource)
  const anchors = collectMarkdownAnchorNodes(normalizedSource)
  const diagnostics: MarkdownDirectiveDiagnostic[] = []
  const extra: MarkdownParserSyntaxNode[] = []

  const pushDirective = (
    kind: string,
    lineStart: number,
    lineEnd: number,
    contentRanges: readonly { readonly start: number; readonly end: number }[],
    markerRanges: readonly { readonly start: number; readonly end: number }[],
    diagnostic?: { readonly code: string; readonly message: string },
  ) => {
    const start = utf16ToUtf8(normalizedSource, lineStart)
    const atLineStart =
      lineStart === 0 || normalizedSource[lineStart - 1] === '\n'
    const end =
      utf16ToUtf8(normalizedSource, lineEnd) +
      (atLineStart && normalizedSource[lineEnd] === '\n' ? 1 : 0)
    const mapRanges = (
      ranges: readonly { readonly start: number; readonly end: number }[],
    ) =>
      Object.freeze(
        ranges.map((range) =>
          Object.freeze({
            start: utf16ToUtf8(normalizedSource, range.start),
            end: utf16ToUtf8(normalizedSource, range.end),
          }),
        ),
      )
    extra.push({
      kind,
      start,
      end,
      status: diagnostic ? 'malformed' : 'valid',
      diagnosticCode: diagnostic?.code ?? null,
      contentRanges: mapRanges(contentRanges),
      markerRanges: mapRanges(markerRanges),
    })
    if (diagnostic) {
      diagnostics.push(
        Object.freeze({
          ...diagnostic,
          normalizedRange: Object.freeze({ start, end }),
        }),
      )
    }
  }

  for (const group of [embeds, captions, anchors]) {
    for (const directive of group) {
      if (directive.ok === false) {
        pushDirective(
          'malformed',
          directive.range.start,
          directive.range.end,
          [directive.range],
          [],
          { code: directive.code, message: directive.message },
        )
        continue
      }
      const { kind, ranges } = directive
      const contentRanges =
        kind === 'embed'
          ? [ranges.target, ranges.mode]
          : [kind === 'caption' ? ranges.text : ranges.id]
      pushDirective(
        kind,
        ranges.full.start,
        ranges.full.end,
        contentRanges,
        [ranges.marker],
      )
    }
  }

  const kept = parserNodes.filter((node) => {
    if (
      node.kind !== 'paragraph' &&
      node.kind !== 'malformed' &&
      node.kind !== 'embed' &&
      node.kind !== 'caption' &&
      node.kind !== 'anchor'
    ) {
      return true
    }
    return !extra.some((directive) => overlaps(node, directive.start, directive.end))
  })

  return Object.freeze({
    nodes: [...kept, ...extra],
    diagnostics: Object.freeze(diagnostics),
    embeds,
  })
}
