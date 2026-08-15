import {
  MARKDOWN_EDITOR_PROJECTION_PARSER,
  MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS,
  createMarkdownEditorProjection,
  markdownEditorProjectionsEquivalent,
  presentationForSyntaxKind,
  type MarkdownEditorProjectionResult,
  type MarkdownEditorRequiredSyntaxKind,
  type MarkdownEditorSyntaxNode,
} from './markdown-editor-projection'

export type MarkdownProjectionMutationKind =
  | 'html-dom-reverse'
  | 'second-parser-regex'
  | 'missing-syntax-coverage'

export interface MarkdownProjectionMutationResult {
  readonly kind: MarkdownProjectionMutationKind
  readonly equivalent: boolean
  readonly accepted: boolean
  readonly detail: string
}

export interface MarkdownProjectionMutationReport {
  readonly authority: MarkdownEditorProjectionResult
  readonly mutations: readonly MarkdownProjectionMutationResult[]
}

const visibleTextOf = (kind: string, slice: string) => {
  if (kind === 'heading') {
    return slice.replace(/^#{1,6}\s+/, '').trim()
  }
  if (kind === 'link') {
    const match = /^\[([^\]]*)\]\(/.exec(slice)
    return match?.[1] ?? slice
  }
  if (kind === 'image') {
    const match = /^!\[([^\]]*)\]\(/.exec(slice)
    return match?.[1] ?? slice
  }
  return slice.trim()
}

const cloneAuthority = (
  authority: MarkdownEditorProjectionResult,
  nodes: readonly MarkdownEditorSyntaxNode[],
  kinds: readonly MarkdownEditorRequiredSyntaxKind[] = authority.syntaxCoverage.kinds,
): MarkdownEditorProjectionResult =>
  Object.freeze({
    identity: authority.identity,
    nodes: Object.freeze(nodes),
    diagnostics: authority.diagnostics,
    syntaxCoverage: Object.freeze({
      ...authority.syntaxCoverage,
      kinds: Object.freeze([...kinds]),
    }),
  })

const reverseProjectFromHtml = (
  source: string,
  authority: MarkdownEditorProjectionResult,
): MarkdownEditorProjectionResult => {
  const nodes = authority.nodes.map((node) => {
    const slice = source.slice(node.rawRange.start, node.rawRange.end)
    const visible = visibleTextOf(node.kind, slice)
    const start = visible ? source.indexOf(visible) : node.rawRange.start
    const end = start >= 0 ? start + visible.length : node.rawRange.end
    return Object.freeze({
      ...node,
      rawRange: Object.freeze({ start: Math.max(0, start), end }),
      normalizedRange: Object.freeze({ start: Math.max(0, start), end }),
    })
  })
  return cloneAuthority(authority, nodes)
}

const reverseProjectFromRegex = (
  source: string,
  authority: MarkdownEditorProjectionResult,
): MarkdownEditorProjectionResult => {
  const nodes: MarkdownEditorSyntaxNode[] = []
  const heading = /^#{1,6} .+$/gm
  for (const match of source.matchAll(heading)) {
    const start = match.index ?? 0
    nodes.push(
      Object.freeze({
        kind: 'heading',
        presentation: presentationForSyntaxKind('heading'),
        rawRange: Object.freeze({ start, end: start + match[0].length }),
        normalizedRange: Object.freeze({ start, end: start + match[0].length }),
        parentRawRange: null,
        parentNormalizedRange: null,
        childRawRanges: Object.freeze([]),
        childNormalizedRanges: Object.freeze([]),
      }),
    )
  }
  const link = /!?\[([^\]]*)\]\(([^)]*)\)/g
  for (const match of source.matchAll(link)) {
    const start = match.index ?? 0
    const kind = match[0].startsWith('!') ? 'image' : 'link'
    nodes.push(
      Object.freeze({
        kind,
        presentation: presentationForSyntaxKind(kind),
        rawRange: Object.freeze({ start, end: start + match[0].length }),
        normalizedRange: Object.freeze({ start, end: start + match[0].length }),
        parentRawRange: null,
        parentNormalizedRange: null,
        childRawRanges: Object.freeze([]),
        childNormalizedRanges: Object.freeze([]),
      }),
    )
  }
  return cloneAuthority(authority, nodes)
}

const stripCoverageKind = (
  authority: MarkdownEditorProjectionResult,
  kind: MarkdownEditorRequiredSyntaxKind,
): MarkdownEditorProjectionResult =>
  cloneAuthority(
    authority,
    authority.nodes,
    authority.syntaxCoverage.kinds.filter((item) => item !== kind),
  )

export const markdownProjectionHasCompleteCoverage = (
  projection: MarkdownEditorProjectionResult,
): boolean => {
  if (projection.syntaxCoverage.parser !== MARKDOWN_EDITOR_PROJECTION_PARSER) {
    return false
  }
  const kinds = new Set(projection.syntaxCoverage.kinds)
  if (
    !MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS.every((kind) => kinds.has(kind))
  ) {
    return false
  }
  return projection.nodes.every((node) => {
    try {
      return presentationForSyntaxKind(node.kind) === node.presentation
    } catch {
      return false
    }
  })
}

export const evaluateMarkdownProjectionMutations = (
  source: string,
): MarkdownProjectionMutationReport => {
  const authority = createMarkdownEditorProjection(source)
  const htmlReverse = reverseProjectFromHtml(source, authority)
  const regexReverse = reverseProjectFromRegex(source, authority)
  const missingCoverage = stripCoverageKind(authority, 'malformed')
  const htmlEquivalent = markdownEditorProjectionsEquivalent(
    authority,
    htmlReverse,
  )
  const regexEquivalent = markdownEditorProjectionsEquivalent(
    authority,
    regexReverse,
  )
  const coverageEquivalent = markdownEditorProjectionsEquivalent(
    authority,
    missingCoverage,
  )

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'html-dom-reverse' as const,
        equivalent: htmlEquivalent,
        accepted:
          htmlEquivalent && markdownProjectionHasCompleteCoverage(htmlReverse),
        detail: 'html-indexOf visible text is not the sole parser',
      }),
      Object.freeze({
        kind: 'second-parser-regex' as const,
        equivalent: regexEquivalent,
        accepted:
          regexEquivalent && markdownProjectionHasCompleteCoverage(regexReverse),
        detail: 'regex scan is a second parser',
      }),
      Object.freeze({
        kind: 'missing-syntax-coverage' as const,
        equivalent: coverageEquivalent,
        accepted: markdownProjectionHasCompleteCoverage(missingCoverage),
        detail: 'required syntax kinds must stay registered',
      }),
    ]),
  })
}
