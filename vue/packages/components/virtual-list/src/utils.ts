// @ts-nocheck
import { isNumber } from '@element-plus/utils'
import {
  BACKWARD,
  DEFAULT_DYNAMIC_LIST_ITEM_SIZE,
  FORWARD,
  HORIZONTAL,
  LTR,
  PageKey,
  RTL,
  RTL_OFFSET_NAG,
  RTL_OFFSET_POS_ASC,
  RTL_OFFSET_POS_DESC,
} from './defaults'

import type { CSSProperties } from 'vue'
import type { Direction, LayoutDirection, RTLOffsetType } from './types'

export const getScrollDir = (prev: number, cur: number) =>
  prev < cur ? FORWARD : BACKWARD

export const isHorizontal = (dir: string) =>
  dir === LTR || dir === RTL || dir === HORIZONTAL

export const isRTL = (dir: Direction) => dir === RTL

let cachedRTLResult: RTLOffsetType | null = null

export function getRTLOffsetType(recalculate = false): RTLOffsetType {
  if (cachedRTLResult === null || recalculate) {
    const outerDiv = document.createElement('div')
    const outerStyle = outerDiv.style
    outerStyle.width = '50px'
    outerStyle.height = '50px'
    outerStyle.overflow = 'scroll'
    outerStyle.direction = 'rtl'

    const innerDiv = document.createElement('div')
    const innerStyle = innerDiv.style
    innerStyle.width = '100px'
    innerStyle.height = '100px'

    outerDiv.appendChild(innerDiv)

    document.body.appendChild(outerDiv)

    if (outerDiv.scrollLeft > 0) {
      cachedRTLResult = RTL_OFFSET_POS_DESC
    } else {
      outerDiv.scrollLeft = 1
      if (outerDiv.scrollLeft === 0) {
        cachedRTLResult = RTL_OFFSET_NAG
      } else {
        cachedRTLResult = RTL_OFFSET_POS_ASC
      }
    }

    document.body.removeChild(outerDiv)

    return cachedRTLResult
  }

  return cachedRTLResult
}

// Normalize browser-specific RTL offsets to the positive list and grid space.
export const getLogicalRTLScrollLeft = (
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
) => {
  switch (getRTLOffsetType()) {
    case RTL_OFFSET_NAG:
      return -scrollLeft
    case RTL_OFFSET_POS_DESC:
      return scrollWidth - clientWidth - scrollLeft
    default:
      return scrollLeft
  }
}

export const setLogicalRTLScrollLeft = (
  element: HTMLElement,
  offset: number,
) => {
  switch (getRTLOffsetType()) {
    case RTL_OFFSET_NAG:
      element.scrollLeft = -offset
      break
    case RTL_OFFSET_POS_ASC:
      element.scrollLeft = offset
      break
    default: {
      const { clientWidth, scrollWidth } = element
      element.scrollLeft = scrollWidth - clientWidth - offset
    }
  }
}

export const estimateVirtualItemSize = (
  estimatedSize: number | undefined,
  itemSize: unknown,
) =>
  Math.max(
    1,
    estimatedSize ??
      (isNumber(itemSize) ? itemSize : DEFAULT_DYNAMIC_LIST_ITEM_SIZE),
  )

export const getVirtualRange = (
  startIndex: number,
  stopIndex: number,
  total: number,
  cache: number,
  isScrolling: boolean,
  direction: string,
) => {
  const backward =
    !isScrolling || direction === BACKWARD ? Math.max(1, cache) : 1
  const forward = !isScrolling || direction === FORWARD ? Math.max(1, cache) : 1
  return [
    Math.max(0, startIndex - backward),
    Math.max(0, Math.min(total - 1, stopIndex + forward)),
    startIndex,
    stopIndex,
  ]
}

export const getRelativePos = (
  e: TouchEvent | MouseEvent,
  layout: LayoutDirection
) => {
  return 'touches' in e ? e.touches[0][PageKey[layout]] : e[PageKey[layout]]
}

type RenderThumbStyleParams = {
  bar: {
    size: 'height' | 'width'
    axis: 'X' | 'Y'
  }
  size: string
  move: number
}

export function renderThumbStyle(
  { move, size, bar }: RenderThumbStyleParams,
  layout: string
) {
  const style: CSSProperties = {}
  const translate = `translate${bar.axis}(${move}px)`

  style[bar.size] = size
  style.transform = translate
  style.msTransform = translate
  // polyfill
  ;(style as any).webkitTransform = translate

  if (layout === 'horizontal') {
    style.height = '100%'
  } else {
    style.width = '100%'
  }

  return style
}
