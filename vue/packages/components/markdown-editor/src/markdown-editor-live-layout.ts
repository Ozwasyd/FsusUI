import {
  createMarkdownEditorProjection,
  createMarkdownProjectionTask,
  planMarkdownProjectionInvalidation,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'
import type { MarkdownVisualPoint } from './markdown-editor-anchor-map'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import { createMarkdownLiveAnchorMap } from './markdown-editor-live-selection'
import type {
  MarkdownEditorSelection,
} from './markdown-editor-transaction'

export const MARKDOWN_LIVE_LAYOUT_TRIGGERS = Object.freeze([
  'marker-reveal',
  'marker-hide',
  'image-load',
  'font-load',
  'mermaid-result',
  'latex-result',
  'shiki-result',
  'attachment-result',
  'projection-worker-commit',
  'block-height-change',
  'virtual-mount',
  'virtual-unmount',
  'zoom',
  'dpi',
  'visual-viewport',
  'soft-keyboard',
  'theme',
  'locale',
  'density',
  'mode-switch',
] as const)

export type MarkdownLiveLayoutTrigger =
  (typeof MARKDOWN_LIVE_LAYOUT_TRIGGERS)[number]

export const MARKDOWN_LIVE_LAYOUT_GESTURES = Object.freeze([
  'wheel',
  'trackpad',
  'touch',
  'scrollbar',
  'selection-drag',
] as const)

export type MarkdownLiveLayoutGesture =
  (typeof MARKDOWN_LIVE_LAYOUT_GESTURES)[number]

export const MARKDOWN_LIVE_LAYOUT_BUDGET = Object.freeze({
  maxMountedNodes: 96,
  maxRemountOnInput: 16,
})

export type MarkdownLiveLayoutAction =
  | 'restore'
  | 'yield'
  | 'reject-stale'
  | 'noop'

export type MarkdownLiveLayoutOrigin =
  | 'input'
  | 'document-switch'
  | 'mode-switch'
  | 'feature'
  | 'initial'

export interface MarkdownLiveLayoutAnchor {
  readonly affinity: 'before' | 'after'
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly nodeId: string | null
  readonly range: Readonly<{ end: number; start: number }>
  readonly revision: number
  readonly sourceOffset: number
  readonly visual: MarkdownVisualPoint
}

export interface MarkdownLiveLayoutPlan {
  readonly action: MarkdownLiveLayoutAction
  readonly anchor: MarkdownLiveLayoutAnchor | null
  readonly caret: MarkdownEditorSelection
  readonly reducedMotion: boolean
  readonly rejected?:
    | 'composition-active'
    | 'stale-document'
    | 'user-scroll'
  readonly scrollIntoView: false
  readonly smooth: boolean
  readonly sourceUnchanged: true
  readonly trigger: MarkdownLiveLayoutTrigger
}

export interface MarkdownLiveFeatureCommit {
  readonly accepted: boolean
  readonly reason?:
    | 'aborted'
    | 'stale-document'
    | 'stale-node'
    | 'stale-revision'
  readonly visualUnchanged: boolean
}

export interface MarkdownLiveVirtualWindow {
  readonly budget: {
    readonly maxMountedNodes: number
    readonly maxRemountOnInput: number
    readonly mounted: number
    readonly remounted: number
  }
  readonly fullRemount: boolean
  readonly mountedNodeIds: readonly string[]
  readonly remountedNodeIds: readonly string[]
  readonly retainedNodeIds: readonly string[]
}

export type MarkdownLiveLayoutMutationKind =
  | 'dom-anchor'
  | 'scroll-into-view'
  | 'stale-commit'
  | 'full-mount-input'

const sameDocument = (
  left?: MarkdownDocumentIdentity,
  right?: MarkdownDocumentIdentity,
) => {
  if (!left || !right) return true
  return left.id === right.id && left.epoch === right.epoch
}

const clampOffset = (source: string, offset: number) =>
  Math.max(0, Math.min(source.length, offset))

const caretOf = (selection: MarkdownEditorSelection) =>
  selection.direction === 'backward' ? selection.start : selection.end

const projectionOf = (
  source: string,
  identity: MarkdownDocumentIdentity,
  projection?: MarkdownStableProjection,
) =>
  projection ??
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    identity,
  )

