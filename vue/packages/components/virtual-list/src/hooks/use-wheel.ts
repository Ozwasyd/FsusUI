// @ts-nocheck
import { isFirefox, rAF } from '@element-plus/utils'
import { normalizeFsusWheelDelta } from '@element-plus/hooks'
import { HORIZONTAL, VERTICAL } from '../defaults'

import type { ComputedRef } from 'vue'
import type { LayoutDirection } from '../types'

const WHEEL_SCROLL_EASE = 0.32
const WHEEL_SCROLL_EPSILON = 0.5

const LayoutKeys = {
  [HORIZONTAL]: 'deltaX',
  [VERTICAL]: 'deltaY',
}

interface ListWheelState {
  atStartEdge: ComputedRef<boolean> // exclusive to reachEnd
  atEndEdge: ComputedRef<boolean>
  layout: ComputedRef<LayoutDirection>
}

type ListWheelHandler = (offset: number) => void

const useWheel = (
  { atEndEdge, atStartEdge, layout }: ListWheelState,
  onWheelDelta: ListWheelHandler,
) => {
  let frameHandle: number | null = null
  let targetOffset = 0
  let currentOffset = 0

  // let scrollLock = false
  // let lockHandle = null

  // const lockScroll = () => {
  //   clearTimeout(lockHandle)
  //   scrollLock = true
  //   lockHandle = setTimeout(() => scrollLock = false, 50)
  // }

  const hasReachedEdge = (offset: number) => {
    const edgeReached =
      (offset < 0 && atStartEdge.value) || (offset > 0 && atEndEdge.value)

    return edgeReached
  }

  const scheduleWheelFlush = () => {
    if (frameHandle) return
    frameHandle = rAF(() => {
      frameHandle = null

      const distance = targetOffset - currentOffset
      const nextOffset =
        Math.abs(distance) <= WHEEL_SCROLL_EPSILON
          ? targetOffset
          : currentOffset + distance * WHEEL_SCROLL_EASE
      const delta = nextOffset - currentOffset

      currentOffset = nextOffset
      if (delta !== 0) {
        onWheelDelta(delta)
      }

      if (Math.abs(targetOffset - currentOffset) > WHEEL_SCROLL_EPSILON) {
        scheduleWheelFlush()
      } else {
        targetOffset = 0
        currentOffset = 0
      }
    })
  }

  const onWheel = (e: WheelEvent) => {
    const newOffset = normalizeFsusWheelDelta(e[LayoutKeys[layout.value]], {
      deltaMode: e.deltaMode,
      maxDiscreteDeltaPx: 64,
      viewportSizePx:
        e.currentTarget instanceof HTMLElement
          ? e.currentTarget.clientHeight
          : 0,
    })

    if (
      hasReachedEdge(targetOffset) &&
      hasReachedEdge(targetOffset + newOffset)
    )
      return

    targetOffset += newOffset

    if (!isFirefox()) {
      e.preventDefault()
    }

    scheduleWheelFlush()
  }

  return {
    hasReachedEdge,
    onWheel,
  }
}

export default useWheel
