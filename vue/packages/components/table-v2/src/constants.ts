import {
  SortOrder as sortOrder,
  Alignment as alignment,
  FixedDir as fixedDir,
} from './constants.enum-members.js'
export { sortOrder as SortOrder, alignment as Alignment, fixedDir as FixedDir }
export const oppositeOrderMap = {
  [sortOrder.ASC]: sortOrder.DESC,
  [sortOrder.DESC]: sortOrder.ASC,
}

export const sortOrders = [sortOrder.ASC, sortOrder.DESC] as const