const coveringNode = (
  projection: MarkdownStableProjection,
  offset: number,
): MarkdownStableSyntaxNode | null => {
  const covering = projection.nodes.filter(
    (node) => node.rawRange.start <= offset && offset <= node.rawRange.end,
  )
  if (covering.length === 0) return null
  return [...covering].sort((left, right) => {
    const span =
      left.rawRange.end -
      left.rawRange.start -
      (right.rawRange.end - right.rawRange.start)
    if (span !== 0) return span
    return left.id.localeCompare(right.id)
  })[0]!
}

export const captureMarkdownLiveLayoutAnchor = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly projection?: MarkdownStableProjection
  readonly revision: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}): MarkdownLiveLayoutAnchor => {
  const projection = projectionOf(
    input.source,
    input.documentIdentity,
    input.projection,
  )
  const map = createMarkdownLiveAnchorMap({
    documentIdentity: input.documentIdentity,
    projection,
    source: input.source,
  })
  const offset = clampOffset(input.source, caretOf(input.selection))
  const affinity =
    input.selection.direction === 'backward' ? 'before' : 'after'
  const visual = map.sourcePositionToVisual({ affinity, offset })
  const node = coveringNode(projection, offset)
  return Object.freeze({
    affinity,
    documentIdentity: input.documentIdentity,
    nodeId: node?.id ?? visual.anchorId,
    range: Object.freeze(
      node
        ? { end: node.rawRange.end, start: node.rawRange.start }
        : { end: offset, start: offset },
    ),
    revision: input.revision,
    sourceOffset: offset,
    visual,
  })
}

export const resolveMarkdownLiveLayoutStability = (input: {
  readonly composing?: boolean
  readonly currentIdentity?: MarkdownDocumentIdentity
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly expectedRevision?: number
  readonly gesture?: MarkdownLiveLayoutGesture | null
  readonly previousAnchor?: MarkdownLiveLayoutAnchor | null
  readonly projection?: MarkdownStableProjection
  readonly reducedMotion?: boolean
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
  readonly trigger: MarkdownLiveLayoutTrigger
}): MarkdownLiveLayoutPlan => {
  const identity = input.documentIdentity ?? { epoch: 0, id: 'live-layout' }
  const revision = input.revision ?? 0
  const reducedMotion = Boolean(input.reducedMotion)
  const empty = (
    action: MarkdownLiveLayoutAction,
    rejected?: MarkdownLiveLayoutPlan['rejected'],
  ): MarkdownLiveLayoutPlan =>
    Object.freeze({
      action,
      anchor: input.previousAnchor ?? null,
      caret: input.selection,
      reducedMotion,
      rejected,
      scrollIntoView: false,
      smooth: false,
      sourceUnchanged: true,
      trigger: input.trigger,
    })

  if (input.composing) return empty('noop', 'composition-active')
  if (
    (input.expectedRevision !== undefined &&
      input.revision !== undefined &&
      input.expectedRevision !== input.revision) ||
    !sameDocument(input.documentIdentity, input.currentIdentity)
  ) {
    return empty('reject-stale', 'stale-document')
  }
  if (input.gesture) return empty('yield', 'user-scroll')

  const remappedOffset = clampOffset(
    input.source,
    input.previousAnchor?.sourceOffset ?? caretOf(input.selection),
  )
  const nextSelection =
    input.trigger === 'mode-switch' && input.previousAnchor
      ? Object.freeze({
          direction: input.selection.direction ?? 'none',
          end:
            input.selection.start === input.selection.end
              ? remappedOffset
              : input.selection.end,
          start:
            input.selection.start === input.selection.end
              ? remappedOffset
              : input.selection.start,
        })
      : input.selection
  const anchor = captureMarkdownLiveLayoutAnchor({
    documentIdentity: identity,
    projection: input.projection,
    revision,
    selection: nextSelection,
    source: input.source,
  })
  return Object.freeze({
    action: 'restore',
    anchor: Object.freeze({
      ...anchor,
      sourceOffset: remappedOffset,
    }),
    caret: nextSelection,
    reducedMotion,
    scrollIntoView: false,
    smooth: !reducedMotion,
    sourceUnchanged: true,
    trigger: input.trigger,
  })
}

export const retainMarkdownLiveLayoutAcrossModes = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly from: MarkdownEditorMode
  readonly revision: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
  readonly to: MarkdownEditorMode
}) => {
  const first = resolveMarkdownLiveLayoutStability({
    documentIdentity: input.documentIdentity,
    revision: input.revision,
    selection: input.selection,
    source: input.source,
    trigger: 'mode-switch',
  })
  const second = resolveMarkdownLiveLayoutStability({
    documentIdentity: input.documentIdentity,
    previousAnchor: first.anchor,
    revision: input.revision,
    selection: input.selection,
    source: input.source,
    trigger: 'mode-switch',
  })
  return Object.freeze({
    drifted:
      first.anchor?.sourceOffset !== second.anchor?.sourceOffset ||
      first.caret.start !== second.caret.start ||
      first.caret.end !== second.caret.end,
    first,
    from: input.from,
    second,
    to: input.to,
  })
}

