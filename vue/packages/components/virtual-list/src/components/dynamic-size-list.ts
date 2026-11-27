import { nextTick, reactive } from 'vue'
import { throwError } from '@element-plus/utils'
import { batchEstimateRowHeights } from '../hooks/use-wasm-row-height'

import createList from '../builders/build-list'

import { isHorizontal } from '../utils'
import { DEFAULT_DYNAMIC_LIST_ITEM_SIZE } from '../defaults'
import {
  alignItemOffset,
  createVariableSizeSearch,
  getEstimatedAxisSize,
  measureItemsThrough,
} from './sizing'

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
    (item) => item && typeof item === 'object' && !Array.isArray(item),
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
  getItemStyleCache?.clear?.()
}

const hydrateCacheWithEstimatedHeights = async (
  props: Props,
  instance: Instance,
  cache: ListCache,
  remainingRetries = 2,
) => {
  if (
    isHorizontal(props.layout) ||
    !Array.isArray(props.data) ||
    props.data.length === 0
  ) {
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
          remainingRetries - 1,
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
    },
  )

  if (!estimatedHeights?.length) {
    return
  }

  const measuredCount = Math.min(props.total, estimatedHeights.length)
  if (measuredCount === 0) {
    return
  }

  // Publish a complete estimate without writing each row through Vue's proxy.
  const items: ListCache['items'] = {}

  let offset = 0
  for (let index = 0; index < measuredCount; index++) {
    const size = Math.max(1, Math.round(estimatedHeights[index]))
    items[index] = {
      offset,
      size,
    }
    offset += size
  }

  cache.items = items
  cache.estimatedItemSize = Math.max(1, Math.round(offset / measuredCount))
  cache.lastVisitedIndex = measuredCount - 1
  resetItemStyleCache(instance)
  instance.proxy?.$forceUpdate()
}
const getItemFromCache = (
  props: Props,
  index: number,
  listCache: ListCache,
): ListItem => {
  const { itemSize } = props
  const { items, lastVisitedIndex } = listCache

  if (index > lastVisitedIndex) {
    measureItemsThrough(items, itemSize as ItemSize, lastVisitedIndex, index)
    listCache.lastVisitedIndex = index
  }

  return items[index]
}

const { findVariableStartIndex } =
  /*#__PURE__*/ createVariableSizeSearch(getItemFromCache)

const getEstimatedTotalSize = (
  { total }: Props,
  { items, estimatedItemSize, lastVisitedIndex }: ListCache,
) =>
  getEstimatedAxisSize(
    items,
    estimatedItemSize,
    lastVisitedIndex >= total ? total - 1 : lastVisitedIndex,
    total,
  )

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
      Math.min(estimatedTotalSize - size, item.offset),
    )
    const minOffset = Math.max(0, item.offset - size + item.size)

    return alignItemOffset(alignment, scrollOffset, size, minOffset, maxOffset)
  },

  getStartIndexForOffset: (props, offset, listCache) =>
    findVariableStartIndex(
      listCache.items,
      listCache.lastVisitedIndex,
      props.total,
      offset,
      props,
      listCache,
      undefined,
    ),

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
      void hydrateCacheWithEstimatedHeights(props, instance, cache).catch(
        () => {
          throwError(SCOPE, 'WASM row-height priming failed.')
        },
      )
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
        `,
        )
      }
    }
  },
})

export default DynamicSizeList
