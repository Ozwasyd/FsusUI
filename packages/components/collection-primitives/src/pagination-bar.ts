import { buildProps } from '@element-plus/utils'
import { collectionDensities } from './collection-toolbar'

import type { ExtractPropTypes } from 'vue'
import type PaginationBar from './pagination-bar.vue'

export const paginationBarProps = buildProps({
  /**
   * @description accessible label for pagination controls
   */
  ariaLabel: String,
  /**
   * @description layout density
   */
  density: {
    type: String,
    values: collectionDensities,
    default: 'default',
  },
} as const)

export type PaginationBarProps = ExtractPropTypes<typeof paginationBarProps>
export type PaginationBarInstance = InstanceType<typeof PaginationBar>
