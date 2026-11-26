import { computed, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { createMarkdownEditorProjection } from '../../../../wasm/markdown-runtime'
import {
  decomposeMarkdownImageNode,
  planMarkdownImageAltEdit,
  planMarkdownImageDestinationEdit,
  planMarkdownImageRemove,
  planMarkdownImageTitleEdit,
  validateMarkdownPropertyUrl,
} from '../markdown-editor-link-image'
import {
  findMarkdownFigures,
  formatMarkdownFigureExactCopy,
  formatMarkdownFigureVisibleCopy,
  planMarkdownCaptionEdit,
  planMarkdownCaptionInsert,
  planMarkdownCaptionRemove,
  planMarkdownFigureDelete,
} from '../markdown-editor-caption'
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

export const useEditorMediaProperties = (options: {
  attachmentInputRef: Ref<HTMLInputElement | null>
  attachmentReplaceRange: Ref<{
    readonly nodeId: string
    readonly start: number
    readonly end: number
  } | null>
  currentMode: Ref<MarkdownEditorMode>
  dispatchTransaction: (
    transaction: MarkdownEditorTransaction,
  ) => MarkdownEditorDispatchResult
  documentIdentity: MarkdownEditorDocumentIdentity
  editingBlocked: ComputedRef<boolean>
  editorValue: Ref<string>
  getRevision: () => number
  getSelection: () => MarkdownEditorSelection
  getSource: () => string
  isComposing: Ref<boolean>
  localeText: ComputedRef<MarkdownEditorLocaleText>
  restoreTextareaSelection: (
    selection: MarkdownEditorSelection,
    focus?: boolean,
  ) => Promise<void>
  selectionTick: Ref<number>
  setMode: (mode: MarkdownEditorMode) => void
  setSelection: (
    selection: MarkdownEditorSelection,
    breakMerge?: boolean,
  ) => void
}) => {
  const activeImage = computed(() => {
    void options.selectionTick.value
    if (options.currentMode.value === 'preview') return null
    const selection = options.getSelection()
    const projection = createMarkdownEditorProjection(options.editorValue.value)
    const imageNode = projection.nodes
      .filter(
        (node) =>
          node.kind === 'image' &&
          selection.start >= node.rawRange.start &&
          selection.end <= node.rawRange.end,
      )
      .sort(
        (left, right) =>
          left.rawRange.end -
          left.rawRange.start -
          (right.rawRange.end - right.rawRange.start),
      )[0]
    if (!imageNode) return null
    const image = decomposeMarkdownImageNode(
      options.editorValue.value,
      imageNode.rawRange,
    )
    if (!image) return null
    const figure =
      findMarkdownFigures(options.editorValue.value).find(
        (candidate) =>
          candidate.mediaRange.start === imageNode.rawRange.start &&
          candidate.mediaRange.end === imageNode.rawRange.end,
      ) ?? null
    return Object.freeze({
      figure,
      image,
      nodeId: `image:${imageNode.rawRange.start}:${imageNode.rawRange.end}`,
      range: imageNode.rawRange,
    })
  })

  const imageAltDraft = ref('')
  const imageDestinationDraft = ref('')
  const imageTitleDraft = ref('')
  const imageCaptionDraft = ref('')
  const imagePropertyError = ref('')

  watch(
    () => {
      const active = activeImage.value
      if (!active) return null
      return [
        active.nodeId,
        active.image.alt.value,
        active.image.destination.value,
        active.image.title?.value ?? '',
        active.figure?.text ?? '',
      ].join('\u0000')
    },
    () => {
      const active = activeImage.value
      imageAltDraft.value = active?.image.alt.value ?? ''
      imageDestinationDraft.value = active?.image.destination.value ?? ''
      imageTitleDraft.value = active?.image.title?.value ?? ''
      imageCaptionDraft.value = active?.figure?.text ?? ''
      imagePropertyError.value = ''
    },
    { immediate: true },
  )

  const activeImageUrlValidation = computed(() => {
    const active = activeImage.value
    if (!active) return null
    return validateMarkdownPropertyUrl(active.image.destination.value, {
      documentEpoch: options.documentIdentity.epoch,
      nodeId: active.nodeId,
      revision: options.getRevision(),
      value: active.image.destination.value,
      version: 1,
    })
  })

  const activeImageOpenAllowed = computed(
    () => activeImageUrlValidation.value?.open.allowed === true,
  )

  const applyImageProperties = () => {
    const active = activeImage.value
    if (!active || options.editingBlocked.value || options.isComposing.value)
      return
    const source = options.getSource()
    const destinationValidation = validateMarkdownPropertyUrl(
      imageDestinationDraft.value,
      {
        documentEpoch: options.documentIdentity.epoch,
        nodeId: active.nodeId,
        revision: options.getRevision(),
        value: imageDestinationDraft.value,
        version: 1,
      },
    )
    if (!destinationValidation.open.allowed) {
      imagePropertyError.value =
        options.localeText.value.imageProperties.destinationRejected(
          destinationValidation.state,
        )
      return
    }

    const transactions: MarkdownEditorTransaction[] = []
    if (imageAltDraft.value !== active.image.alt.value) {
      transactions.push(
        planMarkdownImageAltEdit(source, active.range, imageAltDraft.value),
      )
    }
    if (imageDestinationDraft.value !== active.image.destination.value) {
      transactions.push(
        planMarkdownImageDestinationEdit(
          source,
          active.range,
          imageDestinationDraft.value,
        ),
      )
    }
    if (imageTitleDraft.value !== (active.image.title?.value ?? '')) {
      transactions.push(
        planMarkdownImageTitleEdit(
          source,
          active.range,
          imageTitleDraft.value || null,
        ),
      )
    }
    if (active.figure) {
      if (imageCaptionDraft.value !== active.figure.text) {
        transactions.push(
          imageCaptionDraft.value
            ? planMarkdownCaptionEdit(
                source,
                active.figure.captionNode,
                imageCaptionDraft.value,
              )
            : planMarkdownCaptionRemove(source, active.figure.captionNode),
        )
      }
    } else if (imageCaptionDraft.value) {
      transactions.push(
        planMarkdownCaptionInsert(
          source,
          active.range,
          imageCaptionDraft.value,
        ),
      )
    }

    const changes = transactions
      .flatMap((transaction) => transaction.changes)
      .filter(
        (change) => source.slice(change.from, change.to) !== change.insert,
      )
      .sort((left, right) => left.from - right.from || left.to - right.to)
    if (!changes.length) {
      imagePropertyError.value = ''
      return
    }
    const result = options.dispatchTransaction({
      changes: Object.freeze(changes),
      history: 'separate',
      origin: 'command',
    })
    imagePropertyError.value = result.accepted
      ? ''
      : options.localeText.value.imageProperties.updateRejected(
          result.reason ?? 'invalid-change',
        )
  }

  const revealActiveImageSource = () => {
    const active = activeImage.value
    if (!active) return
    const range = active.figure?.captionRange ?? active.range
    options.setMode('source')
    options.setSelection(
      { direction: 'none', end: range.end, start: range.start },
      false,
    )
    options.selectionTick.value += 1
    void options.restoreTextareaSelection(options.getSelection())
  }

  const openActiveImage = () => {
    const validated = activeImageUrlValidation.value
    if (!validated?.open.allowed || typeof window === 'undefined') return
    window.open(
      validated.open.href,
      validated.open.target,
      validated.open.rel ? 'noopener,noreferrer' : undefined,
    )
  }

  const copyActiveFigure = async (mode: 'exact' | 'visible') => {
    const active = activeImage.value
    if (!active || typeof navigator === 'undefined') return
    const source = options.getSource()
    const payload =
      active.figure && mode === 'visible'
        ? formatMarkdownFigureVisibleCopy(source, active.figure)
        : active.figure
          ? formatMarkdownFigureExactCopy(source, active.figure)
          : source.slice(active.range.start, active.range.end)
    await navigator.clipboard?.writeText(payload)
  }

  const openActiveImageReplacement = () => {
    const active = activeImage.value
    if (!active || options.editingBlocked.value || options.isComposing.value)
      return
    options.attachmentReplaceRange.value = Object.freeze({
      end: active.range.end,
      nodeId: active.nodeId,
      start: active.range.start,
    })
    options.attachmentInputRef.value?.click()
  }

  const removeActiveCaption = () => {
    const active = activeImage.value
    if (
      !active?.figure ||
      options.editingBlocked.value ||
      options.isComposing.value
    )
      return
    options.dispatchTransaction(
      planMarkdownCaptionRemove(options.getSource(), active.figure.captionNode),
    )
  }

  const removeActiveImage = () => {
    const active = activeImage.value
    if (!active || options.editingBlocked.value || options.isComposing.value)
      return
    options.dispatchTransaction(
      active.figure
        ? planMarkdownFigureDelete(options.getSource(), active.figure)
        : planMarkdownImageRemove(options.getSource(), active.range),
    )
  }

  return {
    activeImage,
    activeImageOpenAllowed,
    applyImageProperties,
    copyActiveFigure,
    imageAltDraft,
    imageCaptionDraft,
    imageDestinationDraft,
    imagePropertyError,
    imageTitleDraft,
    openActiveImage,
    openActiveImageReplacement,
    removeActiveCaption,
    removeActiveImage,
    revealActiveImageSource,
  }
}