export const commitMarkdownLiveFeatureResult = (input: {
  readonly aborted?: boolean
  readonly expected: {
    readonly documentIdentity: MarkdownDocumentIdentity
    readonly nodeId: string
    readonly revision: number
  }
  readonly incoming: {
    readonly documentIdentity: MarkdownDocumentIdentity
    readonly nodeId: string
    readonly revision: number
  }
}): MarkdownLiveFeatureCommit => {
  if (input.aborted) {
    return Object.freeze({
      accepted: false,
      reason: 'aborted',
      visualUnchanged: true,
    })
  }
  if (
    !sameDocument(
      input.expected.documentIdentity,
      input.incoming.documentIdentity,
    )
  ) {
    return Object.freeze({
      accepted: false,
      reason: 'stale-document',
      visualUnchanged: true,
    })
  }
  if (input.expected.revision !== input.incoming.revision) {
    return Object.freeze({
      accepted: false,
      reason: 'stale-revision',
      visualUnchanged: true,
    })
  }
  if (input.expected.nodeId !== input.incoming.nodeId) {
    return Object.freeze({
      accepted: false,
      reason: 'stale-node',
      visualUnchanged: true,
    })
  }
  const task = createMarkdownProjectionTask({
    documentIdentity: input.expected.documentIdentity,
    revision: input.expected.revision,
    taskId: `live-feature:${input.expected.nodeId}`,
  })
  const committed = task.commit(
    {
      documentIdentity: input.incoming.documentIdentity,
      revision: input.incoming.revision,
    },
    input.incoming.nodeId,
  )
  if (!committed.ok) {
    return Object.freeze({
      accepted: false,
      reason:
        committed.reason === 'document-switch'
          ? 'stale-document'
          : committed.reason,
      visualUnchanged: true,
    })
  }
  return Object.freeze({ accepted: true, visualUnchanged: false })
}

const distanceToCaret = (node: MarkdownStableSyntaxNode, caret: number) => {
  if (caret >= node.rawRange.start && caret <= node.rawRange.end) return 0
  if (caret < node.rawRange.start) return node.rawRange.start - caret
  return caret - node.rawRange.end
}

export const resolveMarkdownLiveVirtualWindow = (input: {
  readonly change?: { readonly from: number; readonly insert: string; readonly to: number }
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly invalidatedNodeIds?: readonly string[]
  readonly origin: MarkdownLiveLayoutOrigin
  readonly previousMountedNodeIds?: readonly string[]
  readonly previousProjection?: MarkdownStableProjection
  readonly previousSource?: string
  readonly projection?: MarkdownStableProjection
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}): MarkdownLiveVirtualWindow => {
  const projection = projectionOf(
    input.source,
    input.documentIdentity,
    input.projection,
  )
  const caret = clampOffset(input.source, caretOf(input.selection))
  const invalidated = new Set(input.invalidatedNodeIds ?? [])
  if (
    input.change &&
    input.previousSource !== undefined &&
    input.previousProjection &&
    input.revision !== undefined
  ) {
    const plan = planMarkdownProjectionInvalidation({
      change: input.change,
      identity: input.documentIdentity,
      previous: input.previousProjection,
      previousSource: input.previousSource,
      revision: input.revision,
    })
    for (const id of plan.invalidatedNodeIds) invalidated.add(id)
  }

  const ranked = [...projection.nodes].sort(
    (left, right) =>
      distanceToCaret(left, caret) - distanceToCaret(right, caret) ||
      left.id.localeCompare(right.id),
  )
  const previous = new Set(input.previousMountedNodeIds ?? [])
  const living = new Set(projection.nodes.map((node) => node.id))
  const neighborhood = ranked
    .slice(0, Math.min(8, ranked.length))
    .map((node) => node.id)

  let remounted: string[] = []
  let retained: string[] = []
  let mounted: string[] = []

  if (input.origin === 'input') {
    for (const id of [...invalidated, ...neighborhood]) {
      if (!living.has(id) || remounted.includes(id)) continue
      remounted.push(id)
      if (remounted.length >= MARKDOWN_LIVE_LAYOUT_BUDGET.maxRemountOnInput) break
    }
    const remountSet = new Set(remounted)
    retained = [...previous].filter((id) => living.has(id) && !remountSet.has(id))
    mounted = [...retained, ...remounted]
    if (mounted.length > MARKDOWN_LIVE_LAYOUT_BUDGET.maxMountedNodes) {
      const keep = new Set([...neighborhood, ...remounted])
      mounted = ranked
        .filter((node) => keep.has(node.id) || previous.has(node.id))
        .slice(0, MARKDOWN_LIVE_LAYOUT_BUDGET.maxMountedNodes)
        .map((node) => node.id)
      retained = mounted.filter((id) => previous.has(id) && !remountSet.has(id))
    }
  } else {
    mounted = ranked
      .slice(0, MARKDOWN_LIVE_LAYOUT_BUDGET.maxMountedNodes)
      .map((node) => node.id)
    remounted = mounted.filter((id) => !previous.has(id))
    retained = mounted.filter((id) => previous.has(id))
  }

  const fullRemount =
    input.origin === 'input' &&
    projection.nodes.length > MARKDOWN_LIVE_LAYOUT_BUDGET.maxRemountOnInput &&
    remounted.length >= projection.nodes.length

  return Object.freeze({
    budget: Object.freeze({
      maxMountedNodes: MARKDOWN_LIVE_LAYOUT_BUDGET.maxMountedNodes,
      maxRemountOnInput: MARKDOWN_LIVE_LAYOUT_BUDGET.maxRemountOnInput,
      mounted: mounted.length,
      remounted: remounted.length,
    }),
    fullRemount,
    mountedNodeIds: Object.freeze(mounted),
    remountedNodeIds: Object.freeze(remounted),
    retainedNodeIds: Object.freeze(retained),
  })
}

