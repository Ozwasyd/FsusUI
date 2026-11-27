import { isNumber, throwError } from '@element-plus/utils'
import createGrid from '../builders/build-grid'

import {
  alignItemOffset,
  getFixedStartIndex,
  getFixedStopIndex,
} from './sizing'

import type { Alignment } from '../types'

const SCOPE = 'ElFixedSizeGrid'

const getAxisOffset = (
  total: number,
  itemSize: number,
  viewportSize: string | number | undefined,
  index: number,
  alignment: Alignment,
  scrollOffset: number,
  scrollBarWidth: number,
) => {
  const size = Number(viewportSize)
  const lastOffset = Math.max(0, total * itemSize - size)
  const offset = index * itemSize
  return alignItemOffset(
    alignment,
    scrollOffset,
    size,
    Math.max(0, offset - size + scrollBarWidth + itemSize),
    Math.min(lastOffset, offset),
    { lastOffset, preferEndWhenBoundsCross: true },
  )
}

const FixedSizeGrid = createGrid({
  name: 'ElFixedSizeGrid',
  getColumnPosition: ({ columnWidth }, index) => [
    columnWidth as number,
    index * (columnWidth as number),
  ],

  getRowPosition: ({ rowHeight }, index) => [
    rowHeight as number,
    index * (rowHeight as number),
  ],

  getEstimatedTotalHeight: ({ totalRow, rowHeight }) =>
    (rowHeight as number) * totalRow,

  getEstimatedTotalWidth: ({ totalColumn, columnWidth }) =>
    (columnWidth as number) * totalColumn,

  getColumnOffset: (
    { totalColumn, columnWidth, width },
    index,
    alignment,
    scrollLeft,
    _,
    scrollBarWidth,
  ) =>
    getAxisOffset(
      totalColumn,
      columnWidth as number,
      width,
      index,
      alignment,
      scrollLeft,
      scrollBarWidth,
    ),

  getRowOffset: (
    { totalRow, rowHeight, height },
    index,
    alignment,
    scrollTop,
    _,
    scrollBarWidth,
  ) =>
    getAxisOffset(
      totalRow,
      rowHeight as number,
      height,
      index,
      alignment,
      scrollTop,
      scrollBarWidth,
    ),

  getColumnStartIndexForOffset: ({ columnWidth, totalColumn }, scrollLeft) =>
    getFixedStartIndex(totalColumn, columnWidth as number, scrollLeft),

  getColumnStopIndexForStartIndex: (
    { columnWidth, totalColumn, width },
    startIndex,
    scrollLeft,
  ) =>
    getFixedStopIndex(
      totalColumn,
      columnWidth as number,
      width as number,
      startIndex,
      scrollLeft,
    ),

  getRowStartIndexForOffset: ({ rowHeight, totalRow }, scrollTop) =>
    getFixedStartIndex(totalRow, rowHeight as number, scrollTop),

  getRowStopIndexForStartIndex: (
    { rowHeight, totalRow, height },
    startIndex,
    scrollTop,
  ) =>
    getFixedStopIndex(
      totalRow,
      rowHeight as number,
      height as number,
      startIndex,
      scrollTop,
    ),

  /**
   * Fixed size grid does not need this cache
   * Using any to bypass it, TODO: Using type inference to fix this.
   */
  initCache: () => undefined as any,

  clearCache: true,

  validateProps: ({ columnWidth, rowHeight }) => {
    if (process.env.NODE_ENV !== 'production') {
      if (!isNumber(columnWidth)) {
        throwError(
          SCOPE,
          `
          "columnWidth" must be passed as number,
            instead ${typeof columnWidth} was given.
        `
        )
      }

      if (!isNumber(rowHeight)) {
        throwError(
          SCOPE,
          `
          "rowHeight" must be passed as number,
            instead ${typeof rowHeight} was given.
        `
        )
      }
    }
  },
})

export default FixedSizeGrid
