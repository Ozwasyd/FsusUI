import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes } from 'vue'
import type ResponsiveCollection from './responsive-collection.vue'

export type ResponsiveCollectionRowKey =
  | string
  | number
  | ((item: unknown, index: number) => string | number)

export const responsiveCollectionRenderStrategies = [
  'show-both',
  'lazy-branch',
  'desktop-only',
  'compact-only',
] as const

export type ResponsiveCollectionRenderStrategy =
  (typeof responsiveCollectionRenderStrategies)[number]

export const responsiveCollectionProps = buildProps({
  /**
   * @description collection items shared by desktop and compact slots
   */
  items: {
    type: definePropType<unknown[]>(Array),
    default: () => [],
  },
  /**
   * @description row key field or resolver
   */
  rowKey: {
    type: definePropType<ResponsiveCollectionRowKey>([
      String,
      Number,
      Function,
    ]),
    default: undefined,
  },
  /**
   * @description force compact mode; omit to use compact media query
   */
  compact: {
    type: Boolean,
    default: undefined,
  },
  /**
   * @description media query used when compact is not controlled
   */
  compactQuery: {
    type: String,
    default: '(max-width: 639px)',
  },
  /**
   * @description controls whether responsive branches are mounted eagerly or lazily
   */
  renderStrategy: {
    type: definePropType<ResponsiveCollectionRenderStrategy>(String),
    values: responsiveCollectionRenderStrategies,
    default: 'lazy-branch',
  },
  /**
   * @description accessible label for compact list mode
   */
  ariaLabel: String,
} as const)

export type ResponsiveCollectionProps = ExtractPropTypes<
  typeof responsiveCollectionProps
>
export type ResponsiveCollectionInstance = InstanceType<
  typeof ResponsiveCollection
>
