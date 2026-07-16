import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes } from 'vue'
import type SiteHeader from './site-header.vue'

export type SiteHeaderClassValue =
  | string
  | Record<string, boolean>
  | SiteHeaderClassValue[]

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
  /**
   * @description avoid inline style attributes for strict style-src-attr CSP consumers
   */
  cspSafe: Boolean,
  /**
   * @description extra class for the inner width container
   */
  innerClass: {
    type: definePropType<SiteHeaderClassValue>([String, Object, Array]),
  },
  /**
   * @description extra class for the primary row
   */
  primaryRowClass: {
    type: definePropType<SiteHeaderClassValue>([String, Object, Array]),
  },
  /**
   * @description extra class for the brand/nav group
   */
  brandNavClass: {
    type: definePropType<SiteHeaderClassValue>([String, Object, Array]),
  },
  /**
   * @description extra class for the desktop actions group
   */
  desktopActionsClass: {
    type: definePropType<SiteHeaderClassValue>([String, Object, Array]),
  },
  /**
   * @description extra class for the mobile primary actions group
   */
  mobilePrimaryActionsClass: {
    type: definePropType<SiteHeaderClassValue>([String, Object, Array]),
  },
  /**
   * @description extra class for the mobile secondary actions group
   */
  mobileSecondaryActionsClass: {
    type: definePropType<SiteHeaderClassValue>([String, Object, Array]),
  },
} as const)

export type SiteHeaderProps = ExtractPropTypes<typeof siteHeaderProps>
export type SiteHeaderInstance = InstanceType<typeof SiteHeader>
