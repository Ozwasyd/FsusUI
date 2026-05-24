import { nextTick, reactive } from 'vue'
import { throwError } from '@element-plus/utils'
import { batchEstimateRowHeights } from '../hooks/use-wasm-row-height'

import createList from '../builders/build-list'

import { isHorizontal } from '../utils'
import {
  AUTO_ALIGNMENT,
  CENTERED_ALIGNMENT,
  DEFAULT_DYNAMIC_LIST_ITEM_SIZE,
  END_ALIGNMENT,
  SMART_ALIGNMENT,
  START_ALIGNMENT,
} from '../defaults'
import type { VirtualizedListProps } from '../props'

import type {
  Instance,
  ItemSize,
  ListCache,
  ListExposes,
  ListItem,
} from '../types'

type Props = VirtualizedListProps

const SCOPE = 'ElDynamicSizeList'
const DEFAULT_WASM_TEXT_KEYS = ['label', 'text', 'title', 'name', 'content']

const resolveWasmTextKey = (items: unknown[]) => {
  const record = items.find(
    (item) => item && typeof item === 'object' && !Array.isArray(item)
  ) as Record<string, unknown> | undefined

  if (!record) {
    return null
  }

  return (
    DEFAULT_WASM_TEXT_KEYS.find((key) => typeof record[key] === 'string') ||
    null
  )
}

const resolveWasmRowWidth = (props: Props, instance: Instance): number => {
  if (typeof props.width === 'number') {
    return props.width
  }

  const exposes = instance.exposed as Partial<ListExposes> | undefined
  return exposes?.windowRef?.value?.clientWidth || 0
}

const getItemStyleCacheGetter = (instance: Instance) => {
  const getter = instance.exposed?.getItemStyleCache

  if (typeof getter === 'function') {
    return getter
  }

  if (getter && typeof getter.value === 'function') {
    return getter.value
  }

  return null
}

const resetItemStyleCache = (instance: Instance) => {
  const getItemStyleCache = getItemStyleCacheGetter(instance)
  const itemStyleCache = getItemStyleCache?.(false, false, false)

  if (!itemStyleCache) {
    return
  }

  Object.keys(itemStyleCache).forEach((key) => {
    delete itemStyleCache[key]
  })
}

const hydrateCacheWithEstimatedHeights = async (
  props: Props,
  instance: Instance,
  cache: ListCache,
  remainingRetries = 2
) => {
  if (isHorizontal(props.layout) || !Array.isArray(props.data) || props.data.length === 0) {
    return
  }

  const textKey = resolveWasmTextKey(props.data)
  if (!textKey) {
    return
  }

  const rowWidth = resolveWasmRowWidth(props, instance)
  if (!rowWidth) {
    if (remainingRetries > 0) {
      nextTick(() => {
        void hydrateCacheWithEstimatedHeights(
          props,
          instance,
          cache,
          remainingRetries - 1
        )
      })
    }
    return
  }

  const estimatedHeights = await batchEstimateRowHeights(
    props.data as Record<string, unknown>[],
    textKey,
    {
      rowWidth,
    }
  )

  if (!estimatedHeights?.length) {
    return
  }

  const measuredCount = Math.min(props.total, estimatedHeights.length)
  if (measuredCount === 0) {
    return
  }

  cache.items = {}

  let offset = 0
  for (let index = 0; index < measuredCount; index++) {
    const size = Math.max(1, Math.round(estimatedHeights[index]))
    cache.items[index] = {
      offset,
      size,
    }
    offset += size
  }

  cache.estimatedItemSize = Math.max(1, Math.round(offset / measuredCount))
  cache.lastVisitedIndex = measuredCount - 1
  resetItemStyleCache(instance)
  instance.proxy?.$forceUpdate()
}
const getItemFromCache = (
  props: Props,
  index: number,
  listCache: ListCache
): ListItem => {
  const { itemSize } = props
  const { items, lastVisitedIndex } = listCache

  if (index > lastVisitedIndex) {
    let offset = 0
    if (lastVisitedIndex >= 0) {
      const item = items[lastVisitedIndex]
      offset = item.offset + item.size
    }

    for (let i = lastVisitedIndex + 1; i <= index; i++) {
      const size = (itemSize as ItemSize)(i)

      items[i] = {
        offset,
        size,
      }

      offset += size
    }

    listCache.lastVisitedIndex = index
  }

  return items[index]
}

const findItem = (props: Props, listCache: ListCache, offset: number) => {
  const { items, lastVisitedIndex } = listCache

  const lastVisitedOffset =
    lastVisitedIndex > 0 ? items[lastVisitedIndex].offset : 0

  if (lastVisitedOffset >= offset) {
    return bs(props, listCache, 0, lastVisitedIndex, offset)
  }
  return es(props, listCache, Math.max(0, lastVisitedIndex), offset)
}

