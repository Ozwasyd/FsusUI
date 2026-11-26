import { computed, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import {
  collectMarkdownEmbedNodes,
  planMarkdownEmbedPresentation,
  runMarkdownEmbedAction,
  type MarkdownEmbedActionKind,
  type MarkdownEmbedPresentationPlan,
  type MarkdownEmbedValidNode,
} from '../markdown-editor-embed'
import {
  commitMarkdownEmbedResult,
  createMarkdownEmbedRequest,
  forgetMarkdownEmbedRequest,
  type MarkdownEmbedProvider,
  type MarkdownEmbedResult,
} from '../../../../wasm/markdown-embed-provider'
import type {
  MarkdownEditorDocumentIdentity,
  MarkdownEditorLocaleText,
  MarkdownEditorMode,
} from '../markdown-editor'
import type {
  MarkdownEditorDispatchResult,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from '../markdown-editor-transaction'

export type MarkdownEmbedRenderSegment =
  | { readonly content: string; readonly key: string; readonly kind: 'markdown' }
  | {
      readonly key: string
      readonly kind: 'embed'
      readonly node: MarkdownEmbedValidNode
      readonly plan: MarkdownEmbedPresentationPlan
      readonly result?: MarkdownEmbedResult
    }

export const useEditorEmbeds = (options: {
  captureSelection: (breakMerge?: boolean) => MarkdownEditorSelection
  currentMode: Ref<MarkdownEditorMode>
  dispatchTransaction: (
    transaction: MarkdownEditorTransaction,
  ) => MarkdownEditorDispatchResult
  documentIdentity: MarkdownEditorDocumentIdentity
  editingBlocked: ComputedRef<boolean>
  editorRevision: Ref<number>
  editorValue: Ref<string>
  embedProvider: () => MarkdownEmbedProvider | undefined
  getRevision: () => number
  getSource: () => string
  localeText: ComputedRef<MarkdownEditorLocaleText>
  onOpenSource: (target: string, mode: MarkdownEmbedValidNode['mode']) => void
  onRetry: (target: string, mode: MarkdownEmbedValidNode['mode']) => void
  restoreTextareaSelection: (
    selection: MarkdownEditorSelection,
    focus?: boolean,
  ) => Promise<void>
  setMode: (mode: MarkdownEditorMode) => void
  setSelection: (
    selection: MarkdownEditorSelection,
    breakMerge?: boolean,
  ) => void
}) => {
  const embedResults = ref<ReadonlyMap<string, MarkdownEmbedResult>>(new Map())
  let embedResolutionGeneration = 0
  const pendingEmbedRequests = new Set<string>()
  const embedRequestVersions = new Map<string, number>()

  const embedNodeId = (node: MarkdownEmbedValidNode) =>
    `embed:${node.ranges.full.start}:${node.target}:${node.mode}`

  const embedNodes = computed(() =>
    collectMarkdownEmbedNodes(options.editorValue.value).filter(
      (node): node is MarkdownEmbedValidNode => node.ok,
    ),
  )

  const resolveEmbedNode = async (
    node: MarkdownEmbedValidNode,
    generation: number,
  ) => {
    const provider = options.embedProvider()
    if (!provider) return
    const nodeId = embedNodeId(node)
    const version = (embedRequestVersions.get(nodeId) ?? 0) + 1
    embedRequestVersions.set(nodeId, version)
    const request = createMarkdownEmbedRequest({
      documentIdentity: options.documentIdentity,
      mode: node.mode,
      nodeId,
      revision: options.getRevision(),
      target: node.target,
      version,
    })
    pendingEmbedRequests.add(request.requestId)
    const pending: MarkdownEmbedResult = Object.freeze({
      ...request,
      status: 'pending' as const,
    })
    embedResults.value = new Map(embedResults.value).set(nodeId, pending)
    let result: MarkdownEmbedResult
    try {
      result = await provider(request)
    } catch {
      result = Object.freeze({ ...request, status: 'rejected' as const })
    } finally {
      pendingEmbedRequests.delete(request.requestId)
      forgetMarkdownEmbedRequest(request.requestId)
    }
    if (generation !== embedResolutionGeneration) return
    const committed = commitMarkdownEmbedResult(request, result)
    embedResults.value = new Map(embedResults.value).set(nodeId, committed)
  }

  const refreshEmbedPresentations = () => {
    const generation = ++embedResolutionGeneration
    const activeIds = new Set(embedNodes.value.map(embedNodeId))
    embedResults.value = new Map(
      [...embedResults.value].filter(([nodeId]) => activeIds.has(nodeId)),
    )
    for (const nodeId of embedRequestVersions.keys()) {
      if (!activeIds.has(nodeId)) embedRequestVersions.delete(nodeId)
    }
    for (const node of embedNodes.value) void resolveEmbedNode(node, generation)
  }

  const embedRenderSegments = computed<readonly MarkdownEmbedRenderSegment[]>(
    () => {
      const segments: MarkdownEmbedRenderSegment[] = []
      let offset = 0
      for (const node of embedNodes.value) {
        segments.push({
          content: options.editorValue.value.slice(
            offset,
            node.ranges.full.start,
          ),
          key: `markdown:${offset}`,
          kind: 'markdown',
        })
        const result = embedResults.value.get(embedNodeId(node))
        segments.push({
          key: embedNodeId(node),
          kind: 'embed',
          node,
          plan: planMarkdownEmbedPresentation(
            node,
            result,
            options.localeText.value.embeds,
          ),
          result,
        })
        offset = node.ranges.full.end
      }
      if (!segments.length) {
        return [
          {
            content: options.editorValue.value,
            key: 'markdown:all',
            kind: 'markdown',
          },
        ]
      }
      segments.push({
        content: options.editorValue.value.slice(offset),
        key: `markdown:${offset}`,
        kind: 'markdown',
      })
      return Object.freeze(segments)
    },
  )

  const embedPresentationSegments = computed(() =>
    embedRenderSegments.value.filter(
      (
        segment,
      ): segment is Extract<
        MarkdownEmbedRenderSegment,
        { readonly kind: 'embed' }
      > => segment.kind === 'embed',
    ),
  )

  const embedActionLabel = (action: MarkdownEmbedActionKind) =>
    options.localeText.value.embeds.actions[action]

  const handleEmbedAction = async (
    segment: Extract<MarkdownEmbedRenderSegment, { readonly kind: 'embed' }>,
    action: MarkdownEmbedActionKind,
  ) => {
    const result = runMarkdownEmbedAction(
      {
        dispatch: { dispatch: options.dispatchTransaction },
        documentIdentity: options.documentIdentity,
        mode: options.currentMode.value,
        readonly: options.editingBlocked.value,
        revision: options.getRevision(),
        selection: options.captureSelection(false),
        signal: new AbortController().signal,
        value: options.getSource(),
      },
      segment.node,
      action,
      segment.result,
    )
    if (result.action === 'delete') {
      options.dispatchTransaction(result.transaction)
      return
    }
    if (
      result.action === 'source-reveal' ||
      result.action === 'caret-before' ||
      result.action === 'caret-after' ||
      result.action === 'select-node'
    ) {
      if (options.currentMode.value === 'preview') options.setMode('source')
      options.setSelection(result.selection, false)
      await options.restoreTextareaSelection(result.selection)
      return
    }
    if (result.action === 'copy') {
      await navigator.clipboard?.writeText(result.exactMarkdown)
      return
    }
    if (result.action === 'retry') {
      options.onRetry(result.target, result.mode)
      void resolveEmbedNode(segment.node, embedResolutionGeneration)
      return
    }
    options.onOpenSource(result.target, result.mode)
  }

  const disposeEmbeds = () => {
    embedResolutionGeneration += 1
    for (const requestId of pendingEmbedRequests) {
      forgetMarkdownEmbedRequest(requestId)
    }
    pendingEmbedRequests.clear()
  }

  watch(
    [options.editorValue, options.editorRevision, options.embedProvider],
    refreshEmbedPresentations,
    { immediate: true },
  )

  return {
    disposeEmbeds,
    embedActionLabel,
    embedPresentationSegments,
    embedRenderSegments,
    handleEmbedAction,
  }
}
