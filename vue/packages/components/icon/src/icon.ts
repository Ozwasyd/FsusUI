import { buildProps, definePropType } from '@element-plus/utils'
import type { ExtractPropTypes } from 'vue'
import type Icon from './icon.vue'

export const iconVariants = ['inherit', 'linear'] as const

export const iconProps = buildProps({
  /**
   * @description SVG icon size, size x size
   */
  size: {
    type: definePropType<number | string>([Number, String]),
  },
  /**
   * @description SVG tag's fill attribute
   */
  color: {
    type: String,
  },
  /**
   * @description opt into the scoped FsusUI line icon cap/join recipe
   */
  variant: {
    type: String,
    values: iconVariants,
    default: 'inherit',
  },
} as const)
export type IconProps = ExtractPropTypes<typeof iconProps>
export type IconInstance = InstanceType<typeof Icon>
