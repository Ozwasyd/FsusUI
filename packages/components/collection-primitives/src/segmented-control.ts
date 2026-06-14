import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { buildProps, definePropType } from '@element-plus/utils'
import { collectionDensities } from './collection-toolbar'

import type { ExtractPropTypes } from 'vue'
import type SegmentedControl from './segmented-control.vue'

export type SegmentedControlValue = string | number | boolean

export type SegmentedControlItem = {
  label: string
  value: SegmentedControlValue
  disabled?: boolean
}

export const segmentedControlProps = buildProps({
  /**
   * @description selected item value
   */
  modelValue: {
    type: definePropType<SegmentedControlValue>([String, Number, Boolean]),
  },
  /**
   * @description segmented control options
   */
  items: {
    type: definePropType<SegmentedControlItem[]>(Array),
    default: () => [],
  },
  /**
   * @description accessible label for the radiogroup
   */
  ariaLabel: String,
  /**
   * @description id of an external label for the radiogroup
   */
  ariaLabelledby: String,
  /**
   * @description control density
   */
  density: {
    type: String,
    values: collectionDensities,
    default: 'default',
  },
} as const)

export const segmentedControlEmits = {
  [UPDATE_MODEL_EVENT]: (_value: SegmentedControlValue) => true,
  [CHANGE_EVENT]: (_value: SegmentedControlValue) => true,
}

export type SegmentedControlProps = ExtractPropTypes<
  typeof segmentedControlProps
>
export type SegmentedControlEmits = typeof segmentedControlEmits
export type SegmentedControlInstance = InstanceType<typeof SegmentedControl>
