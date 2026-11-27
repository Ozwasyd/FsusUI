// @ts-nocheck
import { isFunction } from '@vue/shared'
import { isNumber, isUndefined, throwError } from '@element-plus/utils'
import createGrid from '../builders/build-grid'

import { DEFAULT_DYNAMIC_LIST_ITEM_SIZE } from '../defaults'
import {
  alignItemOffset,
  findVariableStartIndex,
  getEstimatedAxisSize,
  getVariableStopIndex,
  measureItemsThrough,
} from './sizing'

import type { GridInstance } from '../builders/build-grid'
import type { VirtualizedGridProps } from '../props'

import type { Alignment, GridCache, ItemSize, ListItem } from '../types'

const { max, min } = Math
const SCOPE = 'ElDynamicSizeGrid'

type Props = VirtualizedGridProps
type CacheItemType = 'column' | 'row'
type Indices = {
  columnIndex?: number
  rowIndex?: number
}

// generates props access key via type
const ACCESS_SIZER_KEY_MAP = {
  column: 'columnWidth',
  row: 'rowHeight',
}

// generates cache access key via type
const ACCESS_LAST_VISITED_KEY_MAP = {
  column: 'lastVisitedColumnIndex',
  row: 'lastVisitedRowIndex',
}

const getItemFromCache = (
  props: Props,
  index: number,
  gridCache: GridCache,
  type: CacheItemType,
) => {
  const [cachedItems, sizer, lastVisited] = [
    gridCache[type],
    props[ACCESS_SIZER_KEY_MAP[type]],
    gridCache[ACCESS_LAST_VISITED_KEY_MAP[type]],
  ] as [Record<string, ListItem>, ItemSize, number]

  if (index > lastVisited) {
    measureItemsThrough(cachedItems, sizer, lastVisited, index)
    gridCache[ACCESS_LAST_VISITED_KEY_MAP[type]] = index
  }

  return cachedItems[index]
}

const findItem = (
  props: Props,
  gridCache: GridCache,
  offset: number,
  type: CacheItemType,
) =>
  findVariableStartIndex(
    gridCache[type],
    (index) => getItemFromCache(props, index, gridCache, type),
    gridCache[ACCESS_LAST_VISITED_KEY_MAP[type]],
    type === 'column' ? props.totalColumn : props.totalRow,
    offset,
    true,
  )

const getEstimatedTotalHeight = (
  { totalRow }: Props,
  { estimatedRowHeight, lastVisitedRowIndex, row }: GridCache,
) =>
  getEstimatedAxisSize(
    row,
    estimatedRowHeight,
    lastVisitedRowIndex >= totalRow ? totalRow - 1 : lastVisitedRowIndex,
    totalRow,
  )

const getEstimatedTotalWidth = (
  { totalColumn }: Props,
  { column, estimatedColumnWidth, lastVisitedColumnIndex }: GridCache,
) =>
  getEstimatedAxisSize(
    column,
    estimatedColumnWidth,
    lastVisitedColumnIndex > totalColumn
      ? totalColumn - 1
      : lastVisitedColumnIndex,
    totalColumn,
  )

const ACCESS_ESTIMATED_SIZE_KEY_MAP = {
  column: getEstimatedTotalWidth,
  row: getEstimatedTotalHeight,
}

const getOffset = (
  props: Props,
  index: number,
  alignment: Alignment,
  scrollOffset: number,
  cache: GridCache,
  type: CacheItemType,
  scrollBarWidth: number,
) => {
  const [size, estimatedSizeAssociates] = [
    type === 'row' ? props.height : props.width,
    ACCESS_ESTIMATED_SIZE_KEY_MAP[type],
  ] as [number, (props: Props, cache: GridCache) => number]
  const item = getItemFromCache(props, index, cache, type)

  const estimatedSize = estimatedSizeAssociates(props, cache)

  const maxOffset = max(0, min(estimatedSize - size, item.offset))
  const minOffset = max(0, item.offset - size + scrollBarWidth + item.size)

  return alignItemOffset(alignment, scrollOffset, size, minOffset, maxOffset, {
    preferEndWhenBoundsCross: true,
  })
}

