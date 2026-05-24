import { withInstall } from '@element-plus/utils'
import FixedSizeListComponent from './src/components/fixed-size-list'
import DynamicSizeListComponent from './src/components/dynamic-size-list'
import FixedSizeGridComponent from './src/components/fixed-size-grid'
import DynamicSizeGridComponent from './src/components/dynamic-size-grid'

export const FixedSizeList = withInstall(FixedSizeListComponent)
export const DynamicSizeList = withInstall(DynamicSizeListComponent)
export const FixedSizeGrid = withInstall(FixedSizeGridComponent)
export const DynamicSizeGrid = withInstall(DynamicSizeGridComponent)
export * from './src/props'

export type { GridInstance } from './src/builders/build-grid'
export type {
  DynamicSizeGridInstance,
  ResetAfterIndex,
  ResetAfterIndices,
} from './src/components/dynamic-size-grid'
export * from './src/types'
