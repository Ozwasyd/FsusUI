import {
  createMarkdownEditorProjection,
  createMarkdownOutlineEntries,
  stabilizeMarkdownEditorProjection,
  type MarkdownAnchorMap,
  type MarkdownDocumentIdentity,
  type MarkdownRevealTarget,
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
    return {
      level: setext[2]!.startsWith('=') ? 1 : 2,
      text: setext[1]!.trim(),
    }
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

export const createMarkdownOutlineModelFromProjection = (
  source: string,
  projection: MarkdownStableProjection,
): {
  readonly projection: MarkdownStableProjection
  readonly items: readonly MarkdownEditorOutlineItem[]
} => {
  const entries = createMarkdownOutlineEntries(projection)
  const nodesById = new Map(projection.nodes.map((node) => [node.id, node]))
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
    if (!entry.title) {
      diagnostics.push({ code: 'empty-heading', nodeId: entry.id })
    }
    if (heading.level === 1 && seenTitles.get('#')) {
      diagnostics.push({ code: 'duplicate-h1', nodeId: entry.id })
    }
    if (heading.level > 1 && !parent) {
      diagnostics.push({ code: 'heading-layer-jump', nodeId: entry.id })
    }
    if (parent && heading.level > parent.depth + 1) {
      diagnostics.push({ code: 'heading-layer-jump', nodeId: entry.id })
    }
    seenTitles.set(
      '#',
      (seenTitles.get('#') ?? 0) + (heading.level === 1 ? 1 : 0),
    )
    const node = nodesById.get(entry.id)!
    const firstContent = node.rawContentRanges[0]
    const lastContent = node.rawContentRanges[node.rawContentRanges.length - 1]
    const emptyContentOffset = node.rawMarkerRanges[0]?.end ?? entry.range.start
    const item: MarkdownEditorOutlineItem = Object.freeze({
      id: entry.id,
      nodeId: entry.id,
      depth: heading.level,
      text: entry.title,
      sourceRange: Object.freeze({ ...entry.range }),
      contentRange: Object.freeze({
        start: firstContent?.start ?? emptyContentOffset,
        end: lastContent?.end ?? emptyContentOffset,
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

export const createMarkdownOutlineModel = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  previous?: MarkdownStableProjection,
) =>
  createMarkdownOutlineModelFromProjection(
    source,
    stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      documentIdentity,
      previous,
    ),
  )

export interface MarkdownEditorRevealOptions {
  readonly mode?: string
  readonly reducedMotion?: boolean
  readonly expected?: {
    readonly documentIdentity: MarkdownDocumentIdentity
    readonly revision: number
  }
  readonly anchorMap?: MarkdownAnchorMap
  readonly virtualTarget?: MarkdownRevealTarget
  readonly deletedNodeIds?: readonly string[]
  readonly projection?: MarkdownStableProjection
  readonly previousOutline?: readonly MarkdownEditorOutlineItem[]
}

const sameDocumentIdentity = (
  left: MarkdownDocumentIdentity,
  right: MarkdownDocumentIdentity,
) => left.id === right.id && left.epoch === right.epoch

const virtualTargetMatches = (
  target: MarkdownRevealTarget | undefined,
  nodeId: string,
  actual: { readonly documentIdentity: MarkdownDocumentIdentity },
) =>
  target?.virtual === true &&
  target.anchorId === nodeId &&
  target.identity === actual.documentIdentity.id &&
  sameDocumentIdentity(target.documentIdentity, actual.documentIdentity)

export const revealHeading = (
  outline: readonly MarkdownEditorOutlineItem[],
  nodeId: string,
  expected: {
    readonly documentIdentity: MarkdownDocumentIdentity
    readonly revision: number
  },
  actual: {
    readonly documentIdentity: MarkdownDocumentIdentity
    readonly revision: number
  },
  options?: MarkdownEditorRevealOptions,
): MarkdownEditorRevealResult => {
  if (
    !sameDocumentIdentity(expected.documentIdentity, actual.documentIdentity) ||
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
  if (options?.anchorMap) {
    try {
      const target = options.anchorMap.reveal({ anchorId: nodeId })
      if (
        sameDocumentIdentity(target.documentIdentity, actual.documentIdentity)
      ) {
        return 'success'
      }
    } catch {
      // Unknown identities fail closed below.
    }
  }
  const virtualTarget = options?.virtualTarget
  if (
    virtualTarget &&
    virtualTargetMatches(virtualTarget, nodeId, actual)
  ) {
    const { start, end } = virtualTarget.range
    if (
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end >= start &&
      end <= (options?.anchorMap?.source.length ?? end)
    ) {
      return 'success'
    }
  }
  return 'not-found'
}

export const revealSourceRange = (
  outline: readonly MarkdownEditorOutlineItem[],
  range: MarkdownEditorOutlineRange,
  options?: {
    readonly expected?: {
      readonly documentIdentity: MarkdownDocumentIdentity
      readonly revision: number
    }
    readonly actual?: {
      readonly documentIdentity: MarkdownDocumentIdentity
      readonly revision: number
    }
    readonly mode?: string
    readonly reducedMotion?: boolean
    readonly sourceLength?: number
    readonly anchorMap?: MarkdownAnchorMap
    readonly projection?: MarkdownStableProjection
  },
): MarkdownEditorRevealResult => {
  if (options?.expected && options?.actual) {
    if (
      !sameDocumentIdentity(
        options.expected.documentIdentity,
        options.actual.documentIdentity,
      ) ||
      options.expected.revision !== options.actual.revision
    ) {
      return 'stale'
    }
  }
  if (options?.mode === 'unsupported') {
    return 'unsupported'
  }
  if (
    !Number.isInteger(range.start) ||
    !Number.isInteger(range.end) ||
    range.start < 0 ||
    range.end < range.start ||
    (options?.sourceLength !== undefined && range.end > options.sourceLength)
  ) {
    return 'not-found'
  }
  if (options?.anchorMap) {
    try {
      const reveal = options.anchorMap.sourceRangeToReveal(range)
      return reveal.identity === options.anchorMap.identity &&
        sameDocumentIdentity(
          reveal.documentIdentity,
          options.anchorMap.documentIdentity,
        )
        ? 'success'
        : 'not-found'
    } catch {
      return 'not-found'
    }
  }
  if (options?.sourceLength !== undefined) return 'success'
  const found = outline.some(
    (item) =>
      (item.sourceRange.start <= range.start &&
        item.sourceRange.end >= range.end) ||
      (range.start <= item.sourceRange.start &&
        item.sourceRange.end <= range.end),
  )
  if (found) return 'success'
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

  const buildTree = (
    item: MarkdownEditorOutlineItem,
  ): MarkdownOutlineTreeNode => {
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
  const regexOutline = [...source.matchAll(/^#{1,6} .+$/gm)].map(
    (match, index) => ({
      id: `heading:${index}`,
      text: match[0],
    }),
  )
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

interface MarkdownOutlineRevealMutationPlan {
  readonly status: MarkdownEditorRevealResult
  readonly range?: MarkdownEditorOutlineRange
  readonly navigationOwner: 'none' | 'outline' | 'typewriter'
  readonly historyMutated: boolean
}

const planRevealMutationResult = (
  status: MarkdownEditorRevealResult,
  range: MarkdownEditorOutlineRange | undefined,
  navigationOwner: MarkdownOutlineRevealMutationPlan['navigationOwner'],
  historyMutated: boolean,
): MarkdownOutlineRevealMutationPlan =>
  Object.freeze({
    status,
    ...(range ? { range: Object.freeze({ ...range }) } : {}),
    navigationOwner,
    historyMutated,
  })

const revealMutationPlansEqual = (
  left: MarkdownOutlineRevealMutationPlan,
  right: MarkdownOutlineRevealMutationPlan,
) => JSON.stringify(left) === JSON.stringify(right)

export const evaluateMarkdownOutlineRevealMutations = (
  outline: readonly MarkdownEditorOutlineItem[],
  documentIdentity: MarkdownDocumentIdentity,
  options?: { readonly revision?: number },
) => {
  const revision = options?.revision ?? 1
  const target = outline[1] ?? outline[0]
  const targetId = target?.nodeId ?? 'missing-target'
  const authorityResult = revealHeading(
    outline,
    targetId,
    { documentIdentity, revision },
    { documentIdentity, revision },
  )

  const authorityPlan = planRevealMutationResult(
    authorityResult,
    target?.sourceRange,
    'outline',
    false,
  )
  const textKeyTarget = target
    ? outline.find((item) => item.text === target.text)
    : undefined
  const textKeyPlan = planRevealMutationResult(
    textKeyTarget ? 'success' : 'not-found',
    textKeyTarget?.sourceRange,
    'outline',
    false,
  )
  const domTarget = outline[0]
  const domQueryPlan = planRevealMutationResult(
    domTarget ? 'success' : 'not-found',
    domTarget?.sourceRange,
    'outline',
    false,
  )
  const missingAuthority = revealHeading(
    outline,
    'non-existent-node-id',
    { documentIdentity, revision },
    { documentIdentity, revision },
  )
  const nearbyPlan = planRevealMutationResult(
    missingAuthority === 'not-found' ? 'success' : missingAuthority,
    outline[0]?.sourceRange,
    'outline',
    false,
  )
  const missingPlan = planRevealMutationResult(
    missingAuthority,
    undefined,
    'none',
    false,
  )
  const historyMutationPlan = planRevealMutationResult(
    authorityResult,
    target?.sourceRange,
    'outline',
    true,
  )
  const navigationLoopPlan = planRevealMutationResult(
    authorityResult,
    target?.sourceRange,
    'typewriter',
    false,
  )

  const mutations = [
    ['text-key-reveal', revealMutationPlansEqual(authorityPlan, textKeyPlan)],
    ['dom-query-reveal', revealMutationPlansEqual(authorityPlan, domQueryPlan)],
    ['nearby-success', revealMutationPlansEqual(missingPlan, nearbyPlan)],
    [
      'history-mutation',
      revealMutationPlansEqual(authorityPlan, historyMutationPlan),
    ],
    [
      'navigation-loop',
      revealMutationPlansEqual(authorityPlan, navigationLoopPlan),
    ],
  ] as const

  return Object.freeze({
    authority: authorityResult,
    mutations: Object.freeze(
      mutations.map(([kind, equivalent]) =>
        Object.freeze({ kind, equivalent, accepted: equivalent }),
      ),
    ),
  })
}