const DynamicSizeGrid = createGrid({
  name: 'ElDynamicSizeGrid',
  getColumnPosition: (props, idx, cache) => {
    const item = getItemFromCache(props, idx, cache, 'column')
    return [item.size, item.offset]
  },

  getRowPosition: (props, idx, cache) => {
    const item = getItemFromCache(props, idx, cache, 'row')
    return [item.size, item.offset]
  },

  getColumnOffset: (
    props,
    columnIndex,
    alignment,
    scrollLeft,
    cache,
    scrollBarWidth,
  ) =>
    getOffset(
      props,
      columnIndex,
      alignment,
      scrollLeft,
      cache,
      'column',
      scrollBarWidth,
    ),

  getRowOffset: (
    props,
    rowIndex,
    alignment,
    scrollTop,
    cache,
    scrollBarWidth: number,
  ) =>
    getOffset(
      props,
      rowIndex,
      alignment,
      scrollTop,
      cache,
      'row',
      scrollBarWidth,
    ),

  getColumnStartIndexForOffset: (props, scrollLeft, cache) =>
    findItem(props, cache, scrollLeft, 'column'),

  getColumnStopIndexForStartIndex: (props, startIndex, scrollLeft, cache) => {
    const item = getItemFromCache(props, startIndex, cache, 'column')
    const maxOffset = scrollLeft + (props.width as number)
    return getVariableStopIndex(
      props.totalColumn,
      startIndex,
      item.offset + item.size,
      maxOffset,
      (index) => getItemFromCache(props, index, cache, 'column'),
    )
  },

  getEstimatedTotalHeight,
  getEstimatedTotalWidth,

  getRowStartIndexForOffset: (props, scrollTop, cache) =>
    findItem(props, cache, scrollTop, 'row'),

  getRowStopIndexForStartIndex: (props, startIndex, scrollTop, cache) => {
    const { totalRow, height } = props
    const item = getItemFromCache(props, startIndex, cache, 'row')
    return getVariableStopIndex(
      totalRow,
      startIndex,
      item.size + item.offset,
      scrollTop + (height as number),
      (index) => getItemFromCache(props, index, cache, 'row'),
    )
  },
  injectToInstance: (instance, cache) => {
    const resetAfter = (
      { columnIndex, rowIndex }: Indices,
      forceUpdate?: boolean,
    ) => {
      forceUpdate = isUndefined(forceUpdate) ? true : forceUpdate

      if (isNumber(columnIndex)) {
        cache.value.lastVisitedColumnIndex = Math.min(
          cache.value.lastVisitedColumnIndex,
          columnIndex - 1,
        )
      }

      if (isNumber(rowIndex)) {
        // console.log(rowIndex)
        cache.value.lastVisitedRowIndex = Math.min(
          cache.value.lastVisitedRowIndex,
          rowIndex - 1,
        )
      }

      instance.exposed?.getItemStyleCache.value.clear()

      if (forceUpdate) instance.proxy?.$forceUpdate()
    }

    const resetAfterColumnIndex = (
      columnIndex: number,
      forceUpdate: boolean,
    ) => {
      resetAfter(
        {
          columnIndex,
        },
        forceUpdate,
      )
    }

    const resetAfterRowIndex = (rowIndex: number, forceUpdate: boolean) => {
      resetAfter(
        {
          rowIndex,
        },
        forceUpdate,
      )
    }

    Object.assign(instance.proxy, {
      resetAfterColumnIndex,
      resetAfterRowIndex,
      resetAfter,
    })
  },
  initCache: ({
    estimatedColumnWidth = DEFAULT_DYNAMIC_LIST_ITEM_SIZE,
    estimatedRowHeight = DEFAULT_DYNAMIC_LIST_ITEM_SIZE,
  }) => {
    const cache = {
      column: {},
      estimatedColumnWidth,
      estimatedRowHeight,
      lastVisitedColumnIndex: -1,
      lastVisitedRowIndex: -1,
      row: {},
    } as GridCache

    // TODO: expose methods.
    return cache
  },

  clearCache: false,

  validateProps: ({ columnWidth, rowHeight }) => {
    if (process.env.NODE_ENV !== 'production') {
      if (!isFunction(columnWidth)) {
        throwError(
          SCOPE,
          `
          "columnWidth" must be passed as function,
            instead ${typeof columnWidth} was given.
        `,
        )
      }

      if (!isFunction(rowHeight)) {
        throwError(
          SCOPE,
          `
          "rowHeight" must be passed as function,
            instead ${typeof rowHeight} was given.
        `,
        )
      }
    }
  },
})

export default DynamicSizeGrid

export type ResetAfterIndex = (idx: number, forceUpdate: boolean) => void
export type ResetAfterIndices = (indices: Indices, forceUpdate: boolean) => void

export type DynamicSizeGridInstance = GridInstance & {
  resetAfterColumnIndex: ResetAfterIndex
  resetAfterRowIndex: ResetAfterIndex
  resetAfter: ResetAfterIndices
}
