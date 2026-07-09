import { buildProps } from '@element-plus/utils'

import type { ExtractPropTypes, HTMLAttributes } from 'vue'
import type CollectionToolbar from './collection-toolbar.vue'

export const collectionDensities = ['default', 'compact'] as const

export type CollectionDensity = (typeof collectionDensities)[number]

export const collectionToolbarProps = buildProps({
  /**
   * @description accessible label for the toolbar region
   */
  ariaLabel: String,
  /**
   * @description id of an external label for the toolbar region
   */
  ariaLabelledby: String,
  /**
   * @description toolbar density
   */
  density: {
    type: String,
    values: collectionDensities,
    default: 'default',
  },
  /**
   * @description semantic role for the toolbar region
   */
  role: {
    type: String,
    default: 'group' satisfies HTMLAttributes['role'],
  },
} as const)

export type CollectionToolbarProps = ExtractPropTypes<
  typeof collectionToolbarProps
>
export type CollectionToolbarInstance = InstanceType<typeof CollectionToolbar>
