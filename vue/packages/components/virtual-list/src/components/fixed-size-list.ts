import { isString, throwError } from '@element-plus/utils'
import buildList from '../builders/build-list'
import { isHorizontal } from '../utils'
import {
  alignItemOffset,
  getFixedStartIndex,
  getFixedStopIndex,
} from './sizing'

const FixedSizeList = buildList({
  name: 'ElFixedSizeList',
  getItemOffset: ({ itemSize }, index) => index * (itemSize as number),

  getItemSize: ({ itemSize }) => itemSize as number,

  getEstimatedTotalSize: ({ total, itemSize }) => (itemSize as number) * total,

  getOffset: (
    { height, total, itemSize, layout, width },
    index,
    alignment,
    scrollOffset
  ) => {
    const size = (isHorizontal(layout) ? width : height) as number
    if (process.env.NODE_ENV !== 'production' && isString(size)) {
      throwError(
        '[ElVirtualList]',
        `
        You should set
          width/height
        to number when your layout is
          horizontal/vertical
      `,
      )
    }
    const lastItemOffset = Math.max(0, total * (itemSize as number) - size)
    const maxOffset = Math.min(lastItemOffset, index * (itemSize as number))
    const minOffset = Math.max(0, (index + 1) * (itemSize as number) - size)

    return alignItemOffset(
      alignment,
      scrollOffset,
      size,
      minOffset,
      maxOffset,
      {
        lastOffset: lastItemOffset,
      },
    )
  },

  getStartIndexForOffset: ({ total, itemSize }, offset) =>
    getFixedStartIndex(total, itemSize as number, offset),

  getStopIndexForStartIndex: (
    { height, total, itemSize, layout, width },
    startIndex,
    scrollOffset,
  ) =>
    getFixedStopIndex(
      total,
      itemSize as number,
      (isHorizontal(layout) ? width : height) as number,
      startIndex,
      scrollOffset,
    ),

  /**
   * Fixed size list does not need this cache
   * Using any to bypass it, TODO: Using type inference to fix this.
   */
  initCache() {
    return undefined as any
  },

  clearCache: true,

  validateProps() {
    //
  },
})

export default FixedSizeList