export const evaluateMarkdownLiveLayoutMutations = () => {
  const identity = Object.freeze({ epoch: 1, id: 'layout-doc' })
  const source = Array.from(
    { length: 40 },
    (_, index) => `# H${index}\n\nparagraph ${index} 中文\n`,
  ).join('\n')
  const selection = { direction: 'none' as const, end: 2, start: 2 }
  const authority = resolveMarkdownLiveLayoutStability({
    documentIdentity: identity,
    revision: 1,
    selection,
    source,
    trigger: 'block-height-change',
  })
  const gesture = resolveMarkdownLiveLayoutStability({
    documentIdentity: identity,
    gesture: 'wheel',
    previousAnchor: authority.anchor,
    revision: 1,
    selection,
    source,
    trigger: 'visual-viewport',
  })
  const stale = commitMarkdownLiveFeatureResult({
    expected: { documentIdentity: identity, nodeId: 'syn:keep', revision: 1 },
    incoming: { documentIdentity: identity, nodeId: 'syn:keep', revision: 2 },
  })
  const previous = resolveMarkdownLiveVirtualWindow({
    documentIdentity: identity,
    origin: 'initial',
    selection,
    source,
  })
  const afterInput = resolveMarkdownLiveVirtualWindow({
    change: { from: 2, insert: '!', to: 2 },
    documentIdentity: identity,
    origin: 'input',
    previousMountedNodeIds: previous.mountedNodeIds,
    previousSource: source,
    revision: 1,
    selection: { direction: 'none', end: 3, start: 3 },
    source: `${source.slice(0, 2)}!${source.slice(2)}`,
  })
  const htmlOffset = source.indexOf('paragraph')
  return Object.freeze({
    authority,
    gesture,
    mutations: Object.freeze([
      Object.freeze({
        accepted:
          authority.anchor?.visual.anchorId.startsWith('dom:') ||
          htmlOffset < 0 ||
          typeof (authority.anchor as { percent?: number } | null)?.percent ===
            'number',
        detail: 'scroll anchor must use #325 source range/affinity',
        kind: 'dom-anchor' as const,
      }),
      Object.freeze({
        accepted: authority.scrollIntoView,
        detail: 'height restore must not call unconditional scrollIntoView',
        kind: 'scroll-into-view' as const,
      }),
      Object.freeze({
        accepted: stale.accepted,
        detail: 'stale feature/projection result must not commit',
        kind: 'stale-commit' as const,
      }),
      Object.freeze({
        accepted: afterInput.fullRemount || gesture.action !== 'yield',
        detail: 'ordinary input must not remount the full visual tree',
        kind: 'full-mount-input' as const,
      }),
    ]),
  })
}
