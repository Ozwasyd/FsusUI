import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { MarkdownEditorFrameScheduler } from '@element-plus/hooks'
import type {
  MarkdownDocumentIdentity,
  MarkdownStableProjection,
} from '../../../../wasm/markdown-runtime'
import type { MarkdownEditorMode } from '../markdown-editor'
import {
  resolveMarkdownLiveLayoutStability,
  resolveMarkdownLiveVirtualWindow,
  type MarkdownLiveLayoutGesture,
  type MarkdownLiveLayoutPlan,
  type MarkdownLiveLayoutTrigger,
  type MarkdownLiveVirtualWindow,
} from '../markdown-editor-live-layout'
import {
  resolveMarkdownLiveSyntaxReveal,
  type MarkdownLiveRevealIntent,
} from '../markdown-editor-live-reveal'
import type { MarkdownLiveSurfacePlan } from '../markdown-editor-live-surface'
import { createMarkdownLiveVisualSegments } from '../markdown-editor-live-visual'
import type { MarkdownEditorSelection } from '../markdown-editor-transaction'
import {
  calculateMarkdownSourceAnchorY,
  type MarkdownEditorFocusState,
  type MarkdownEditorWritingAidsController,
  type MarkdownEditorWritingAidsOptions,
  type MarkdownEditorWritingAidsState,
} from '../markdown-editor-writing-aids'

export interface UseEditorLiveViewportOptions {
  readonly currentMode: Ref<MarkdownEditorMode>
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly editorProjection: ComputedRef<MarkdownStableProjection | undefined>
  readonly editorValue: Ref<string>
  readonly focusLayerRef: Ref<HTMLElement | null>
  readonly frameScheduler: MarkdownEditorFrameScheduler
  readonly getRevision: () => number
  readonly getSelection: () => MarkdownEditorSelection
  readonly getSource: () => string
  readonly isComposing: Ref<boolean>
  readonly isRestoringSelection: () => boolean
  readonly liveLayerRef: Ref<HTMLElement | null>
  readonly liveSurface: ComputedRef<MarkdownLiveSurfacePlan>
  readonly previewRendererRef: Ref<HTMLElement | { $el?: HTMLElement } | null>
  readonly resolvedWritingAids: Ref<Required<MarkdownEditorWritingAidsOptions>>
  readonly textareaRef: Ref<HTMLTextAreaElement | null>
  readonly toolbarRef: Ref<HTMLElement | null>
  readonly writingAidsController: MarkdownEditorWritingAidsController
  readonly writingAidsFocusState: Ref<MarkdownEditorFocusState>
  readonly writingAidsState: Ref<MarkdownEditorWritingAidsState>
}

const cssLength = (element: HTMLElement, property: string) => {
  const value = Number.parseFloat(
    window.getComputedStyle(element).getPropertyValue(property),
  )
  return Number.isFinite(value) ? value : 0
}

