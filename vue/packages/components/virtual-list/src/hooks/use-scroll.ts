import { onBeforeUnmount } from 'vue'
import {
  applyFsusInteractiveMotionVars,
  resolveFsusInteractiveMotion,
} from '@element-plus/hooks'

import type { FsusMotionRuntime } from '@element-plus/hooks'
import type { ComputedRef, Ref } from 'vue'

const SCROLL_MOTION_IDLE_MS = 320
const SCROLL_RESET_MS = 120

interface ScrollState {
  isScrolling: boolean
  isScrollbarDragging: boolean
}

export const useVirtualScroll = <State extends ScrollState>({
  states,
  wrapperRef,
  motionRuntime,
  flushScroll,
  setScrollMotion,
  syncScrollMotionClasses,
}: {
  states: Ref<State>
  wrapperRef: Ref<HTMLElement | undefined>
  motionRuntime: ComputedRef<FsusMotionRuntime>
  flushScroll: (element: HTMLElement) => void
  setScrollMotion: (active: boolean, x?: boolean, y?: boolean) => void
  syncScrollMotionClasses: (active: boolean) => void
}) => {
  let scrollFrame = 0
  let pendingScrollElement: HTMLElement | null = null
  let resetTimer: ReturnType<typeof setTimeout> | undefined
  let motionTimer: ReturnType<typeof setTimeout> | undefined
  let motionFrame = 0
  let lastMotionAt = 0

  const flushPendingScroll = () => {
    scrollFrame = 0
    const element = pendingScrollElement
    pendingScrollElement = null
    if (element) flushScroll(element)
  }

  const onScroll = (event: Event) => {
    pendingScrollElement = event.currentTarget as HTMLElement
    if (scrollFrame) return
    if (typeof requestAnimationFrame !== 'function') {
      flushPendingScroll()
      return
    }
    scrollFrame = requestAnimationFrame(flushPendingScroll)
  }

  const clearScrollReset = () => {
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = undefined
  }

  const resetIsScrolling = () => {
    resetTimer = undefined
    states.value.isScrolling = false
  }

  const scheduleResetIsScrolling = () => {
    clearScrollReset()
    resetTimer = setTimeout(resetIsScrolling, SCROLL_RESET_MS)
  }

  const onScrollEnd = () => {
    clearScrollReset()
    resetIsScrolling()
  }

  const clearMotionSchedule = () => {
    if (motionTimer) {
      clearTimeout(motionTimer)
      motionTimer = undefined
    }
    if (motionFrame) {
      cancelAnimationFrame(motionFrame)
      motionFrame = 0
    }
  }

  const updateMotionState = (active: boolean, x?: boolean, y?: boolean) => {
    setScrollMotion(active, x, y)
    syncScrollMotionClasses(active)
  }

  const clearScrollMotionState = () => updateMotionState(false)
  const armMotionTimer = () => {
    motionFrame = 0
    motionTimer = setTimeout(
      clearScrollMotionState,
      motionRuntime.value.scrollIdleMs || SCROLL_MOTION_IDLE_MS,
    )
  }

  const scheduleMotionEnd = () => {
    clearMotionSchedule()
    if (states.value.isScrollbarDragging) return

    if (typeof requestAnimationFrame !== 'function') {
      armMotionTimer()
      return
    }
    motionFrame = requestAnimationFrame(() => {
      motionFrame = requestAnimationFrame(armMotionTimer)
    })
  }

  const triggerScrollMotion = (
    deltaX: number,
    deltaY: number,
    x?: boolean,
    y?: boolean,
  ) => {
    if (!motionRuntime.value.enabled) return
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    applyFsusInteractiveMotionVars(
      wrapperRef.value,
      resolveFsusInteractiveMotion({
        deltaX,
        deltaY,
        elapsedMs: lastMotionAt ? now - lastMotionAt : 16,
        runtime: motionRuntime.value,
      }),
    )
    lastMotionAt = now
    updateMotionState(true, x, y)
    scheduleMotionEnd()
  }

  const onScrollbarStartMove = () => {
    states.value = {
      ...states.value,
      isScrollbarDragging: true,
      isScrolling: true,
    }
    clearScrollReset()
  }

  const onScrollbarStopMove = () => {
    states.value = { ...states.value, isScrollbarDragging: false }
    scheduleResetIsScrolling()
    scheduleMotionEnd()
  }

  onBeforeUnmount(() => {
    if (scrollFrame) {
      cancelAnimationFrame(scrollFrame)
      scrollFrame = 0
    }
    pendingScrollElement = null
    clearScrollReset()
    clearMotionSchedule()
  })

  return {
    onScroll,
    onScrollEnd,
    onScrollbarStartMove,
    onScrollbarStopMove,
    scheduleResetIsScrolling,
    triggerScrollMotion,
  }
}
