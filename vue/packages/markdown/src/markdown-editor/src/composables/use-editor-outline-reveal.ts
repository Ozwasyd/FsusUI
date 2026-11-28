import type { ComputedRef, Ref } from 'vue'
import {
  createMarkdownAnchorMap,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
} from '@fsusui/wasm/markdown-runtime'
import type { MarkdownEditorMode } from '../markdown-editor'
import {
  createMarkdownOutlineModelFromProjection,
  revealHeading as revealHeadingOutline,
  revealSourceRange as revealSourceRangeOutline,
} from '../markdown-editor-outline'
import { planMarkdownOutlineReveal } from '../markdown-editor-outline-active'
import type { MarkdownEditorSelection } from '../markdown-editor-transaction'
import type { MarkdownEditorWritingAidsOptions } from '../markdown-editor-writing-aids'

export interface UseEditorOutlineRevealOptions {
  readonly applyTypewriterScroll: (
    trigger?: 'input' | 'explicit-navigation' | 'async-layout',
  ) => void
  readonly currentMode: Ref<MarkdownEditorMode>
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly editorProjection: ComputedRef<MarkdownStableProjection | undefined>
  readonly getRevision: () => number
  readonly getSource: () => string
  readonly reducedMotionRequested: () => boolean
  readonly refreshLiveWindow: (
    origin: 'input' | 'document-switch' | 'mode-switch' | 'feature' | 'initial',
  ) => void
  readonly refreshWritingAidsDocument: () => void
  readonly resolvedWritingAids: Ref<Required<MarkdownEditorWritingAidsOptions>>
  readonly restoreTextareaSelection: (
    selection: MarkdownEditorSelection,
    focus?: boolean,
  ) => Promise<void>
  readonly setStoreSelection: (
    selection: MarkdownEditorSelection,
    breakMerge?: boolean,
  ) => void
  readonly syncMirrorLayerScroll: (scrollTop: number, scrollLeft?: number) => void
  readonly textareaRef: Ref<HTMLTextAreaElement | null>
}

export function useEditorOutlineReveal(options: UseEditorOutlineRevealOptions) {
  const {
    applyTypewriterScroll,
    currentMode,
    documentIdentity,
    editorProjection,
    getRevision,
    getSource,
    reducedMotionRequested,
    refreshLiveWindow,
    refreshWritingAidsDocument,
    resolvedWritingAids,
    restoreTextareaSelection,
    setStoreSelection,
    syncMirrorLayerScroll,
    textareaRef,
  } = options

  const commitRevealSelection = async (
    range: { start: number; end: number },
    smooth: boolean,
  ) => {
    const selection = Object.freeze({
      direction: 'none' as const,
      end: range.start,
      start: range.start,
    })
    setStoreSelection(selection, true)
    refreshLiveWindow('feature')
    refreshWritingAidsDocument()
    await restoreTextareaSelection(selection)
    const textarea = textareaRef.value
    if (!textarea) return
    textarea.focus()
    if (resolvedWritingAids.value.typewriter) {
      applyTypewriterScroll('explicit-navigation')
      return
    }
    const lineHeight =
      Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 20
    const line = getSource().slice(0, range.start).split('\n').length - 1
    const top = Math.max(0, line * lineHeight - textarea.clientHeight / 3)
    if (typeof textarea.scrollTo === 'function') {
      const scrollTop = Math.min(
        top,
        Math.max(0, textarea.scrollHeight - textarea.clientHeight),
      )
      textarea.scrollTo({
        behavior: smooth ? 'smooth' : 'auto',
        top: scrollTop,
      })
      requestAnimationFrame(() => {
        syncMirrorLayerScroll(textarea.scrollTop, textarea.scrollLeft)
      })
    } else {
      textarea.scrollTop = top
      syncMirrorLayerScroll(top, textarea.scrollLeft)
    }
  }

  const currentOutlineContext = () => {
    const projection = editorProjection.value
    const source = getSource()
    return {
      anchorMap: createMarkdownAnchorMap({
        identity: documentIdentity,
        projection,
        source,
      }),
      model: projection
        ? createMarkdownOutlineModelFromProjection(source, projection)
        : { items: [], projection: undefined },
    }
  }

  const revealHeading = (
    nodeId: string,
    revealOptions?: Parameters<typeof revealHeadingOutline>[4],
  ) => {
    const { anchorMap, model } = currentOutlineContext()
    const actual = {
      documentIdentity,
      revision: getRevision(),
    }
    const expected = revealOptions?.expected ?? actual
    const status = revealHeadingOutline(model.items, nodeId, expected, actual, {
      ...revealOptions,
      anchorMap,
      projection: model.projection,
    })
    if (status !== 'success') return status
    const plan = planMarkdownOutlineReveal(model.items, nodeId, {
      ...revealOptions,
      actual,
      anchorMap,
      expected,
      mode: currentMode.value,
      reducedMotion: revealOptions?.reducedMotion ?? reducedMotionRequested(),
    })
    if (plan.status !== 'success' || !plan.range) return plan.status
    void commitRevealSelection(plan.range, plan.smooth)
    return 'success'
  }

  const revealSourceRange = (
    range: { start: number; end: number },
    revealOptions?: Parameters<typeof revealSourceRangeOutline>[2],
  ) => {
    const sourceLength = getSource().length
    if (range.start < 0 || range.end < range.start || range.end > sourceLength) {
      return 'not-found'
    }
    const { anchorMap, model } = currentOutlineContext()
    const actual = {
      documentIdentity,
      revision: getRevision(),
    }
    const guarded = revealSourceRangeOutline(model.items, range, {
      ...revealOptions,
      actual,
      anchorMap,
      expected: revealOptions?.expected ?? actual,
      mode: revealOptions?.mode ?? currentMode.value,
      sourceLength,
    })
    if (guarded !== 'success') return guarded
    const smooth = !(revealOptions?.reducedMotion ?? reducedMotionRequested())
    void commitRevealSelection(range, smooth)
    return 'success'
  }

  return {
    revealHeading,
    revealSourceRange,
  }
}
