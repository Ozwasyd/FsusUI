import { buildProps } from '@element-plus/utils'
import { useSizeProp } from '@element-plus/hooks'

import type Description from './description.vue'

export const descriptionProps = buildProps({
  /**
   * @description with or without border
   */
  border: {
    type: Boolean,
    default: false,
  },
  /**
   * @description numbers of `Descriptions Item` in one line
   */
  column: {
    type: Number,
    default: 3,
  },
  /**
   * @description direction of list
   */
  direction: {
    type: String,
    values: ['horizontal', 'vertical'],
    default: 'horizontal',
  },
  /**
   * @description responsive projection used when the available inline size is constrained
   */
  responsive: {
    type: String,
    values: ['auto', 'stack', 'scroll'],
    default: 'auto',
  },
  /**
   * @description accessible name for the horizontal scroll container
   */
  scrollAriaLabel: {
    type: String,
    default: 'Scrollable descriptions',
  },
  /**
   * @description size of list
   */
  size: useSizeProp,
  /**
   * @description title text, display on the top left
   */
  title: {
    type: String,
    default: '',
  },
  /**
   * @description extra text, display on the top right
   */
  extra: {
    type: String,
    default: '',
  },
} as const)

export type DescriptionInstance = InstanceType<typeof Description>
