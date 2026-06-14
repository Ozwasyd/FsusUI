import { buildProps } from '@element-plus/utils'
import { collectionDensities } from './collection-toolbar'

import type { ExtractPropTypes } from 'vue'
import type FilterGroup from './filter-group.vue'

export const filterGroupProps = buildProps({
  /**
   * @description accessible group label
   */
  label: {
    type: String,
    default: '',
  },
  /**
   * @description filter group density
   */
  density: {
    type: String,
    values: collectionDensities,
    default: 'default',
  },
} as const)

export type FilterGroupProps = ExtractPropTypes<typeof filterGroupProps>
export type FilterGroupInstance = InstanceType<typeof FilterGroup>
