<template>
  <transition :name="ns.b('fade')">
    <div
      v-show="always || visible"
      ref="instance"
      :class="[ns.e('bar'), ns.is(bar.key)]"
      @pointerdown="handleTrackPointerDown"
    >
      <div
        ref="thumb"
        :class="ns.e('thumb')"
        :style="thumbStyle"
        @pointerdown="handleThumbPointerDown"
      />
    </div>
  </transition>
</template>

<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, ref, toRef } from 'vue'
import { useEventListener } from '@element-plus/hooks/use-runtime'
import { isClient, throwError } from '@element-plus/utils'
import { useNamespace } from '@element-plus/hooks'
import { scrollbarContextKey } from './constants'
import { BAR_MAP, renderThumbStyle } from './util'
import { thumbProps } from './thumb'

const COMPONENT_NAME = 'Thumb'
const props = defineProps(thumbProps)

const scrollbar = inject(scrollbarContextKey)
const ns = useNamespace('scrollbar')

if (!scrollbar) throwError(COMPONENT_NAME, 'can not inject scrollbar context')

const instance = ref<HTMLDivElement>()
const thumb = ref<HTMLDivElement>()

const thumbState = ref<Partial<Record<'X' | 'Y', number>>>({})
const visible = ref(false)

let cursorDown = false
let cursorLeave = false
let dragStartClient = 0
let dragStartScroll = 0
let activePointerId: number | undefined
let pointerCaptureTarget: HTMLDivElement | undefined
let originalOnSelectStart:
  | ((this: GlobalEventHandlers, ev: Event) => any)
  | null = isClient ? document.onselectstart : null

const bar = computed(() => BAR_MAP[props.vertical ? 'vertical' : 'horizontal'])

const thumbStyle = computed(() =>
  renderThumbStyle({
    size: props.size,
    move: props.move,
    bar: bar.value,
  }),
)

const offsetRatio = computed(
  () =>
    // offsetRatioX = original width of thumb / current width of thumb / ratioX
    // offsetRatioY = original height of thumb / current height of thumb / ratioY
    // instance height = wrap height - GAP
    instance.value![bar.value.offset] ** 2 /
    scrollbar.wrapElement![bar.value.scrollSize] /
    props.ratio /
    thumb.value![bar.value.offset],
)

const LONG_RANGE_TRACK_DENSITY = 420

const getScrollRange = () => {
  const wrap = scrollbar.wrapElement
  if (!wrap || !instance.value || !thumb.value) return 0

  return Math.max(0, wrap[bar.value.scrollSize] - wrap[bar.value.offset])
}

const getTrackTravel = () => {
  if (!instance.value || !thumb.value) return 0

  return Math.max(
    1,
    instance.value[bar.value.offset] - thumb.value[bar.value.offset],
  )
}

const isLongRangeScroll = () =>
  getScrollRange() / getTrackTravel() > LONG_RANGE_TRACK_DENSITY

const resolveLongRangeDragOffset = (
  event: PointerEvent,
  fallbackScrollOffset: number,
) => {
  if (!scrollbar.wrapElement || !isLongRangeScroll())
    return fallbackScrollOffset

  const pointerDelta = event[bar.value.client] - dragStartClient
  const trackTravel = getTrackTravel()
  if (!trackTravel) return fallbackScrollOffset

  const scrollRange = getScrollRange()
  const dragRatio = Math.min(1, Math.abs(pointerDelta) / trackTravel)
  const precisionRatio = 0.12 + 0.88 * dragRatio ** 3

  return (
    dragStartScroll +
    pointerDelta * (scrollRange / trackTravel) * precisionRatio
  )
}

const isPrimaryPointer = (e: PointerEvent) =>
  e.isPrimary !== false && !e.ctrlKey && ![1, 2].includes(e.button)

const capturePointer = (target: HTMLDivElement, pointerId: number) => {
  activePointerId = pointerId
  pointerCaptureTarget = target
  try {
    target.setPointerCapture?.(pointerId)
  } catch {
    // Synthetic events and older browsers can reject capture; document
    // listeners still keep the drag stable.
  }
}

const releasePointer = () => {
  if (activePointerId == null) return

  try {
    pointerCaptureTarget?.releasePointerCapture?.(activePointerId)
  } catch {
    // The pointer can already be released after pointercancel.
  }

  activePointerId = undefined
  pointerCaptureTarget = undefined
}

const handleThumbPointerDown = (e: PointerEvent) => {
  // prevent click event of middle and right button
  e.stopPropagation()
  if (!isPrimaryPointer(e)) return

  const el = e.currentTarget as HTMLDivElement | null
  if (!el) return

  window.getSelection()?.removeAllRanges()
  startDrag(e, el)

  dragStartClient = e[bar.value.client]
  dragStartScroll = scrollbar.wrapElement?.[bar.value.scroll] || 0
  thumbState.value[bar.value.axis] =
    el[bar.value.offset] -
    (e[bar.value.client] - el.getBoundingClientRect()[bar.value.direction])
}

