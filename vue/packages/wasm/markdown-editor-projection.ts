import {
  MARKDOWN_RENDERER_VERSION,
  normalizeMarkdownSource,
  resolveMarkdownSourceIdentity,
} from './markdown'
import { collectMarkdownSyntaxNodesFromParser } from './markdown-syntax-collect'
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

export const createMarkdownEditorProjection = (
  rawSource: string,
): MarkdownEditorProjectionResult => {
  const coordinates = createMarkdownSourceCoordinateMap(rawSource)
  const normalizedSource = normalizeMarkdownSource(rawSource)
  if (coordinates.normalizedSource !== normalizedSource) {
    throw new Error('projection identity drifted from normalizeMarkdownSource')
  }

  const sourceIdentity = resolveMarkdownSourceIdentity(rawSource)
  const parserNodes = collectMarkdownSyntaxNodesFromParser(rawSource)
  const nodes: MarkdownEditorSyntaxNode[] = []
  const diagnostics: MarkdownEditorProjectionDiagnostic[] = []

  for (const node of parserNodes) {
    nodes.push(
      Object.freeze({
        kind: node.kind,
        presentation: presentationForSyntaxKind(node.kind),
        normalizedRange: { start: node.start, end: node.end },
        rawRange: coordinates.toRawRange({ start: node.start, end: node.end }),
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
