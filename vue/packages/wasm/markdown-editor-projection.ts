import {
  MARKDOWN_RENDER_PARSER,
  MARKDOWN_RENDERER_VERSION,
  normalizeMarkdownSource,
  resolveMarkdownSourceIdentity,
} from './markdown'
import { mergeMarkdownDirectiveSyntax } from './markdown-directive-syntax'
import {
  collectMarkdownSyntaxNodesFromParser,
  readMarkdownParserSyntaxKinds,
} from './markdown-syntax-collect'
import { createMarkdownSourceCoordinateMap } from './markdown-source-coordinate-map'

export const MARKDOWN_EDITOR_PROJECTION_PARSER = MARKDOWN_RENDER_PARSER

export type MarkdownEditorPresentation =
  | 'live-decorated'
  | 'live-atomic'
  | 'source-only-with-reason'
  | 'unsupported-error'

export type MarkdownEditorSyntaxStatus = 'valid' | 'malformed'

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
  'embed',
  'caption',
  'anchor',
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
  embed: 'live-atomic',
  caption: 'live-decorated',
  anchor: 'live-decorated',
  malformed: 'unsupported-error',
} as const satisfies Record<MarkdownEditorRequiredSyntaxKind, MarkdownEditorPresentation>)

export interface MarkdownEditorProjectionIdentity {
  readonly parser: typeof MARKDOWN_EDITOR_PROJECTION_PARSER
  readonly rawSource: string
  readonly normalizedSource: string
  readonly version: string
  readonly sourceIdentity: string
}

export interface MarkdownEditorSourceRange {
  readonly start: number
  readonly end: number
}

export type MarkdownEditorTableAlignment =
  | 'none'
  | 'left'
  | 'center'
  | 'right'

export interface MarkdownEditorTableSyntaxRow {
  readonly rawRange: MarkdownEditorSourceRange
  readonly normalizedRange: MarkdownEditorSourceRange
  readonly rawCellRanges: readonly MarkdownEditorSourceRange[]
  readonly normalizedCellRanges: readonly MarkdownEditorSourceRange[]
}

export interface MarkdownEditorTableSyntaxProjection {
  readonly rows: readonly MarkdownEditorTableSyntaxRow[]
  readonly separatorRow: number
  readonly alignments: readonly MarkdownEditorTableAlignment[]
}

export interface MarkdownEditorSyntaxNode {
  readonly blockIdentity: string
  readonly kind: string
  readonly status: MarkdownEditorSyntaxStatus
  readonly diagnosticCode: string | null
  readonly presentation: MarkdownEditorPresentation
  readonly rawRange: MarkdownEditorSourceRange
  readonly normalizedRange: MarkdownEditorSourceRange
  readonly rawContentRanges: readonly MarkdownEditorSourceRange[]
  readonly normalizedContentRanges: readonly MarkdownEditorSourceRange[]
  readonly rawMarkerRanges: readonly MarkdownEditorSourceRange[]
  readonly normalizedMarkerRanges: readonly MarkdownEditorSourceRange[]
  readonly parentRawRange: MarkdownEditorSourceRange | null
  readonly parentNormalizedRange: MarkdownEditorSourceRange | null
  readonly childRawRanges: readonly MarkdownEditorSourceRange[]
  readonly childNormalizedRanges: readonly MarkdownEditorSourceRange[]
  readonly table?: MarkdownEditorTableSyntaxProjection
}