// bs stands for binary search which has approximately time complexity of O(Log n)
// space complexity of O(1)
// in this case we use it for search the offset of each item, since
// the cached items' offset is monotonically increasing
const bs = (
  props: Props,
  listCache: ListCache,
  low: number,
  high: number,
  offset: number
) => {
  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2)
    const currentOffset = getItemFromCache(props, mid, listCache).offset

    if (currentOffset === offset) {
      return mid
    } else if (currentOffset < offset) {
      low = mid + 1
    } else if (currentOffset > offset) {
      high = mid - 1
    }
  }

  return Math.max(0, low - 1)
}

// es stands for exponential search which has time complexity of O(Log n) and
// space complexity of O(1) in the case of finding the boundary element.
// the exponential indicator in this case is 2.
// for more detail about exponential search click this link
// https://www.freecodecamp.org/news/search-algorithms-exponential-search-explained/

const es = (
  props: Props,
  listCache: ListCache,
  index: number,
  offset: number
) => {
  const { total } = props
  let exponent = 1

  while (
    index < total &&
    getItemFromCache(props, index, listCache).offset < offset
  ) {
    index += exponent
    exponent *= 2
  }

  return bs(
    props,
    listCache,
    Math.floor(index / 2),
    Math.min(index, total - 1),
    offset
  )
}

const getEstimatedTotalSize = (
  { total }: Props,
  { items, estimatedItemSize, lastVisitedIndex }: ListCache
) => {
  let totalSizeOfMeasuredItems = 0

  if (lastVisitedIndex >= total) {
    lastVisitedIndex = total - 1
  }

  if (lastVisitedIndex >= 0) {
    const item = items[lastVisitedIndex]
    totalSizeOfMeasuredItems = item.offset + item.size
  }

  const numUnmeasuredItems = total - lastVisitedIndex - 1
  const totalSizeOfUnmeasuredItems = numUnmeasuredItems * estimatedItemSize
  return totalSizeOfMeasuredItems + totalSizeOfUnmeasuredItems
}

const DynamicSizeList = createList({
  name: 'ElDynamicSizeList',
  getItemOffset: (props, index, listCache) =>
    getItemFromCache(props, index, listCache).offset,

  getItemSize: (_, index, { items }) => items[index].size,

  getEstimatedTotalSize,

  getOffset: (props, index, alignment, scrollOffset, listCache) => {
    const { height, layout, width } = props

    const size = (isHorizontal(layout) ? width : height) as number
    const item = getItemFromCache(props, index, listCache)

    const estimatedTotalSize = getEstimatedTotalSize(props, listCache)

    const maxOffset = Math.max(
      0,
      Math.min(estimatedTotalSize - size, item.offset)
    )
    const minOffset = Math.max(0, item.offset - size + item.size)

    if (alignment === SMART_ALIGNMENT) {
      if (
        scrollOffset >= minOffset - size &&
        scrollOffset <= maxOffset + size
      ) {
        alignment = AUTO_ALIGNMENT
      } else {
        alignment = CENTERED_ALIGNMENT
      }
    }

    switch (alignment) {
      case START_ALIGNMENT: {
        return maxOffset
      }
      case END_ALIGNMENT: {
        return minOffset
      }
      case CENTERED_ALIGNMENT: {
        return Math.round(minOffset + (maxOffset - minOffset) / 2)
      }
      case AUTO_ALIGNMENT:
      default: {
        if (scrollOffset >= minOffset && scrollOffset <= maxOffset) {
          return scrollOffset
        } else if (scrollOffset < minOffset) {
          return minOffset
        } else {
          return maxOffset
        }
      }
    }
  },

  getStartIndexForOffset: (props, offset, listCache) =>
    findItem(props, listCache, offset),

  getStopIndexForStartIndex: (props, startIndex, scrollOffset, listCache) => {
    const { height, total, layout, width } = props

    const size = (isHorizontal(layout) ? width : height) as number
    const item = getItemFromCache(props, startIndex, listCache)
    const maxOffset = scrollOffset + size

    let offset = item.offset + item.size
    let stopIndex = startIndex

    while (stopIndex < total - 1 && offset < maxOffset) {
      stopIndex++
      offset += getItemFromCache(props, stopIndex, listCache).size
    }

    return stopIndex
  },

  initCache(props, instance) {
    const { estimatedItemSize = DEFAULT_DYNAMIC_LIST_ITEM_SIZE } = props
    const cache = reactive({
      items: {},
      estimatedItemSize,
      lastVisitedIndex: -1,
    }) as ListCache

    cache.clearCacheAfterIndex = (index: number, forceUpdate = true) => {
      cache.lastVisitedIndex = Math.min(cache.lastVisitedIndex, index - 1)
      resetItemStyleCache(instance)

      if (forceUpdate) {
        instance.proxy?.$forceUpdate()
      }
    }

    nextTick(() => {
      void hydrateCacheWithEstimatedHeights(props, instance, cache).catch(() => {
        throwError(SCOPE, 'WASM row-height priming failed.')
      })
    })

    return cache
  },

  clearCache: false,

  validateProps: ({ itemSize }) => {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof itemSize !== 'function') {
        throwError(
          SCOPE,
          `
          itemSize is required as function, but the given value was ${typeof itemSize}
        `
        )
      }
    }
  },
})

export default DynamicSizeList
