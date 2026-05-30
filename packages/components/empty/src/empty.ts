import { buildProps } from '@element-plus/utils'
import type { ExtractPropTypes } from 'vue'

export const emptyDescriptionLayouts = ['default', 'narrow', 'wide'] as const

export const emptyProps = buildProps({
  /**
   * @description image URL of empty
   */
  image: {
    type: String,
    default: '',
  },
  /**
   * @description image size (width) of empty
   */
  imageSize: Number,
  /**
   * @description description of empty
   */
  description: {
    type: String,
    default: '',
  },
  /**
   * @description description layout width preset
   */
  descriptionLayout: {
    type: String,
    values: emptyDescriptionLayouts,
    default: 'default',
  },
  /**
   * @description max width of the description area
   */
  descriptionWidth: {
    type: [String, Number],
  },
} as const)

export type EmptyProps = ExtractPropTypes<typeof emptyProps>
