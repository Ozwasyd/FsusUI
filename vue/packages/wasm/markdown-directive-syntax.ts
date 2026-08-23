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

const exclusiveUtf8End = (
  source: string,
  lineStart: number,
  lineEnd: number,
): number => {
  const utf8End = utf16ToUtf8(source, lineEnd)
  if (lineEnd < source.length && source[lineEnd] === '\n') {
    return utf8End + 1
  }
  return utf8End
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
    diagnostic?: { readonly code: string; readonly message: string },
  ) => {
    const start = utf16ToUtf8(normalizedSource, lineStart)
    const atLineStart =
      lineStart === 0 || normalizedSource[lineStart - 1] === '\n'
    const end = atLineStart
      ? exclusiveUtf8End(normalizedSource, lineStart, lineEnd)
      : utf16ToUtf8(normalizedSource, lineEnd)
    extra.push({ kind, start, end })
    if (diagnostic) diagnostics.push(Object.freeze(diagnostic))
  }

  for (const embed of embeds) {
    if ('ranges' in embed) {
      pushDirective('embed', embed.ranges.full.start, embed.ranges.full.end)
    } else {
      pushDirective('malformed', embed.range.start, embed.range.end, {
        code: embed.code,
        message: embed.message,
      })
    }
  }
  for (const caption of captions) {
    if ('ranges' in caption) {
      pushDirective('caption', caption.ranges.full.start, caption.ranges.full.end)
    } else {
      pushDirective('malformed', caption.range.start, caption.range.end, {
        code: caption.code,
        message: caption.message,
      })
    }
  }
  for (const anchor of anchors) {
    if ('ranges' in anchor) {
      pushDirective('anchor', anchor.ranges.full.start, anchor.ranges.full.end)
    } else {
      pushDirective('malformed', anchor.range.start, anchor.range.end, {
        code: anchor.code,
        message: anchor.message,
      })
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