const handleTrackPointerDown = (e: PointerEvent) => {
  if (!isPrimaryPointer(e)) return
  if (!thumb.value || !instance.value || !scrollbar.wrapElement) return

  e.preventDefault()

  if (isLongRangeScroll()) {
    const thumbRect = thumb.value.getBoundingClientRect()
    const clickPosition = e[bar.value.client]
    const thumbStart = thumbRect[bar.value.direction]
    const thumbEnd = thumbStart + thumb.value[bar.value.offset]
    const direction =
      clickPosition < thumbStart ? -1 : clickPosition > thumbEnd ? 1 : 0

    if (direction) {
      const pageStep = Math.max(
        scrollbar.wrapElement[bar.value.offset] * 0.85,
        240,
      )
      scrollbar.moveThumbDrag(
        bar.value.axis,
        scrollbar.wrapElement[bar.value.scroll] + direction * pageStep,
      )
    }
    return
  }

  const offset = Math.abs(
    (e.target as HTMLElement).getBoundingClientRect()[bar.value.direction] -
      e[bar.value.client],
  )
  const thumbHalf = thumb.value[bar.value.offset] / 2
  const thumbPositionPercentage =
    ((offset - thumbHalf) * 100 * offsetRatio.value) /
    instance.value[bar.value.offset]

  scrollbar.wrapElement[bar.value.scroll] =
    (thumbPositionPercentage * scrollbar.wrapElement[bar.value.scrollSize]) /
    100
}

const cleanupDocumentListeners = () => {
  document.removeEventListener('pointermove', pointerMoveDocumentHandler)
  document.removeEventListener('pointerup', pointerUpDocumentHandler)
  document.removeEventListener('pointercancel', pointerCancelDocumentHandler)
}

const startDrag = (e: PointerEvent, target: HTMLDivElement) => {
  e.stopImmediatePropagation()
  e.preventDefault()
  cursorDown = true
  capturePointer(target, e.pointerId)
  scrollbar.startThumbDrag()
  cleanupDocumentListeners()
  document.addEventListener('pointermove', pointerMoveDocumentHandler, {
    passive: false,
  })
  document.addEventListener('pointerup', pointerUpDocumentHandler)
  document.addEventListener('pointercancel', pointerCancelDocumentHandler)
  originalOnSelectStart = document.onselectstart
  document.onselectstart = () => false
}

const pointerMoveDocumentHandler = (e: PointerEvent) => {
  if (!instance.value || !thumb.value) return
  if (cursorDown === false) return
  if (activePointerId != null && e.pointerId !== activePointerId) return
  e.preventDefault()

  const prevPage = thumbState.value[bar.value.axis]
  if (prevPage == null) return

  const offset =
    (instance.value.getBoundingClientRect()[bar.value.direction] -
      e[bar.value.client]) *
    -1
  const thumbClickPosition = thumb.value[bar.value.offset] - prevPage
  const thumbPositionPercentage =
    ((offset - thumbClickPosition) * 100 * offsetRatio.value) /
    instance.value[bar.value.offset]
  const scrollOffset =
    (thumbPositionPercentage * scrollbar.wrapElement![bar.value.scrollSize]) /
    100
  scrollbar.moveThumbDrag(
    bar.value.axis,
    resolveLongRangeDragOffset(e, scrollOffset),
  )
}

const finishDrag = () => {
  cursorDown = false
  thumbState.value[bar.value.axis] = undefined
  scrollbar.endThumbDrag()
  releasePointer()
  cleanupDocumentListeners()
  restoreOnselectstart()
  if (cursorLeave) visible.value = false
}

const pointerUpDocumentHandler = (e: PointerEvent) => {
  if (activePointerId != null && e.pointerId !== activePointerId) return
  finishDrag()
}

const pointerCancelDocumentHandler = (e: PointerEvent) => {
  if (activePointerId != null && e.pointerId !== activePointerId) return
  finishDrag()
}

const pointerMoveScrollbarHandler = () => {
  cursorLeave = false
  visible.value = !!props.size
}

const pointerLeaveScrollbarHandler = () => {
  cursorLeave = true
  visible.value = cursorDown
}

onBeforeUnmount(() => {
  if (cursorDown) {
    scrollbar.endThumbDrag()
  }
  cleanupDocumentListeners()
  restoreOnselectstart()
})

const restoreOnselectstart = () => {
  if (document.onselectstart !== originalOnSelectStart)
    document.onselectstart = originalOnSelectStart
}

useEventListener(
  toRef(scrollbar, 'scrollbarElement'),
  'pointermove',
  pointerMoveScrollbarHandler,
)
useEventListener(
  toRef(scrollbar, 'scrollbarElement'),
  'pointerleave',
  pointerLeaveScrollbarHandler,
)
</script>