export interface MarkdownEditorProjectionDiagnostic {
  readonly code: string
  readonly message: string
  readonly blockIdentity: string
  readonly rawRange: MarkdownEditorSourceRange
  readonly normalizedRange: MarkdownEditorSourceRange
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Object(value) === value

export const readMarkdownRenderIdentity = (
  value: unknown,
): MarkdownEditorProjectionIdentity => {
  if (!isRecord(value)) {
    throw new Error('markdown render identity requires an object')
  }

  if (isRecord(value.identity)) {
    return readMarkdownRenderIdentity(value.identity)
  }

  const parser =
    typeof value.parser === 'string'
      ? value.parser
      : MARKDOWN_EDITOR_PROJECTION_PARSER
  const rawSource =
    typeof value.rawSource === 'string' ? value.rawSource : undefined
  const normalizedSource =
    typeof value.normalizedSource === 'string'
      ? value.normalizedSource
      : undefined
  const sourceIdentity =
    typeof value.sourceIdentity === 'string' ? value.sourceIdentity : undefined
  const version =
    typeof value.version === 'string'
      ? value.version
      : typeof value.rendererVersion === 'string'
        ? value.rendererVersion
        : undefined

  if (
    !rawSource ||
    normalizedSource === undefined ||
    !sourceIdentity ||
    !version
  ) {
    throw new Error('markdown render identity is missing parser/source/version')
  }

  return Object.freeze({
    parser: parser as typeof MARKDOWN_EDITOR_PROJECTION_PARSER,
    rawSource,
    normalizedSource,
    version,
    sourceIdentity,
  })
}

export const markdownRenderIdentitiesEqual = (
  left: unknown,
  right: unknown,
): boolean => {
  const first = readMarkdownRenderIdentity(left)
  const second = readMarkdownRenderIdentity(right)
  return (
    first.parser === second.parser &&
    first.rawSource === second.rawSource &&
    first.normalizedSource === second.normalizedSource &&
    first.version === second.version &&
    first.sourceIdentity === second.sourceIdentity
  )
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

export const validateMarkdownEditorSyntaxCoverage = (
  parserKinds: readonly string[] = readMarkdownParserSyntaxKinds(),
): true => {
  const registered = new Set<string>(MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS)
  const supported = new Set(parserKinds)
  const duplicate = parserKinds.filter(
    (kind, index) => parserKinds.indexOf(kind) !== index,
  )
  const missing = MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS.filter(
    (kind) => !supported.has(kind),
  )
  const unregistered = parserKinds.filter((kind) => !registered.has(kind))
  if (missing.length > 0 || unregistered.length > 0 || duplicate.length > 0) {
    throw new Error(
      `markdown projection syntax coverage drift: missing=${missing.join(',')}; unregistered=${unregistered.join(',')}; duplicate=${duplicate.join(',')}`,
    )
  }
  return true
}

const utf8OffsetToNormalizedUtf16 = (normalized: string) => {
  const table = new Map<number, number>()
  let utf8Offset = 0
  let utf16Offset = 0
  table.set(0, 0)
  while (utf16Offset < normalized.length) {
    const code = normalized.charCodeAt(utf16Offset)
    if (code >= 0xd800 && code <= 0xdbff) {
      utf8Offset += 4
      utf16Offset += 2
    } else if (code <= 0x7f) {
      utf8Offset += 1
      utf16Offset += 1
    } else if (code <= 0x7ff) {
      utf8Offset += 2
      utf16Offset += 1
    } else {
      utf8Offset += 3
      utf16Offset += 1
    }
    table.set(utf8Offset, utf16Offset)
  }
  return (offset: number) => {
    const mapped = table.get(offset)
    if (mapped === undefined) {
      throw new Error(`parser UTF-8 offset ${offset} is outside the normalized source`)
    }
    return mapped
  }
}

export const createMarkdownEditorProjection = (
  rawSource: string,
): MarkdownEditorProjectionResult => {
  validateMarkdownEditorSyntaxCoverage()
  const coordinates = createMarkdownSourceCoordinateMap(rawSource)
  const normalizedSource = normalizeMarkdownSource(rawSource)
  if (coordinates.normalizedSource !== normalizedSource) {
    throw new Error('projection identity drifted from normalizeMarkdownSource')
  }

  const sourceIdentity = resolveMarkdownSourceIdentity(rawSource)
  const parserNodes = collectMarkdownSyntaxNodesFromParser(rawSource)
  const directed = mergeMarkdownDirectiveSyntax(normalizedSource, parserNodes)
  const parserProjectionNodes = [...directed.nodes].sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start
    if (left.end !== right.end) return right.end - left.end
    return left.kind.localeCompare(right.kind)
  })
  const nodes: MarkdownEditorSyntaxNode[] = []
  const diagnostics: MarkdownEditorProjectionDiagnostic[] = []
  const toUtf16 = utf8OffsetToNormalizedUtf16(normalizedSource)

  const toNormalizedRange = (start: number, end: number) =>
    Object.freeze({ start: toUtf16(start), end: toUtf16(end) })
  const toRawRange = (start: number, end: number) =>
    Object.freeze(coordinates.toRawRange(toNormalizedRange(start, end)))

  const mapNormalizedRanges = (
    ranges: readonly { readonly start: number; readonly end: number }[],
  ) => Object.freeze(ranges.map((range) => toNormalizedRange(range.start, range.end)))
  const mapRawRanges = (
    ranges: readonly { readonly start: number; readonly end: number }[],
  ) => Object.freeze(ranges.map((range) => toRawRange(range.start, range.end)))

