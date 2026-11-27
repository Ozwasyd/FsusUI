import {
  AUTO_ALIGNMENT,
  CENTERED_ALIGNMENT,
  END_ALIGNMENT,
  SMART_ALIGNMENT,
  START_ALIGNMENT,
} from '../defaults'

import type { Alignment, ItemSize, ListItem } from '../types'

export const alignItemOffset = (
  alignment: Alignment,
  scrollOffset: number,
  viewportSize: number,
  minOffset: number,
  maxOffset: number,
  {
    lastOffset,
    preferEndWhenBoundsCross = false,
  }: { lastOffset?: number; preferEndWhenBoundsCross?: boolean } = {},
) => {
  if (alignment === SMART_ALIGNMENT) {
    alignment =
      scrollOffset >= minOffset - viewportSize &&
      scrollOffset <= maxOffset + viewportSize
        ? AUTO_ALIGNMENT
        : CENTERED_ALIGNMENT
  }

  switch (alignment) {
    case START_ALIGNMENT:
      return maxOffset
    case END_ALIGNMENT:
      return minOffset
    case CENTERED_ALIGNMENT: {
      const middle = Math.round(minOffset + (maxOffset - minOffset) / 2)
      if (lastOffset === undefined) return middle
      if (middle < Math.ceil(viewportSize / 2)) return 0
      if (middle > lastOffset + Math.floor(viewportSize / 2)) return lastOffset
      return middle
    }
    default:
      if (scrollOffset >= minOffset && scrollOffset <= maxOffset)
        return scrollOffset
      if (preferEndWhenBoundsCross && minOffset > maxOffset) return minOffset
      return scrollOffset < minOffset ? minOffset : maxOffset
  }
}

export const getFixedStartIndex = (
  total: number,
  itemSize: number,
  scrollOffset: number,
) => Math.max(0, Math.min(total - 1, Math.floor(scrollOffset / itemSize)))

export const getFixedStopIndex = (
  total: number,
  itemSize: number,
  viewportSize: number,
  startIndex: number,
  scrollOffset: number,
) => {
  const startOffset = startIndex * itemSize
  const visibleCount = Math.ceil(
    (viewportSize + scrollOffset - startOffset) / itemSize,
  )
  return Math.max(0, Math.min(total - 1, startIndex + visibleCount - 1))
}

type MeasuredItems = Record<string, ListItem>
type GetMeasuredItem = (index: number) => ListItem

const getMeasuredEnd = (items: MeasuredItems, index: number) => {
  if (index >= 0) {
    const item = items[index]
    return item.offset + item.size
  }
  return 0
}

export const measureItemsThrough = (
  items: MeasuredItems,
  itemSize: ItemSize,
  lastVisitedIndex: number,
  index: number,
) => {
  let offset = getMeasuredEnd(items, lastVisitedIndex)
  for (let i = lastVisitedIndex + 1; i <= index; i++) {
    const size = itemSize(i)
    items[i] = { offset, size }
    offset += size
  }
}

export const getEstimatedAxisSize = (
  items: MeasuredItems,
  estimatedItemSize: number,
  lastVisitedIndex: number,
  total: number,
) =>
  getMeasuredEnd(items, lastVisitedIndex) +
  (total - lastVisitedIndex - 1) * estimatedItemSize

export const findVariableStartIndex = (
  items: MeasuredItems,
  getItem: GetMeasuredItem,
  lastVisitedIndex: number,
  total: number,
  offset: number,
  treatUnorderedOffsetAsGreater = false,
) => {
  const lastVisitedOffset =
    lastVisitedIndex > 0 ? items[lastVisitedIndex].offset : 0
  let low = 0
  let high = lastVisitedIndex

  if (!(lastVisitedOffset >= offset)) {
    let index = Math.max(0, lastVisitedIndex)
    let step = 1
    while (index < total && getItem(index).offset < offset) {
      index += step
      step *= 2
    }
    low = Math.floor(index / 2)
    high = Math.min(index, total - 1)
  }

  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2)
    const currentOffset = getItem(mid).offset
    if (currentOffset === offset) return mid
    if (currentOffset < offset) {
      low = mid + 1
    } else if (treatUnorderedOffsetAsGreater || currentOffset > offset) {
      high = mid - 1
    }
  }

  return Math.max(0, low - 1)
}

export const getVariableStopIndex = (
  total: number,
  startIndex: number,
  startItemEnd: number,
  maxOffset: number,
  getItem: GetMeasuredItem,
) => {
  let stopIndex = startIndex
  let offset = startItemEnd
  while (stopIndex < total - 1 && offset < maxOffset) {
    stopIndex++
    offset += getItem(stopIndex).size
  }
  return stopIndex
}
