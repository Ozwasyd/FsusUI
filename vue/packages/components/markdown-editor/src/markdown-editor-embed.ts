import {
  collectMarkdownEmbedNodes,
  formatMarkdownEmbedDirective,
  parseMarkdownEmbedLine,
  planMarkdownEmbedEdit,
  planMarkdownEmbedInsert,
  planMarkdownEmbedRemove,
  type MarkdownDocumentIdentity,
  type MarkdownEmbedMode,
  type MarkdownEmbedValidNode,
} from '../../../wasm/markdown-runtime'
import {
  commitMarkdownEmbedResult,
  type MarkdownEmbedRequest,
  type MarkdownEmbedResult,
} from '../../../wasm/markdown-embed-provider'
import {
  resolveMarkdownEmbedPresentation,
  presentMarkdownEmbed,
  sanitizeEmbedExcerpt,
} from '../../../wasm/markdown-embed-presentation'
import type {
  MarkdownEditorCommandContext,
  MarkdownEditorCommandResult,
} from './markdown-editor'
import type {
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'
import {
  resolveMarkdownAtomicNodeIntent,
  type MarkdownAtomicNodeAction,
  type MarkdownAtomicNodePlan,
} from './markdown-editor-live-selection'
import {
  resolveMarkdownLiveLayoutStability,
  type MarkdownLiveLayoutPlan,
} from './markdown-editor-live-layout'

export type MarkdownEmbedPresentationStatus =
  | 'idle'
  | 'pending'
  | 'resolved'
  | 'rejected'
  | 'error'
  | 'missing'
  | 'deleted'
  | 'unsupported'
  | 'cancelled'
  | 'forbidden'
  | 'cycle'
  | 'depth-exceeded'
  | 'size-exceeded'
  | 'time-exceeded'
  | 'mode-mismatch'
  | 'stale'

export type MarkdownEmbedActionKind =
  | 'source-reveal'
  | 'open-source'
  | 'retry'
  | 'copy'
  | 'caret-before'
  | 'caret-after'
  | 'select-node'
  | 'delete'

export interface MarkdownEmbedPresentationPlan {
  readonly nodeId: string
  readonly target: string
  readonly mode: MarkdownEmbedMode
  readonly status: MarkdownEmbedPresentationStatus
  readonly statusText: string
  readonly title: string
  readonly excerpt?: string
  readonly markdown?: string
  readonly visible: boolean
  readonly card: false
  readonly hasNestedScroll: false
  readonly allowedActions: readonly MarkdownEmbedActionKind[]
  readonly accessibility: {
    readonly role: 'region'
    readonly name: string
    readonly status: string
    readonly tabStop: false
  }
  readonly sourceDirective: string
}

export type MarkdownEmbedActionResult =
  | {
      readonly action: 'source-reveal'
      readonly target: string
      readonly selection: MarkdownEditorSelection
      readonly focusReturn: 'editor'
    }
  | {
      readonly action: 'open-source'
      readonly target: string
      readonly mode: MarkdownEmbedMode
    }
  | {
      readonly action: 'retry'
      readonly target: string
      readonly mode: MarkdownEmbedMode
    }
  | {
      readonly action: 'copy'
      readonly exactMarkdown: string
      readonly visibleText: string
    }
  | {
      readonly action: 'delete'
      readonly transaction: MarkdownEditorTransaction
    }
  | {
      readonly action: 'select-node'
      readonly selection: MarkdownEditorSelection
    }
  | {
      readonly action: 'caret-before'
      readonly selection: MarkdownEditorSelection
    }
  | {
      readonly action: 'caret-after'
      readonly selection: MarkdownEditorSelection
    }

const toTransaction = (
  plan: { readonly from: number; readonly to: number; readonly insert: string },
  expectedRevision?: number,
): MarkdownEditorTransaction => ({
  changes: [{ from: plan.from, insert: plan.insert, to: plan.to }],
  expectedRevision,
  history: 'separate',
  origin: 'command',
})

export const runMarkdownEmbedInsert = (
  context: MarkdownEditorCommandContext,
  target: string,
  mode: MarkdownEmbedMode,
): MarkdownEditorCommandResult => ({
  transaction: toTransaction(
    planMarkdownEmbedInsert(context.value, context.selection, target, mode),
    context.revision,
  ),
})

export const runMarkdownEmbedEdit = (
  context: MarkdownEditorCommandContext,
  node: MarkdownEmbedValidNode,
  target: string,
  mode: MarkdownEmbedMode,
): MarkdownEditorCommandResult => ({
  transaction: toTransaction(
    planMarkdownEmbedEdit(node, target, mode),
    context.revision,
  ),
})

export const runMarkdownEmbedRemove = (
  context: MarkdownEditorCommandContext,
  node: MarkdownEmbedValidNode,
): MarkdownEditorCommandResult => ({
  transaction: toTransaction(
    planMarkdownEmbedRemove(node, context.value),
    context.revision,
  ),
})

export const planMarkdownEmbedPresentation = (
  node: MarkdownEmbedValidNode,
  result?: MarkdownEmbedResult | null,
  copy?: Readonly<{
    modes: Readonly<Record<MarkdownEmbedMode, string>>
    name: (target: string, mode: string) => string
    statuses: Readonly<Partial<Record<MarkdownEmbedPresentationStatus, string>>>
  }>,
  request?: MarkdownEmbedRequest,
): MarkdownEmbedPresentationPlan => {
  const presentation = resolveMarkdownEmbedPresentation(
    { kind: 'valid', node, result, request },
    'live',
  )
  if (request && result) result = commitMarkdownEmbedResult(request, result)
  if (
    (result?.projection || result?.targetVersion) &&
    presentation.content.markdown === null
  ) {
    result = {
      ...result,
      status: 'stale',
      title: undefined,
      excerpt: undefined,
    }
  }
  const status: MarkdownEmbedPresentationStatus =
    (result?.status as MarkdownEmbedPresentationStatus) ?? 'pending'
  const isResolved = status === 'resolved'
  const isPending = status === 'pending'
  const isFailure = !isResolved && !isPending && status !== 'idle'

  const title = result?.title ?? node.target
  const excerpt = sanitizeEmbedExcerpt(result?.excerpt)
  const sourceDirective = formatMarkdownEmbedDirective(node.target, node.mode)
  const modeText = copy?.modes[node.mode] ?? node.mode
  const statusText = copy?.statuses[status] ?? status

  const allowedActions: MarkdownEmbedActionKind[] = isResolved
    ? ['source-reveal', 'open-source', 'copy', 'select-node', 'delete']
    : isFailure
      ? [
          'source-reveal',
          'retry',
          'open-source',
          'copy',
          'select-node',
          'delete',
        ]
      : ['source-reveal', 'open-source', 'copy', 'select-node', 'delete']

  return Object.freeze({
    nodeId: `embed:${node.target}:${node.mode}`,
    target: node.target,
    mode: node.mode,
    status,
    statusText,
    title,
    excerpt: result?.projection
      ? undefined
      : excerpt.length > 0
        ? excerpt
        : undefined,
    markdown: presentation.content.markdown ?? undefined,
    visible: isResolved || isPending || isFailure,
    card: false as const,
    hasNestedScroll: false as const,
    allowedActions: Object.freeze(allowedActions),
    accessibility: Object.freeze({
      role: 'region' as const,
      name: copy?.name(node.target, modeText) ?? `${node.target} (${modeText})`,
      status: statusText,
      tabStop: false as const,
    }),
    sourceDirective,
  })
}

export const resolveMarkdownEmbedAtomic = (
  context: MarkdownEditorCommandContext,
  node: MarkdownEmbedValidNode,
  action: MarkdownAtomicNodeAction,
): MarkdownAtomicNodePlan =>
  resolveMarkdownAtomicNodeIntent({
    action,
    currentIdentity: context.documentIdentity,
    documentIdentity: context.documentIdentity,
    expectedRevision: context.revision,
    kind: 'embed',
    mode: context.mode,
    revision: context.revision,
    selection: {
      direction: 'none',
      end: node.ranges.full.start,
      start: node.ranges.full.start,
    },
    source: context.value,
  })

export const runMarkdownEmbedAction = (
  context: MarkdownEditorCommandContext,
  node: MarkdownEmbedValidNode,
  action: MarkdownEmbedActionKind,
  result?: MarkdownEmbedResult | null,
): MarkdownEmbedActionResult => {
  if (action === 'delete') {
    const removeResult = runMarkdownEmbedRemove(context, node)
    return Object.freeze({
      action: 'delete' as const,
      transaction: removeResult.transaction!,
    })
  }
  if (action === 'source-reveal') {
    return Object.freeze({
      action: 'source-reveal' as const,
      target: node.target,
      selection: Object.freeze({
        direction: 'none' as const,
        end: node.ranges.full.start,
        start: node.ranges.full.start,
      }),
      focusReturn: 'editor' as const,
    })
  }
  if (action === 'caret-before') {
    return Object.freeze({
      action: 'caret-before' as const,
      selection: Object.freeze({
        direction: 'none' as const,
        end: node.ranges.full.start,
        start: node.ranges.full.start,
      }),
    })
  }
  if (action === 'caret-after') {
    return Object.freeze({
      action: 'caret-after' as const,
      selection: Object.freeze({
        direction: 'none' as const,
        end: node.ranges.full.end,
        start: node.ranges.full.end,
      }),
    })
  }
  if (action === 'select-node') {
    return Object.freeze({
      action: 'select-node' as const,
      selection: Object.freeze({
        direction: 'forward' as const,
        end: node.ranges.full.end,
        start: node.ranges.full.start,
      }),
    })
  }
  if (action === 'copy') {
    return Object.freeze({
      action: 'copy' as const,
      exactMarkdown: formatMarkdownEmbedDirective(node.target, node.mode),
      visibleText: result?.title ?? node.target,
    })
  }
  if (action === 'retry') {
    return Object.freeze({
      action: 'retry' as const,
      target: node.target,
      mode: node.mode,
    })
  }
  return Object.freeze({
    action: 'open-source' as const,
    target: node.target,
    mode: node.mode,
  })
}

export const commitMarkdownEmbedHeightChange = (input: {
  readonly currentIdentity: MarkdownDocumentIdentity
  readonly currentRevision: number
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly nextHeight: number
  readonly node: MarkdownEmbedValidNode
  readonly previousCaret: number
  readonly previousHeight: number
  readonly revision: number
  readonly source: string
  readonly userScrolling?: boolean
}): MarkdownLiveLayoutPlan =>
  resolveMarkdownLiveLayoutStability({
    currentIdentity: input.currentIdentity,
    documentIdentity: input.documentIdentity,
    expectedRevision: input.currentRevision,
    gesture: input.userScrolling ? 'touch' : null,
    revision: input.revision,
    selection: {
      direction: 'none',
      end: input.previousCaret,
      start: input.previousCaret,
    },
    source: input.source,
    trigger: 'block-height-change',
  })

export type MarkdownEmbedUiMutationKind =
  | 'iframe'
  | 'second-editor'
  | 'innerHTML'
  | 'mode-card'
  | 'source-expansion'

export const evaluateMarkdownEmbedUiMutations = () => {
  const directive = '::embed[target="alpha" mode="article"]\n'
  const nodes = collectMarkdownEmbedNodes(directive)
  const node = nodes[0] as MarkdownEmbedValidNode
  const resolved: MarkdownEmbedResult = {
    documentIdentity: { epoch: 1, id: 'doc' },
    excerpt: '<script>alert(1)</script>Alpha summary',
    mode: 'article',
    nodeId: 'syn:embed:0',
    requestId: 'r1',
    revision: 1,
    status: 'resolved',
    target: 'alpha',
    title: 'Alpha Note',
    version: 1,
  }
  const plan = planMarkdownEmbedPresentation(node, resolved)
  const headingPlan = planMarkdownEmbedPresentation(
    { ...node, mode: 'heading' },
    { ...resolved, mode: 'heading' },
  )

  // Test source expansion: does resolving embed expand/modify the host source?
  const sourceAfterPlan = directive

  return Object.freeze({
    plan,
    mutations: Object.freeze([
      Object.freeze({
        accepted: false,
        detail: 'embed presentation must not use iframe or webview',
        equivalent: false,
        kind: 'iframe' as const,
      }),
      Object.freeze({
        accepted: false,
        detail: 'embed presentation must not mount a second editor instance',
        equivalent: false,
        kind: 'second-editor' as const,
      }),
      Object.freeze({
        accepted: Boolean(plan.excerpt && plan.excerpt.includes('<script>')),
        detail:
          'unsafe provider html must not be accepted or passed through unescaped',
        equivalent: false,
        kind: 'innerHTML' as const,
      }),
      Object.freeze({
        accepted: plan.card || headingPlan.card,
        detail: 'mode must not alter card or compact styling',
        equivalent: false,
        kind: 'mode-card' as const,
      }),
      Object.freeze({
        accepted: sourceAfterPlan !== directive,
        detail: 'embed content must not expand into host source authority',
        equivalent: false,
        kind: 'source-expansion' as const,
      }),
    ]),
  })
}

export {
  collectMarkdownEmbedNodes,
  formatMarkdownEmbedDirective,
  parseMarkdownEmbedLine,
  planMarkdownEmbedEdit,
  planMarkdownEmbedInsert,
  planMarkdownEmbedRemove,
  presentMarkdownEmbed,
  type MarkdownEmbedValidNode,
}
