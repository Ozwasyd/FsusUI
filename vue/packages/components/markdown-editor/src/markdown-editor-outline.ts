import {
  createMarkdownEditorProjection,
  createMarkdownOutlineEntries,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
} from '../../../wasm/markdown-runtime'

export interface MarkdownEditorOutlineRange {
  readonly start: number
  readonly end: number
}

export interface MarkdownOutlineDiagnostic {
  readonly code: string
  readonly nodeId?: string
}

export interface MarkdownEditorOutlineItem {
  readonly id: string
  readonly nodeId: string
  readonly depth: number
  readonly text: string
  readonly sourceRange: MarkdownEditorOutlineRange
  readonly contentRange: MarkdownEditorOutlineRange
  readonly parentId: string | null
  readonly diagnostics: readonly MarkdownOutlineDiagnostic[]
}

export type MarkdownEditorRevealResult =
  | 'success'
  | 'deleted'
  | 'stale'
  | 'not-found'
  | 'unsupported'

export interface MarkdownEditorOutlineInput {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly source: string
  readonly nodes: readonly {
    readonly kind: string
    readonly rawRange: MarkdownEditorOutlineRange
  }[]
}

const headingTitleOf = (source: string, range: MarkdownEditorOutlineRange) => {
  const slice = source.slice(range.start, range.end)
  const atx = /^(#{1,6})\s*(.*)$/u.exec(slice.trimEnd())
  if (atx) {
    return { level: atx[1]!.length, text: atx[2]!.trim() }
  }
  const setext = /^(.*)\n(=+|-+)\s*$/u.exec(slice.trimEnd())
  if (setext) {
    return { level: setext[2]!.startsWith('=') ? 1 : 2, text: setext[1]!.trim() }
  }
  return { level: 1, text: slice.trim() }
}

/** Leftover planner over caller-supplied projection nodes. Prefer `createMarkdownOutlineModel`. */
export const resolveMarkdownEditorOutline = (
  input: MarkdownEditorOutlineInput,
): readonly MarkdownEditorOutlineItem[] =>
  Object.freeze(
    input.nodes
      .filter((node) => node.kind === 'heading')
      .map((node, index) => {
        const heading = headingTitleOf(input.source, node.rawRange)
        const contentStart = Math.min(
          node.rawRange.end,
          node.rawRange.start + heading.level + 1,
        )
        return Object.freeze({
          id: `${input.documentIdentity.id}:${input.revision}:heading:${index}`,
          nodeId: `${input.documentIdentity.id}:${input.revision}:heading:${index}`,
          depth: heading.level,
          text: heading.text,
          sourceRange: Object.freeze({ ...node.rawRange }),
          contentRange: Object.freeze({
            start: contentStart,
            end: node.rawRange.end,
          }),
          parentId: null,
          diagnostics: Object.freeze([]),
        })
      }),
  )

export const createMarkdownOutlineModel = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  previous?: MarkdownStableProjection,
): {
  readonly projection: MarkdownStableProjection
  readonly items: readonly MarkdownEditorOutlineItem[]
} => {
  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
    previous,
  )
  const entries = createMarkdownOutlineEntries(projection)
  const stack: MarkdownEditorOutlineItem[] = []
  const items: MarkdownEditorOutlineItem[] = []
  const seenTitles = new Map<string, number>()
  for (const entry of entries) {
    const heading = headingTitleOf(source, entry.range)
    while (stack.length && stack[stack.length - 1]!.depth >= heading.level) {
      stack.pop()
    }
    const parent = stack[stack.length - 1]
    const diagnostics: MarkdownOutlineDiagnostic[] = []
    if (heading.level === 1 && seenTitles.get('#') ) {
      diagnostics.push({ code: 'duplicate-h1', nodeId: entry.id })
    }
    if (heading.level > 1 && !parent) {
      diagnostics.push({ code: 'heading-layer-jump', nodeId: entry.id })
    }
    if (parent && heading.level > parent.depth + 1) {
      diagnostics.push({ code: 'heading-layer-jump', nodeId: entry.id })
    }
    seenTitles.set('#', (seenTitles.get('#') ?? 0) + (heading.level === 1 ? 1 : 0))
    const item: MarkdownEditorOutlineItem = Object.freeze({
      id: entry.id,
      nodeId: entry.id,
      depth: heading.level,
      text: entry.title,
      sourceRange: Object.freeze({ ...entry.range }),
      contentRange: Object.freeze({
        start: Math.min(entry.range.end, entry.range.start + heading.level + 1),
        end: entry.range.end,
      }),
      parentId: parent?.id ?? null,
      diagnostics: Object.freeze(diagnostics),
    })
    items.push(item)
    stack.push(item)
  }
  return Object.freeze({
    projection,
    items: Object.freeze(items),
  })
}

export const revealHeading = (
  outline: readonly MarkdownEditorOutlineItem[],
  nodeId: string,
  expected: { readonly documentIdentity: MarkdownDocumentIdentity; readonly revision: number },
  actual: { readonly documentIdentity: MarkdownDocumentIdentity; readonly revision: number },
): MarkdownEditorRevealResult => {
  if (
    expected.documentIdentity.id !== actual.documentIdentity.id ||
    expected.documentIdentity.epoch !== actual.documentIdentity.epoch ||
    expected.revision !== actual.revision
  ) {
    return 'stale'
  }
  return outline.some((item) => item.nodeId === nodeId) ? 'success' : 'not-found'
}

export const revealSourceRange = (
  outline: readonly MarkdownEditorOutlineItem[],
  range: MarkdownEditorOutlineRange,
): MarkdownEditorRevealResult =>
  outline.some(
    (item) =>
      item.sourceRange.start <= range.start && item.sourceRange.end >= range.end,
  )
    ? 'success'
    : 'not-found'

export type MarkdownOutlineMutationKind =
  | 'regex-outline'
  | 'dom-outline'
  | 'text-key'
  | 'offset-key'
  | 'full-rebuild'

export const evaluateMarkdownOutlineMutations = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
) => {
  const authority = createMarkdownOutlineModel(source, documentIdentity)
  const regexOutline = [...source.matchAll(/^#{1,6} .+$/gm)].map((match, index) => ({
    id: `heading:${index}`,
    text: match[0],
  }))
  const textKey = authority.items.map((item) => ({ id: `hash:${item.text}` }))
  const offsetKey = authority.items.map((item) => ({
    id: `heading:${item.sourceRange.start}`,
  }))
  const same = (left: unknown, right: unknown) =>
    JSON.stringify(left) === JSON.stringify(right)
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'regex-outline' as const,
        equivalent: same(
          authority.items.map((item) => item.id),
          regexOutline.map((item) => item.id),
        ),
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-outline' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'text-key' as const,
        equivalent: same(
          authority.items.map((item) => item.id),
          textKey.map((item) => item.id),
        ),
        accepted: false,
      }),
      Object.freeze({
        kind: 'offset-key' as const,
        equivalent: same(
          authority.items.map((item) => item.id),
          offsetKey.map((item) => item.id),
        ),
        accepted: false,
      }),
      Object.freeze({
        kind: 'full-rebuild' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}