export const reducedMotionRequested = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export function useEditorLiveViewport(options: UseEditorLiveViewportOptions) {
  const {
    currentMode,
    documentIdentity,
    editorProjection,
    editorValue,
    focusLayerRef,
    frameScheduler,
    getRevision,
    getSelection,
    getSource,
    isComposing,
    isRestoringSelection,
    liveLayerRef,
    liveSurface,
    previewRendererRef,
    resolvedWritingAids,
    textareaRef,
    toolbarRef,
    writingAidsController,
    writingAidsFocusState,
    writingAidsState,
  } = options

  const retainedPreviewScrollLeft = ref(0)
  const visualViewportHeight = ref(0)
  const visualViewportOffsetTop = ref(0)
  const layoutGesture = ref<MarkdownLiveLayoutGesture | null>(null)
  const liveWindow = ref<MarkdownLiveVirtualWindow | null>(null)
  const liveLayout = ref<MarkdownLiveLayoutPlan>(
    resolveMarkdownLiveLayoutStability({
      documentIdentity,
      revision: getRevision(),
      selection: getSelection(),
      source: editorValue.value,
      trigger: 'block-height-change',
    }),
  )
  const liveReveal = ref(
    resolveMarkdownLiveSyntaxReveal({
      documentIdentity,
      mode: currentMode.value,
      projection: editorProjection.value,
      selection: getSelection(),
      source: editorValue.value,
    }),
  )

  let layoutGestureTimer: ReturnType<typeof setTimeout> | undefined
  let restoringViewport = false
  let restoringTypewriter = false
  let typewriterScrollTarget: number | null = null
  let typewriterScrollSmooth = false
  let typewriterLayoutAdjustment = false
  let typewriterLayoutFrame: number | undefined
  let textareaLayoutHeight = 0
  let textareaLayoutWidth = 0
  let viewportRestoreCurrentScrollTop = 0
  let viewportRestoreCurrentScrollLeft = 0
  let viewportRestoreNextScrollTop: number | null = null
  let virtualWindowNext: MarkdownLiveVirtualWindow | null = null
  let typewriterTextContext:
    | OffscreenCanvasRenderingContext2D
    | null
    | undefined
  let viewportHeightNext: number | null = null
  let viewportTrigger: MarkdownLiveLayoutTrigger | null = null
  let typewriterResizeObserver: ResizeObserver | null = null

  const syncMirrorLayerScroll = (scrollTop: number, scrollLeft = 0) => {
    for (const layer of [focusLayerRef.value, liveLayerRef.value]) {
      if (!layer) continue
      layer.scrollTop = scrollTop
      layer.scrollLeft = scrollLeft
    }
  }

  const liveDecorations = computed(() => {
    const decorations = liveSurface.value.decorations
    if (currentMode.value !== 'live' || !liveWindow.value) return decorations
    const mounted = new Set(liveWindow.value.mountedNodeIds)
    return decorations.filter((decoration) => mounted.has(decoration.nodeId))
  })
  const liveVisualActive = computed(
    () =>
      currentMode.value === 'live' &&
      liveSurface.value.fallbackMode === 'live' &&
      liveSurface.value.inputVisible &&
      !isComposing.value,
  )
  const liveVisualSegments = computed(() => {
    if (!liveVisualActive.value) return []
    return createMarkdownLiveVisualSegments({
      activeNodeIds: liveWindow.value?.mountedNodeIds,
      focusState: writingAidsFocusState.value.enabled
        ? writingAidsFocusState.value
        : null,
      projection: editorProjection.value,
      reveal: liveReveal.value,
      source: editorValue.value,
    })
  })

  watch(liveVisualActive, (active) => {
    if (!active) return
    void nextTick(() => {
      const textarea = textareaRef.value
      if (textarea) {
        syncMirrorLayerScroll(textarea.scrollTop, textarea.scrollLeft)
      }
    })
  })

  const restoreTextareaViewport = (plan: MarkdownLiveLayoutPlan) => {
    const textarea = textareaRef.value
    if (!textarea || plan.action !== 'restore' || !plan.anchor) return
    const anchor = plan.anchor
    const line =
      getSource().slice(0, anchor.sourceOffset).split('\n').length - 1
    frameScheduler.schedule({
      guard: () => liveLayout.value === plan,
      key: 'viewport-restore',
      measure: () => {
        const target = textareaRef.value
        if (!target) {
          viewportRestoreNextScrollTop = null
          return
        }
        const lineHeight =
          Number.parseFloat(window.getComputedStyle(target).lineHeight) || 20
        viewportRestoreNextScrollTop = Math.max(
          0,
          line * lineHeight - target.clientHeight / 3,
        )
        viewportRestoreCurrentScrollTop = target.scrollTop
        viewportRestoreCurrentScrollLeft = target.scrollLeft
      },
      mutate: () => {
        const target = textareaRef.value
        if (
          !target ||
          viewportRestoreNextScrollTop === null ||
          Math.abs(
            viewportRestoreCurrentScrollTop - viewportRestoreNextScrollTop,
          ) <= 1
        ) {
          viewportRestoreNextScrollTop = null
          return
        }
        restoringViewport = true
        const nextScrollTop = viewportRestoreNextScrollTop
        target.scrollTop = nextScrollTop
        syncMirrorLayerScroll(nextScrollTop, viewportRestoreCurrentScrollLeft)
        viewportRestoreNextScrollTop = null
        queueMicrotask(() => {
          restoringViewport = false
        })
      },
    })
  }

  const applyLiveLayout = (
    trigger: MarkdownLiveLayoutTrigger,
    extras: {
      readonly gesture?: MarkdownLiveLayoutGesture | null
      readonly reducedMotion?: boolean
    } = {},
  ) => {
    const plan = resolveMarkdownLiveLayoutStability({
      composing: isComposing.value,
      documentIdentity,
      gesture: extras.gesture ?? layoutGesture.value,
      previousAnchor: liveLayout.value.anchor,
      reducedMotion: extras.reducedMotion,
      revision: getRevision(),
      selection: getSelection(),
      source: getSource(),
      trigger,
    })
    liveLayout.value = plan
    if (plan.action === 'restore') restoreTextareaViewport(plan)
    return plan
  }

  const refreshLiveWindow = (
    origin: 'input' | 'document-switch' | 'mode-switch' | 'feature' | 'initial',
  ) => {
    frameScheduler.schedule({
      key: 'virtual-window',
      measure: () => {
        virtualWindowNext = resolveMarkdownLiveVirtualWindow({
          documentIdentity,
          origin,
          previousMountedNodeIds: liveWindow.value?.mountedNodeIds,
          selection: getSelection(),
          source: getSource(),
        })
      },
      mutate: () => {
        if (virtualWindowNext) liveWindow.value = virtualWindowNext
        virtualWindowNext = null
      },
    })
  }

  const markLayoutGesture = (gesture: MarkdownLiveLayoutGesture) => {
    layoutGesture.value = gesture
    applyLiveLayout('block-height-change', { gesture })
    if (layoutGestureTimer) clearTimeout(layoutGestureTimer)
    layoutGestureTimer = setTimeout(() => {
      layoutGesture.value = null
    }, 200)
  }

  const clearTypewriterScrollTarget = () => {
    typewriterScrollTarget = null
  }

  const suspendTypewriterForUserScroll = () => {
    typewriterScrollTarget = null
    writingAidsController.handleUserScroll()
    writingAidsState.value = writingAidsController.state
  }

  const sourceAnchorY = (textarea: HTMLTextAreaElement, lineHeight: number) => {
    if (typeof OffscreenCanvas === 'undefined') return undefined
    if (typewriterTextContext === undefined) {
      typewriterTextContext = new OffscreenCanvas(1, 1).getContext('2d')
    }
    if (!typewriterTextContext) return undefined
    const style = window.getComputedStyle(textarea)
    typewriterTextContext.font = style.font
    const inlineSize =
      textarea.clientWidth -
      cssLength(textarea, 'padding-inline-start') -
      cssLength(textarea, 'padding-inline-end')
    return calculateMarkdownSourceAnchorY({
      caretSourceOffset: getSelection().end,
      inlineSize,
      lineHeight,
      measureTextWidth: (text) =>
        typewriterTextContext?.measureText(text).width ?? 0,
      paddingBlockStart: cssLength(textarea, 'padding-block-start'),
      source: getSource(),
    })
  }

  const applyTypewriterScroll = (
    trigger: 'input' | 'explicit-navigation' | 'async-layout' = 'input',
  ) => {
    if (!resolvedWritingAids.value.typewriter || isComposing.value) return
    const textarea = textareaRef.value
    if (!textarea) return
    const response =
      trigger === 'explicit-navigation'
        ? writingAidsController.handleExplicitNavigation()
        : trigger === 'async-layout'
          ? writingAidsController.handleAsyncLayoutChange()
          : writingAidsController.handleInput()
    writingAidsState.value = writingAidsController.state
    if (response.scroll !== true) return
    const lineHeight =
      Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 20
    const target = writingAidsController.calculateScroll({
      caretSourceOffset: getSelection().end,
      lineHeight,
      source: getSource(),
      stickyToolbarHeight: toolbarRef.value?.getBoundingClientRect().height,
      safeAreaInsetBottom: cssLength(
        textarea,
        '--el-markdown-editor-safe-area-inset-bottom',
      ),
      safeAreaInsetTop: cssLength(
        textarea,
        '--el-markdown-editor-safe-area-inset-top',
      ),
      sourceAnchorY: sourceAnchorY(textarea, lineHeight),
      reducedMotion: reducedMotionRequested(),
      viewportHeight: textarea.clientHeight,
      visualViewportHeight: visualViewportHeight.value || undefined,
      visualViewportOffsetTop: visualViewportOffsetTop.value || undefined,
    })
    restoringTypewriter = true
    if (typeof textarea.scrollTo === 'function') {
      const scrollTop = Math.min(
        target.scrollTop,
        Math.max(0, textarea.scrollHeight - textarea.clientHeight),
      )
      typewriterScrollTarget = scrollTop
      typewriterScrollSmooth = trigger !== 'async-layout' && target.smooth
      textarea.scrollTo({
        behavior:
          trigger === 'async-layout'
            ? 'auto'
            : target.smooth
              ? 'smooth'
              : 'auto',
        top: scrollTop,
      })
      requestAnimationFrame(() => {
        syncMirrorLayerScroll(textarea.scrollTop, textarea.scrollLeft)
      })
    } else {
      typewriterScrollTarget = target.scrollTop
      typewriterScrollSmooth = false
      textarea.scrollTop = target.scrollTop
      syncMirrorLayerScroll(target.scrollTop, textarea.scrollLeft)
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoringTypewriter = false
      })
    })
  }

  const settleTypewriterLayout = () => {
    if (typewriterLayoutFrame !== undefined) {
      cancelAnimationFrame(typewriterLayoutFrame)
    }
    typewriterLayoutAdjustment = true
    let remainingFrames = 3
    const settle = () => {
      const textarea = textareaRef.value
      if (!textarea || !resolvedWritingAids.value.typewriter) {
        typewriterLayoutAdjustment = false
        typewriterLayoutFrame = undefined
        return
      }
      textareaLayoutHeight = textarea.clientHeight
      textareaLayoutWidth = textarea.clientWidth
      applyTypewriterScroll('async-layout')
      remainingFrames -= 1
      if (remainingFrames > 0) {
        typewriterLayoutFrame = requestAnimationFrame(settle)
        return
      }
      typewriterLayoutAdjustment = false
      typewriterLayoutFrame = undefined
    }
    typewriterLayoutFrame = requestAnimationFrame(settle)
  }

  const handleLayoutWheel = () => {
    suspendTypewriterForUserScroll()
    markLayoutGesture('wheel')
  }
  const handleLayoutTouch = () => {
    suspendTypewriterForUserScroll()
    markLayoutGesture('touch')
  }
  const handleLayoutScroll = () => {
    const textarea = textareaRef.value
    if (textarea) syncMirrorLayerScroll(textarea.scrollTop, textarea.scrollLeft)
    if (isRestoringSelection() || restoringViewport || restoringTypewriter)
      return
    if (textarea && typewriterScrollTarget !== null) {
      const reachedTarget =
        Math.abs(textarea.scrollTop - typewriterScrollTarget) <= 1
      if (reachedTarget) typewriterScrollTarget = null
      if (reachedTarget || typewriterScrollSmooth) return
      typewriterScrollTarget = null
    }
    if (
      textarea &&
      (textarea.clientHeight !== textareaLayoutHeight ||
        textarea.clientWidth !== textareaLayoutWidth)
    ) {
      textareaLayoutHeight = textarea.clientHeight
      textareaLayoutWidth = textarea.clientWidth
      settleTypewriterLayout()
      return
    }
    if (typewriterLayoutAdjustment) return
    suspendTypewriterForUserScroll()
    markLayoutGesture('scrollbar')
  }

  const previewElement = () => {
    const current = previewRendererRef.value
    if (!current) return null
    return current instanceof HTMLElement ? current : (current.$el ?? null)
  }
  const capturePreviewScrollLeft = () => {
    const preview = previewElement()
    if (preview) retainedPreviewScrollLeft.value = preview.scrollLeft
  }
  const handlePreviewScroll = () => {
    retainedPreviewScrollLeft.value = previewElement()?.scrollLeft ?? 0
  }
  const restorePreviewScroll = () => {
    void nextTick(() => {
      const preview = previewElement()
      if (preview) preview.scrollLeft = retainedPreviewScrollLeft.value
    })
  }

  const refreshLiveReveal = (
    extras: {
      readonly intent?: MarkdownLiveRevealIntent
      readonly pointerOffset?: number
    } = {},
  ) => {
    const previousState = liveReveal.value.state
    liveReveal.value = resolveMarkdownLiveSyntaxReveal({
      composing: isComposing.value,
      documentIdentity,
      intent: extras.intent,
      mode: currentMode.value,
      pointerOffset: extras.pointerOffset,
      previous: liveReveal.value,
      projection: editorProjection.value,
      selection: getSelection(),
      source: getSource(),
    })
    if (previousState === 'inactive' && liveReveal.value.state !== 'inactive') {
      applyLiveLayout('marker-reveal')
    } else if (
      previousState !== 'inactive' &&
      liveReveal.value.state === 'inactive'
    ) {
      applyLiveLayout('marker-hide')
    }
  }

  const updateVisualViewportHeight = () => {
    if (typeof window === 'undefined') return
    const previous = visualViewportHeight.value
    visualViewportHeight.value =
      window.visualViewport?.height || window.innerHeight || 0
    visualViewportOffsetTop.value = window.visualViewport?.offsetTop || 0
    const trigger: MarkdownLiveLayoutTrigger =
      previous > 0 && visualViewportHeight.value + 80 < previous
        ? 'soft-keyboard'
        : 'visual-viewport'
    applyLiveLayout(trigger)
    applyTypewriterScroll('async-layout')
  }

  const refreshTypewriterResizeObserver = () => {
    typewriterResizeObserver?.disconnect()
    typewriterResizeObserver = null
    const textarea = textareaRef.value
    if (
      !resolvedWritingAids.value.typewriter ||
      !textarea ||
      typeof ResizeObserver === 'undefined'
    ) {
      return
    }
    textareaLayoutHeight = textarea.clientHeight
    textareaLayoutWidth = textarea.clientWidth
    typewriterResizeObserver = new ResizeObserver(() => {
      textareaLayoutHeight = textarea.clientHeight
      textareaLayoutWidth = textarea.clientWidth
      applyTypewriterScroll('async-layout')
      settleTypewriterLayout()
    })
    typewriterResizeObserver.observe(textarea)

    frameScheduler.schedule({
      key: 'visual-viewport-read',
      measure: () => {
        const height = window.visualViewport?.height || window.innerHeight || 0
        const previous = visualViewportHeight.value
        viewportHeightNext = height
        viewportTrigger =
          previous > 0 && height + 80 < previous
            ? 'soft-keyboard'
            : 'visual-viewport'
      },
      mutate: () => {
        if (viewportHeightNext === null) return
        visualViewportHeight.value = viewportHeightNext
        const trigger = viewportTrigger ?? 'visual-viewport'
        viewportHeightNext = null
        viewportTrigger = null
        applyLiveLayout(trigger)
      },
    })
  }

  watch(
    [() => resolvedWritingAids.value.typewriter, textareaRef, toolbarRef],
    () => {
      refreshTypewriterResizeObserver()
    },
  )

  const editorStyle = computed<Record<string, string> | undefined>(() =>
    visualViewportHeight.value > 0
      ? {
          '--el-markdown-editor-visual-viewport-height': `${visualViewportHeight.value}px`,
        }
      : undefined,
  )

  const disposeViewport = () => {
    if (layoutGestureTimer) clearTimeout(layoutGestureTimer)
    if (typewriterLayoutFrame !== undefined) {
      cancelAnimationFrame(typewriterLayoutFrame)
    }
    typewriterResizeObserver?.disconnect()
    if (typeof window === 'undefined') return
    window.visualViewport?.removeEventListener(
      'resize',
      updateVisualViewportHeight,
    )
    window.visualViewport?.removeEventListener(
      'scroll',
      updateVisualViewportHeight,
    )
    window.removeEventListener('resize', updateVisualViewportHeight)
  }

  const mountViewportListeners = () => {
    refreshLiveWindow('initial')
    updateVisualViewportHeight()
    refreshTypewriterResizeObserver()
    if (typeof window === 'undefined') return
    window.visualViewport?.addEventListener(
      'resize',
      updateVisualViewportHeight,
    )
    window.visualViewport?.addEventListener(
      'scroll',
      updateVisualViewportHeight,
    )
    window.addEventListener('resize', updateVisualViewportHeight)
  }

  return {
    applyLiveLayout,
    applyTypewriterScroll,
    capturePreviewScrollLeft,
    clearTypewriterScrollTarget,
    disposeViewport,
    editorStyle,
    handleLayoutScroll,
    handleLayoutTouch,
    handleLayoutWheel,
    handlePreviewScroll,
    liveDecorations,
    liveLayout,
    liveReveal,
    liveVisualActive,
    liveVisualSegments,
    liveWindow,
    markLayoutGesture,
    mountViewportListeners,
    refreshLiveReveal,
    refreshLiveWindow,
    restorePreviewScroll,
    suspendTypewriterForUserScroll,
    syncMirrorLayerScroll,
  }
}
