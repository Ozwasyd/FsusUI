import { rAF } from '@element-plus/utils'
import { normalizeFsusWheelDelta } from '@element-plus/hooks'

import type { ComputedRef } from 'vue'

const WHEEL_SCROLL_EASE = 0.32
const WHEEL_SCROLL_EPSILON = 0.5

interface GridWheelState {
  atXStartEdge: ComputedRef<boolean>
  atXEndEdge: ComputedRef<boolean>
  atYStartEdge: ComputedRef<boolean>
  atYEndEdge: ComputedRef<boolean>
}

type GridWheelHandler = (x: number, y: number) => void

export const useGridWheel = (
  { atXEndEdge, atXStartEdge, atYEndEdge, atYStartEdge }: GridWheelState,
  onWheelDelta: GridWheelHandler,
) => {
  let frameHandle: number | null = null
  let targetX = 0
  let targetY = 0
  let currentX = 0
  let currentY = 0

  const hasReachedEdge = (x: number, y: number) => {
    const xEdgeReached =
      (x <= 0 && atXStartEdge.value) || (x >= 0 && atXEndEdge.value)
    const yEdgeReached =
      (y <= 0 && atYStartEdge.value) || (y >= 0 && atYEndEdge.value)
    return xEdgeReached && yEdgeReached
  }

  const scheduleWheelFlush = () => {
    if (frameHandle) return
    frameHandle = rAF(() => {
      frameHandle = null

      const distanceX = targetX - currentX
      const distanceY = targetY - currentY
      const nextX =
        Math.abs(distanceX) <= WHEEL_SCROLL_EPSILON
          ? targetX
          : currentX + distanceX * WHEEL_SCROLL_EASE
      const nextY =
        Math.abs(distanceY) <= WHEEL_SCROLL_EPSILON
          ? targetY
          : currentY + distanceY * WHEEL_SCROLL_EASE
      const deltaX = nextX - currentX
      const deltaY = nextY - currentY

      currentX = nextX
      currentY = nextY
      if (deltaX !== 0 || deltaY !== 0) {
        onWheelDelta(deltaX, deltaY)
      }

      if (
        Math.abs(targetX - currentX) > WHEEL_SCROLL_EPSILON ||
        Math.abs(targetY - currentY) > WHEEL_SCROLL_EPSILON
      ) {
        scheduleWheelFlush()
      } else {
        targetX = 0
        targetY = 0
        currentX = 0
        currentY = 0
      }
    })
  }

  const onWheel = (e: WheelEvent) => {
    const target = e.currentTarget
    const viewportWidth = target instanceof HTMLElement ? target.clientWidth : 0
    const viewportHeight =
      target instanceof HTMLElement ? target.clientHeight : 0
    let x = normalizeFsusWheelDelta(e.deltaX, {
      deltaMode: e.deltaMode,
      maxDiscreteDeltaPx: 64,
      viewportSizePx: viewportWidth,
    })
    let y = normalizeFsusWheelDelta(e.deltaY, {
      deltaMode: e.deltaMode,
      maxDiscreteDeltaPx: 64,
      viewportSizePx: viewportHeight,
    })
    // Simulate native behavior when using touch pad/track pad for wheeling.
    if (Math.abs(x) > Math.abs(y)) {
      y = 0
    } else {
      x = 0
    }

    // Special case for windows machine with shift key + wheel scrolling
    if (e.shiftKey && y !== 0) {
      x = y
      y = 0
    }

    if (
      hasReachedEdge(targetX, targetY) &&
      hasReachedEdge(targetX + x, targetY + y)
    )
      return

    targetX += x
    targetY += y

    e.preventDefault()

    scheduleWheelFlush()
  }

  return {
    hasReachedEdge,
    onWheel,
  }
}
