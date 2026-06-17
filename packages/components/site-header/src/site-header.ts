import { buildProps } from '@element-plus/utils'

import type { ExtractPropTypes } from 'vue'
import type SiteHeader from './site-header.vue'

export const siteHeaderProps = buildProps({
  /**
   * @description accessible label for the header landmark
   */
  ariaLabel: {
    type: String,
    default: 'Site header',
  },
  /**
   * @description accessible label for desktop navigation
   */
  navAriaLabel: {
    type: String,
    default: 'Primary navigation',
  },
  /**
   * @description keep the header sticky
   */
  sticky: {
    type: Boolean,
    default: true,
  },
  /**
   * @description header content max width
   */
  maxWidth: {
    type: String,
    default: '64rem',
  },
} as const)

export type SiteHeaderProps = ExtractPropTypes<typeof siteHeaderProps>
export type SiteHeaderInstance = InstanceType<typeof SiteHeader>
