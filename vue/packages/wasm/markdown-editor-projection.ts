import {
  MARKDOWN_RENDERER_VERSION,
  detectMarkdownPlaceholders,
  normalizeMarkdownSource,
  resolveMarkdownSourceIdentity,
  type MarkdownPlaceholderKind,
} from './markdown'
import { createMarkdownSourceCoordinateMap } from './markdown-source-coordinate-map'

export const MARKDOWN_EDITOR_PROJECTION_PARSER = 'fsus-markdown-runtime'

export type MarkdownEditorPresentation =
  | 'live-decorated'
  | 'live-atomic'
  | 'source-only-with-reason'
  | 'unsupported-error'

export const MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS = Object.freeze([
  'heading',
  'paragraph',
  'list',
  'task',
  'quote',
  'table',
  'link',
  'image',
  'code',
  'latex',
  'mermaid',
  'footnote',
  'explicit-paragraph',
  'malformed',
] as const)

export type MarkdownEditorRequiredSyntaxKind =
  (typeof MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS)[number]

const MARKDOWN_EDITOR_KIND_PRESENTATION = Object.freeze({
  heading: 'live-decorated',
  paragraph: 'live-decorated',
  list: 'live-decorated',
  task: 'live-decorated',
  quote: 'live-decorated',
  table: 'live-atomic',
  link: 'live-decorated',
  image: 'live-atomic',
  code: 'source-only-with-reason',
  latex: 'live-atomic',
  mermaid: 'live-atomic',
  footnote: 'live-decorated',
  'explicit-paragraph': 'live-decorated',
  malformed: 'unsupported-error',
} as const satisfies Record<MarkdownEditorRequiredSyntaxKind, MarkdownEditorPresentation>)

export interface MarkdownEditorProjectionIdentity {
  readonly parser: typeof MARKDOWN_EDITOR_PROJECTION_PARSER
  readonly rawSource: string
  readonly normalizedSource: string
  readonly version: string
  readonly sourceIdentity: string
}

export interface MarkdownEditorSyntaxNode {
  readonly kind: string
  readonly presentation: MarkdownEditorPresentation
  readonly rawRange: { readonly start: number; readonly end: number }
  readonly normalizedRange: { readonly start: number; readonly end: number }
}

export interface MarkdownEditorProjectionDiagnostic {
  readonly code: string
  readonly message: string
}

export interface MarkdownEditorSyntaxCoverage {
  readonly parser: typeof MARKDOWN_EDITOR_PROJECTION_PARSER
  readonly version: string
  readonly kinds: readonly MarkdownEditorRequiredSyntaxKind[]
  readonly presentation: Readonly<
    Record<MarkdownEditorRequiredSyntaxKind, MarkdownEditorPresentation>
  >
}

export interface MarkdownEditorProjectionResult {
  readonly identity: MarkdownEditorProjectionIdentity
  readonly nodes: readonly MarkdownEditorSyntaxNode[]
  readonly diagnostics: readonly MarkdownEditorProjectionDiagnostic[]
  readonly syntaxCoverage: MarkdownEditorSyntaxCoverage
}

export const presentationForSyntaxKind = (
  kind: string,
): MarkdownEditorPresentation => {
  if (kind in MARKDOWN_EDITOR_KIND_PRESENTATION) {
    return MARKDOWN_EDITOR_KIND_PRESENTATION[
      kind as MarkdownEditorRequiredSyntaxKind
    ]
  }
  throw new Error(`unregistered markdown editor projection kind: ${kind}`)
}

const placeholderKindToSyntax = (
  kind: MarkdownPlaceholderKind,
): MarkdownEditorRequiredSyntaxKind => {
  if (kind === 'mermaid_block') {
    return 'mermaid'
  }
  if (kind === 'latex_block' || kind === 'latex_inline') {
    return 'latex'
  }
  throw new Error(`unregistered markdown placeholder kind: ${kind}`)
}

const normalizedOffsetAtLine = (normalized: string, line: number) => {
  if (line <= 1) {
    return 0
  }
  let seen = 1
  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] === '\n') {
      seen += 1
      if (seen === line) {
        return index + 1
      }
    }
  }
  return normalized.length
}

export const createMarkdownEditorProjection = (
  rawSource: string,
): MarkdownEditorProjectionResult => {
  const coordinates = createMarkdownSourceCoordinateMap(rawSource)
  const normalizedSource = normalizeMarkdownSource(rawSource)
  if (coordinates.normalizedSource !== normalizedSource) {
    throw new Error('projection identity drifted from normalizeMarkdownSource')
  }

  const sourceIdentity = resolveMarkdownSourceIdentity(rawSource)
  const placeholders = detectMarkdownPlaceholders(rawSource)
  const nodes: MarkdownEditorSyntaxNode[] = []
  const diagnostics: MarkdownEditorProjectionDiagnostic[] = []

  for (const placeholder of placeholders) {
    const kind = placeholderKindToSyntax(placeholder.kind)
    const start = normalizedOffsetAtLine(normalizedSource, placeholder.line)
    const endLine = placeholder.endLine ?? placeholder.line
    const end = Math.max(
      start,
      normalizedOffsetAtLine(normalizedSource, endLine + 1),
    )
    nodes.push(
      Object.freeze({
        kind,
        presentation: presentationForSyntaxKind(kind),
        normalizedRange: { start, end },
        rawRange: coordinates.toRawRange({ start, end }),
      }),
    )
  }

  return Object.freeze({
    identity: Object.freeze({
      parser: MARKDOWN_EDITOR_PROJECTION_PARSER,
      rawSource: coordinates.rawSource,
      normalizedSource,
      version: MARKDOWN_RENDERER_VERSION,
      sourceIdentity,
    }),
    nodes: Object.freeze(nodes),
    diagnostics: Object.freeze(diagnostics),
    syntaxCoverage: Object.freeze({
      parser: MARKDOWN_EDITOR_PROJECTION_PARSER,
      version: MARKDOWN_RENDERER_VERSION,
      kinds: MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS,
      presentation: MARKDOWN_EDITOR_KIND_PRESENTATION,
    }),
  })
}
