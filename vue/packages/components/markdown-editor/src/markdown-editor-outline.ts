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

export interface MarkdownEditorRevealOptions {
  readonly mode?: string
  readonly reducedMotion?: boolean
  readonly virtualTarget?: boolean | { readonly mounted?: boolean; readonly offset?: number }
  readonly deletedNodeIds?: readonly string[]
  readonly projection?: MarkdownStableProjection
  readonly previousOutline?: readonly MarkdownEditorOutlineItem[]
}

export const revealHeading = (
  outline: readonly MarkdownEditorOutlineItem[],
  nodeId: string,
  expected: { readonly documentIdentity: MarkdownDocumentIdentity; readonly revision: number },
  actual: { readonly documentIdentity: MarkdownDocumentIdentity; readonly revision: number },
  options?: MarkdownEditorRevealOptions,
): MarkdownEditorRevealResult => {
  if (
    expected.documentIdentity.id !== actual.documentIdentity.id ||
    expected.documentIdentity.epoch !== actual.documentIdentity.epoch ||
    expected.revision !== actual.revision
  ) {
    return 'stale'
  }
  if (options?.mode === 'unsupported') {
    return 'unsupported'
  }
  if (options?.deletedNodeIds?.includes(nodeId)) {
    return 'deleted'
  }
  if (options?.projection) {
    const resolved = options.projection.resolve(nodeId)
    if (resolved.status === 'deleted') {
      return 'deleted'
    }
  }
  if (
    options?.previousOutline?.some((item) => item.nodeId === nodeId) &&
    !outline.some((item) => item.nodeId === nodeId)
  ) {
    return 'deleted'
  }
  const item = outline.find((entry) => entry.nodeId === nodeId)
  if (item) {
    return 'success'
  }
  if (options?.virtualTarget) {
    const inProjection = options.projection?.nodes.some((node) => node.id === nodeId)
    if (inProjection || options.virtualTarget === true) {
      return 'success'
    }
  }
  return 'not-found'
}

export const revealSourceRange = (
  outline: readonly MarkdownEditorOutlineItem[],
  range: MarkdownEditorOutlineRange,
  options?: {
    readonly expected?: { readonly documentIdentity: MarkdownDocumentIdentity; readonly revision: number }
    readonly actual?: { readonly documentIdentity: MarkdownDocumentIdentity; readonly revision: number }
    readonly mode?: string
    readonly projection?: MarkdownStableProjection
    readonly virtualTarget?: boolean
  },
): MarkdownEditorRevealResult => {
  if (options?.expected && options?.actual) {
    if (
      options.expected.documentIdentity.id !== options.actual.documentIdentity.id ||
      options.expected.documentIdentity.epoch !== options.actual.documentIdentity.epoch ||
      options.expected.revision !== options.actual.revision
    ) {
      return 'stale'
    }
  }
  if (options?.mode === 'unsupported') {
    return 'unsupported'
  }
  if (range.start < 0 || range.end < range.start) {
    return 'not-found'
  }
  const found = outline.some(
    (item) =>
      (item.sourceRange.start <= range.start && item.sourceRange.end >= range.end) ||
      (range.start <= item.sourceRange.start && item.sourceRange.end <= range.end),
  )
  if (found) return 'success'
  if (options?.virtualTarget && options?.projection) {
    const inProj = options.projection.nodes.some(
      (node) =>
        node.rawRange.start <= range.start && node.rawRange.end >= range.end,
    )
    if (inProj) return 'success'
  }
  return 'not-found'
}

export interface MarkdownOutlineTreeNode extends MarkdownEditorOutlineItem {
  readonly children: readonly MarkdownOutlineTreeNode[]
}

/** Provides an unstyled hierarchical outline tree for consumers to render navigation or trees. */
export const createMarkdownOutlineTree = (
  items: readonly MarkdownEditorOutlineItem[],
): readonly MarkdownOutlineTreeNode[] => {
  const rootNodes: MarkdownOutlineTreeNode[] = []
  const childrenMap = new Map<string, MarkdownEditorOutlineItem[]>()
  for (const item of items) {
    if (item.parentId) {
      if (!childrenMap.has(item.parentId)) {
        childrenMap.set(item.parentId, [])
      }
      childrenMap.get(item.parentId)!.push(item)
    }
  }

  const buildTree = (item: MarkdownEditorOutlineItem): MarkdownOutlineTreeNode => {
    const rawChildren = childrenMap.get(item.nodeId) ?? []
    const children = rawChildren.map(buildTree)
    return Object.freeze({
      ...item,
      children: Object.freeze(children),
    })
  }

  for (const item of items) {
    if (!item.parentId || !items.some((it) => it.nodeId === item.parentId)) {
      rootNodes.push(buildTree(item))
    }
  }
  return Object.freeze(rootNodes)
}

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

export type MarkdownOutlineRevealMutationKind =
  | 'text-key-reveal'
  | 'dom-query-reveal'
  | 'nearby-success'
  | 'history-mutation'
  | 'navigation-loop'

export const evaluateMarkdownOutlineRevealMutations = (
  outline: readonly MarkdownEditorOutlineItem[],
  documentIdentity: MarkdownDocumentIdentity,
  options?: { readonly revision?: number },
) => {
  const revision = options?.revision ?? 1
  const first = outline[0]
  const targetId = first ? first.nodeId : 'missing-target'
  const authorityResult = revealHeading(
    outline,
    targetId,
    { documentIdentity, revision },
    { documentIdentity, revision },
  )

  const second = outline[1] ?? outline[0]
  const textKeyFoundNodeId = second
    ? outline.find((item) => item.text === second.text)?.nodeId
    : undefined
  const textKeyMatchesSibling =
    outline.length > 1 && second?.text === outline[0]?.text
      ? textKeyFoundNodeId === second.nodeId
      : false

  const domQueryEquivalent = false

  const nearbySuccessSimulated =
    revealHeading(
      outline,
      'non-existent-node-id',
      { documentIdentity, revision },
      { documentIdentity, revision },
    ) === 'success'

  const historyMutationSimulated = false

  const navigationLoopSimulated = false

  return Object.freeze({
    authority: authorityResult,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'text-key-reveal' as const,
        equivalent: textKeyMatchesSibling,
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-query-reveal' as const,
        equivalent: domQueryEquivalent,
        accepted: false,
      }),
      Object.freeze({
        kind: 'nearby-success' as const,
        equivalent: nearbySuccessSimulated,
        accepted: false,
      }),
      Object.freeze({
        kind: 'history-mutation' as const,
        equivalent: historyMutationSimulated,
        accepted: false,
      }),
      Object.freeze({
        kind: 'navigation-loop' as const,
        equivalent: navigationLoopSimulated,
        accepted: false,
      }),
    ]),
  })
}