  for (const [index, node] of parserProjectionNodes.entries()) {
    const hasParent =
      Number.isInteger(node.parentStart) && Number.isInteger(node.parentEnd)
    const blockIdentity = `block:${sourceIdentity}:${index}`
    const childNormalizedRanges = Object.freeze(
      (node.children ?? []).map((child) =>
        toNormalizedRange(child.start, child.end),
      ),
    )
    const childRawRanges = Object.freeze(
      (node.children ?? []).map((child) => toRawRange(child.start, child.end)),
    )
    const table =
      node.tableRows !== undefined &&
      node.tableSeparatorRow !== undefined &&
      node.tableAlignments !== undefined
        ? Object.freeze({
            rows: Object.freeze(
              node.tableRows.map((row) =>
                Object.freeze({
                  normalizedRange: toNormalizedRange(row.start, row.end),
                  rawRange: toRawRange(row.start, row.end),
                  normalizedCellRanges: mapNormalizedRanges(row.cells),
                  rawCellRanges: mapRawRanges(row.cells),
                }),
              ),
            ),
            separatorRow: node.tableSeparatorRow,
            alignments: Object.freeze([...node.tableAlignments]),
          })
        : undefined
    nodes.push(
      Object.freeze({
        blockIdentity,
        kind: node.kind,
        status: node.status,
        diagnosticCode: node.diagnosticCode,
        presentation:
          node.status === 'malformed'
            ? 'unsupported-error'
            : presentationForSyntaxKind(node.kind),
        normalizedRange: toNormalizedRange(node.start, node.end),
        rawRange: toRawRange(node.start, node.end),
        normalizedContentRanges: mapNormalizedRanges(node.contentRanges),
        rawContentRanges: mapRawRanges(node.contentRanges),
        normalizedMarkerRanges: mapNormalizedRanges(node.markerRanges),
        rawMarkerRanges: mapRawRanges(node.markerRanges),
        parentNormalizedRange: hasParent
          ? toNormalizedRange(node.parentStart as number, node.parentEnd as number)
          : null,
        parentRawRange: hasParent
          ? toRawRange(node.parentStart as number, node.parentEnd as number)
          : null,
        childNormalizedRanges,
        childRawRanges,
        ...(table ? { table } : {}),
      }),
    )
    if (node.status === 'malformed') {
      const normalizedRange = toNormalizedRange(node.start, node.end)
      const parserDiagnostic = directed.diagnostics.find(
        (diagnostic) =>
          diagnostic.code === node.diagnosticCode &&
          diagnostic.normalizedRange.start === node.start &&
          diagnostic.normalizedRange.end === node.end,
      )
      diagnostics.push(
        Object.freeze({
          code: node.diagnosticCode ?? 'malformed-syntax',
          message:
            parserDiagnostic?.message ??
            `malformed markdown syntax: ${
              node.diagnosticCode ?? 'malformed-syntax'
            }`,
          blockIdentity,
          normalizedRange,
          rawRange: toRawRange(node.start, node.end),
        }),
      )
    }
  }
  for (const diagnostic of directed.diagnostics) {
    const normalizedRange = toNormalizedRange(
      diagnostic.normalizedRange.start,
      diagnostic.normalizedRange.end,
    )
    const node =
      nodes.find(
        (candidate) =>
          candidate.normalizedRange.start === normalizedRange.start &&
          candidate.normalizedRange.end === normalizedRange.end,
      ) ?? nodes.find((candidate) => candidate.status === 'malformed')
    if (
      node &&
      !diagnostics.some(
        (candidate) =>
          candidate.code === diagnostic.code &&
          candidate.blockIdentity === node.blockIdentity,
      )
    ) {
      diagnostics.push(
        Object.freeze({
          code: diagnostic.code,
          message: diagnostic.message,
          blockIdentity: node.blockIdentity,
          normalizedRange,
          rawRange: Object.freeze(coordinates.toRawRange(normalizedRange)),
        }),
      )
    }
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

const sameRange = (
  left: MarkdownEditorSourceRange | null,
  right: MarkdownEditorSourceRange | null,
) => {
  if (left === null || right === null) return left === right
  return left.start === right.start && left.end === right.end
}

const sameRangeList = (
  left: readonly MarkdownEditorSourceRange[],
  right: readonly MarkdownEditorSourceRange[],
) =>
  left.length === right.length &&
  left.every((range, index) => sameRange(range, right[index] ?? null))

const diagnosticsEquivalent = (
  left: readonly MarkdownEditorProjectionDiagnostic[],
  right: readonly MarkdownEditorProjectionDiagnostic[],
) =>
  left.length === right.length &&
  left.every((diagnostic, index) => {
    const other = right[index]
    return (
      other !== undefined &&
      diagnostic.code === other.code &&
      diagnostic.message === other.message &&
      diagnostic.blockIdentity === other.blockIdentity &&
      sameRange(diagnostic.rawRange, other.rawRange) &&
      sameRange(diagnostic.normalizedRange, other.normalizedRange)
    )
  })

const tableProjectionsEquivalent = (
  left: MarkdownEditorTableSyntaxProjection | undefined,
  right: MarkdownEditorTableSyntaxProjection | undefined,
): boolean => {
  if (!left || !right) return left === right
  return (
    left.separatorRow === right.separatorRow &&
    left.alignments.length === right.alignments.length &&
    left.alignments.every(
      (alignment, index) => alignment === right.alignments[index],
    ) &&
    left.rows.length === right.rows.length &&
    left.rows.every((row, index) => {
      const other = right.rows[index]
      return (
        other !== undefined &&
        sameRange(row.rawRange, other.rawRange) &&
        sameRange(row.normalizedRange, other.normalizedRange) &&
        sameRangeList(row.rawCellRanges, other.rawCellRanges) &&
        sameRangeList(row.normalizedCellRanges, other.normalizedCellRanges)
      )
    })
  )
}

export const transferMarkdownEditorProjection = (
  projection: MarkdownEditorProjectionResult,
): MarkdownEditorProjectionResult =>
  JSON.parse(JSON.stringify(projection)) as MarkdownEditorProjectionResult

export const createMarkdownEditorWorkerProjection = (
  rawSource: string,
): MarkdownEditorProjectionResult =>
  transferMarkdownEditorProjection(createMarkdownEditorProjection(rawSource))

export const markdownEditorProjectionsEquivalent = (
  left: MarkdownEditorProjectionResult,
  right: MarkdownEditorProjectionResult,
): boolean => {
  if (!markdownRenderIdentitiesEqual(left, right)) return false
  if (left.syntaxCoverage.parser !== right.syntaxCoverage.parser) return false
  if (left.syntaxCoverage.version !== right.syntaxCoverage.version) return false
  if (left.syntaxCoverage.kinds.length !== right.syntaxCoverage.kinds.length) {
    return false
  }
  if (
    !left.syntaxCoverage.kinds.every(
      (kind, index) => kind === right.syntaxCoverage.kinds[index],
    )
  ) {
    return false
  }
  if (!diagnosticsEquivalent(left.diagnostics, right.diagnostics)) return false
  if (left.nodes.length !== right.nodes.length) return false
  return left.nodes.every((node, index) => {
    const other = right.nodes[index]
    if (!other) return false
    return (
      node.blockIdentity === other.blockIdentity &&
      node.kind === other.kind &&
      node.status === other.status &&
      node.diagnosticCode === other.diagnosticCode &&
      node.presentation === other.presentation &&
      sameRange(node.rawRange, other.rawRange) &&
      sameRange(node.normalizedRange, other.normalizedRange) &&
      sameRangeList(node.rawContentRanges, other.rawContentRanges) &&
      sameRangeList(node.normalizedContentRanges, other.normalizedContentRanges) &&
      sameRangeList(node.rawMarkerRanges, other.rawMarkerRanges) &&
      sameRangeList(node.normalizedMarkerRanges, other.normalizedMarkerRanges) &&
      sameRange(node.parentRawRange, other.parentRawRange) &&
      sameRange(node.parentNormalizedRange, other.parentNormalizedRange) &&
      sameRangeList(node.childRawRanges, other.childRawRanges) &&
      sameRangeList(node.childNormalizedRanges, other.childNormalizedRanges) &&
      tableProjectionsEquivalent(node.table, other.table)
    )
  })
}

export const compareMarkdownEditorProjectionThreads = (
  rawSource: string,
): {
  readonly equivalent: boolean
  readonly main: MarkdownEditorProjectionResult
  readonly worker: MarkdownEditorProjectionResult
} => {
  const main = createMarkdownEditorProjection(rawSource)
  const worker = createMarkdownEditorWorkerProjection(rawSource)
  return Object.freeze({
    equivalent: markdownEditorProjectionsEquivalent(main, worker),
    main,
    worker,
  })
}
