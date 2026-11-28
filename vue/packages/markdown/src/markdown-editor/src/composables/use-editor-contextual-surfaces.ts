import { computed, nextTick, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type {
  MarkdownAnchorMap,
  MarkdownStableProjection,
} from '@fsusui/wasm/markdown-runtime'
import {
  resolveMarkdownEditorSyntaxContext,
  type MarkdownEditorDocumentIdentity,
  type MarkdownEditorLocaleText,
} from '../markdown-editor'
import {
  parseMarkdownLinkNode,
  planMarkdownLinkPropertyEdit,
  planMarkdownLinkUnwrap,
  validateMarkdownPropertyUrl,
  type MarkdownParsedLink,
} from '../markdown-editor-link-image'
import {
  currentMarkdownAnchors,
  planMarkdownAnchorCopy,
  planMarkdownAnchorEdit,
  planMarkdownAnchorInsert,
  planMarkdownAnchorRemove,
  type MarkdownProjectedAnchor,
} from '../markdown-editor-anchor-commands'
import type {
  MarkdownEditorDispatchResult,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from '../markdown-editor-transaction'

export const useEditorContextualSurfaces = (options: {
  dispatchTransaction: (
    transaction: MarkdownEditorTransaction,
  ) => MarkdownEditorDispatchResult
  documentIdentity: MarkdownEditorDocumentIdentity
  editorAnchorMap: ComputedRef<MarkdownAnchorMap | undefined>
  editorProjection: ComputedRef<MarkdownStableProjection | undefined>
  editorRevision: Ref<number>
  editorSelection: Ref<MarkdownEditorSelection>
  editorValue: Ref<string>
  focusSurfaceInput: () => void
  localeText: ComputedRef<MarkdownEditorLocaleText>
  restoreTextareaSelection: (
    selection: MarkdownEditorSelection,
    focus?: boolean,
  ) => Promise<void>
}) => {
  const contextualSurface = ref<
    'anchor-properties' | 'link-properties' | null
  >(null)
  const contextualSurfaceEpoch = ref(options.documentIdentity.epoch)
  const contextualSurfaceRevision = ref(options.editorRevision.value)
  const contextualError = ref('')
  const linkLabelDraft = ref('')
  const linkDestinationDraft = ref('')
  const linkTitleDraft = ref('')
  const anchorIdDraft = ref('')

  const currentSyntaxNode = computed(() => {
    const syntax = options.editorProjection.value
      ? resolveMarkdownEditorSyntaxContext(
          options.editorProjection.value,
          options.editorSelection.value,
        )
      : undefined
    return syntax && options.editorProjection.value
      ? options.editorProjection.value.resolve(syntax.nodeId).node
      : undefined
  })

  const activeLink = computed<MarkdownParsedLink | undefined>(() => {
    const node = currentSyntaxNode.value
    return node?.kind === 'link'
      ? parseMarkdownLinkNode(options.editorValue.value, node)
      : undefined
  })

  const activeLinkNodeId = computed(() => activeLink.value?.nodeId ?? '')

  const activeAnchor = computed<MarkdownProjectedAnchor | undefined>(() => {
    const syntax = currentSyntaxNode.value
    if (syntax?.kind !== 'anchor') return undefined
    if (!options.editorProjection.value) return undefined
    return currentMarkdownAnchors(
      options.editorValue.value,
      options.editorProjection.value,
    ).find((anchor) => anchor.projectionId === syntax.id)
  })

  const activeAnchorNodeId = computed(
    () => activeAnchor.value?.projectionId ?? '',
  )

  const resetContextualSurface = () => {
    contextualSurface.value = null
    contextualError.value = ''
  }

  const invalidateContextualOnRevision = (revision: number) => {
    if (
      contextualSurface.value &&
      revision !== contextualSurfaceRevision.value
    ) {
      resetContextualSurface()
    }
  }

  const closeContextualSurface = async (restore = true) => {
    resetContextualSurface()
    if (restore) {
      await options.restoreTextareaSelection(options.editorSelection.value)
    }
  }

  const openContextualSurface = async (
    surface: 'anchor-properties' | 'link-properties',
  ) => {
    contextualError.value = ''
    contextualSurfaceEpoch.value = options.documentIdentity.epoch
    contextualSurfaceRevision.value = options.editorRevision.value
    if (surface === 'link-properties') {
      const link = activeLink.value
      if (!link || link.kind === 'unsupported') return
      linkLabelDraft.value = link.labelText
      linkDestinationDraft.value = link.url ?? ''
      linkTitleDraft.value = link.title ?? ''
    } else {
      anchorIdDraft.value = activeAnchor.value?.id ?? ''
    }
    contextualSurface.value = surface
    await nextTick()
    options.focusSurfaceInput()
  }

  const contextualSurfaceIsCurrent = () =>
    contextualSurfaceEpoch.value === options.documentIdentity.epoch &&
    contextualSurfaceRevision.value === options.editorRevision.value

  const applyLinkProperties = () => {
    const link = activeLink.value
    if (!link || !contextualSurfaceIsCurrent()) {
      contextualError.value = options.localeText.value.results.stale
      return
    }
    if (link.ranges.destination) {
      const validation = validateMarkdownPropertyUrl(
        linkDestinationDraft.value,
        {
          documentEpoch: options.documentIdentity.epoch,
          nodeId: link.nodeId,
          revision: options.editorRevision.value,
          value: linkDestinationDraft.value,
          version: 1,
        },
      )
      if (!validation.open.allowed) {
        contextualError.value = options.localeText.value.contextual.unsafeUrl
        return
      }
    }
    const result = options.dispatchTransaction(
      planMarkdownLinkPropertyEdit(
        options.editorValue.value,
        link,
        {
          label: linkLabelDraft.value,
          ...(link.ranges.destination
            ? { url: linkDestinationDraft.value }
            : {}),
          ...(link.kind === 'inline' &&
          (link.title !== undefined || linkTitleDraft.value)
            ? { title: linkTitleDraft.value }
            : {}),
        },
        contextualSurfaceRevision.value,
      ),
    )
    if (result.accepted) void closeContextualSurface()
  }

  const removeActiveLink = () => {
    const link = activeLink.value
    if (!link || !contextualSurfaceIsCurrent()) {
      contextualError.value = options.localeText.value.results.stale
      return
    }
    const result = options.dispatchTransaction({
      ...planMarkdownLinkUnwrap(options.editorValue.value, link),
      expectedRevision: contextualSurfaceRevision.value,
    })
    if (result.accepted) void closeContextualSurface()
  }

  const revealActiveLink = () => {
    const link = activeLink.value
    if (!link || !contextualSurfaceIsCurrent()) return
    const anchorMap = options.editorAnchorMap.value
    if (!anchorMap) return
    const reveal = anchorMap.sourceRangeToReveal(link.ranges.full)
    const result = options.dispatchTransaction({
      changes: [],
      expectedRevision: contextualSurfaceRevision.value,
      history: 'skip',
      metadata: Object.freeze({
        anchorId: reveal.reveal.anchorId,
        action: 'source-reveal',
      }),
      origin: 'command',
      selection: {
        start: reveal.reveal.range.start,
        end: reveal.reveal.range.end,
      },
    })
    if (result.accepted) void closeContextualSurface()
  }

  const copyActiveLink = async () => {
    const link = activeLink.value
    if (!link || !contextualSurfaceIsCurrent()) return
    try {
      await navigator.clipboard.writeText(link.url ?? link.labelText)
    } catch {
      contextualError.value =
        options.localeText.value.pasteAsMarkdown.clipboardFailed
    }
  }

  const openActiveLink = () => {
    const link = activeLink.value
    if (!link?.url || !contextualSurfaceIsCurrent()) return
    const validation = validateMarkdownPropertyUrl(link.url, {
      documentEpoch: options.documentIdentity.epoch,
      nodeId: link.nodeId,
      revision: options.editorRevision.value,
      value: link.url,
      version: 1,
    })
    if (!validation.open.allowed) {
      contextualError.value = options.localeText.value.contextual.unsafeUrl
      return
    }
    window.open(
      validation.open.href,
      validation.open.target,
      validation.open.rel,
    )
  }

  const applyAnchorProperties = () => {
    if (!contextualSurfaceIsCurrent()) {
      contextualError.value = options.localeText.value.results.stale
      return
    }
    let transaction: MarkdownEditorTransaction
    try {
      transaction = activeAnchor.value
        ? planMarkdownAnchorEdit(
            options.editorValue.value,
            activeAnchor.value,
            anchorIdDraft.value,
            options.editorProjection.value,
          )
        : planMarkdownAnchorInsert(
            options.editorValue.value,
            options.editorSelection.value.start,
            anchorIdDraft.value,
            { projection: options.editorProjection.value },
          )
    } catch {
      contextualError.value = options.localeText.value.contextual.invalidAnchor
      return
    }
    const result = options.dispatchTransaction({
      ...transaction,
      expectedRevision: contextualSurfaceRevision.value,
    })
    if (result.accepted) void closeContextualSurface()
  }

  const removeActiveAnchor = () => {
    const anchor = activeAnchor.value
    if (!anchor || !contextualSurfaceIsCurrent()) return
    const result = options.dispatchTransaction({
      ...planMarkdownAnchorRemove(
        anchor,
        options.editorValue.value,
        options.editorProjection.value,
      ),
      expectedRevision: contextualSurfaceRevision.value,
    })
    if (result.accepted) void closeContextualSurface()
  }

  const copyActiveAnchor = async () => {
    const anchor = activeAnchor.value
    if (!anchor || !contextualSurfaceIsCurrent()) return
    try {
      await navigator.clipboard.writeText(
        planMarkdownAnchorCopy(anchor, 'exact'),
      )
    } catch {
      contextualError.value =
        options.localeText.value.pasteAsMarkdown.clipboardFailed
    }
  }

  return {
    activeAnchor,
    activeAnchorNodeId,
    activeLink,
    activeLinkNodeId,
    anchorIdDraft,
    applyAnchorProperties,
    applyLinkProperties,
    closeContextualSurface,
    contextualError,
    contextualSurface,
    copyActiveAnchor,
    copyActiveLink,
    invalidateContextualOnRevision,
    linkDestinationDraft,
    linkLabelDraft,
    linkTitleDraft,
    openActiveLink,
    openContextualSurface,
    removeActiveAnchor,
    removeActiveLink,
    resetContextualSurface,
    revealActiveLink,
  }
}
