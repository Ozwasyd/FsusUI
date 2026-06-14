import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes, HTMLAttributes } from 'vue'

export const emptyStateSizes = ['inline', 'compact', 'page'] as const
export const emptyStateActionVariants = [
  'link',
  'secondary',
  'primary',
] as const
export const emptyStateTitleTags = [
  'p',
  'div',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
] as const
export const emptyStateAriaLiveValues = ['off', 'polite', 'assertive'] as const

export type EmptyStateSize = (typeof emptyStateSizes)[number]
export type EmptyStateActionVariant = (typeof emptyStateActionVariants)[number]
export type EmptyStateIllustration = boolean | 'auto'
export type EmptyStateTitleTag = (typeof emptyStateTitleTags)[number]
export type EmptyStateAriaLive = (typeof emptyStateAriaLiveValues)[number]

export const emptyStateProps = buildProps({
  /**
   * @description content density and layout preset
   */
  size: {
    type: String,
    values: emptyStateSizes,
    default: 'inline',
  },
  /**
   * @description primary empty-state message
   */
  title: {
    type: String,
    default: '',
  },
  /**
   * @description supporting empty-state message
   */
  description: {
    type: String,
    default: '',
  },
  /**
   * @description illustration policy. "auto" only renders an illustration for page states.
   */
  illustration: {
    type: definePropType<EmptyStateIllustration>([Boolean, String]),
    default: 'auto',
  },
  /**
   * @description action visual intent for slotted controls
   */
  actionVariant: {
    type: String,
    values: emptyStateActionVariants,
  },
  /**
   * @description semantic tag for the title slot or title prop
   */
  titleTag: {
    type: String,
    values: emptyStateTitleTags,
    default: 'p',
  },
  /**
   * @description optional landmark/status role
   */
  role: {
    type: definePropType<HTMLAttributes['role']>(String),
  },
  /**
   * @description live-region politeness. Disabled unless explicitly set.
   */
  ariaLive: {
    type: String,
    values: emptyStateAriaLiveValues,
    default: 'off',
  },
} as const)

export type EmptyStateProps = ExtractPropTypes<typeof emptyStateProps>
