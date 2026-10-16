// Ambient enum types retain nominal members; the runtime object uses erasable syntax.
declare enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

const sortOrder = {
  ASC: 'asc',
  DESC: 'desc',
} as typeof SortOrder

type sortOrder = SortOrder
declare namespace sortOrder {
  type ASC = SortOrder.ASC
  type DESC = SortOrder.DESC
}

export { sortOrder as SortOrder }

declare enum Alignment {
  CENTER = 'center',
  RIGHT = 'right',
}

const alignment = {
  CENTER: 'center',
  RIGHT: 'right',
} as typeof Alignment

type alignment = Alignment
declare namespace alignment {
  type CENTER = Alignment.CENTER
  type RIGHT = Alignment.RIGHT
}

export { alignment as Alignment }

declare enum FixedDir {
  LEFT = 'left',
  RIGHT = 'right',
}

const fixedDir = {
  LEFT: 'left',
  RIGHT: 'right',
} as typeof FixedDir

type fixedDir = FixedDir
declare namespace fixedDir {
  type LEFT = FixedDir.LEFT
  type RIGHT = FixedDir.RIGHT
}

export { fixedDir as FixedDir }

export const oppositeOrderMap = {
  [sortOrder.ASC]: sortOrder.DESC,
  [sortOrder.DESC]: sortOrder.ASC,
}

export const sortOrders = [sortOrder.ASC, sortOrder.DESC] as const
