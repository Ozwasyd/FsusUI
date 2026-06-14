import { buildProps } from '@element-plus/utils'
import { collectionDensities } from './collection-toolbar'

import type { ExtractPropTypes } from 'vue'
import type CollectionSummary from './collection-summary.vue'

export const collectionSummaryTitleTags = [
  'p',
  'div',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
] as const
export const collectionSummaryAriaLiveValues = [
  'off',
  'polite',
  'assertive',
] as const

export const collectionSummaryProps = buildProps({
  /**
   * @description summary title supplied by the consuming app
   */
  title: {
    type: String,
    default: '',
  },
  /**
   * @description total item count
   */
  total: Number,
  /**
   * @description visible item count after filtering
   */
  visible: Number,
  /**
   * @description neutral state text supplied by the consuming app
   */
  state: {
    type: String,
    default: '',
  },
  /**
   * @description summary density
   */
  density: {
    type: String,
    values: collectionDensities,
    default: 'default',
  },
  /**
   * @description semantic tag for the title
   */
  titleTag: {
    type: String,
    values: collectionSummaryTitleTags,
    default: 'p',
  },
  /**
   * @description live-region politeness. Disabled unless explicitly set.
   */
  ariaLive: {
    type: String,
    values: collectionSummaryAriaLiveValues,
    default: 'off',
  },
} as const)

export type CollectionSummaryProps = ExtractPropTypes<
  typeof collectionSummaryProps
>
export type CollectionSummaryInstance = InstanceType<typeof CollectionSummary>
