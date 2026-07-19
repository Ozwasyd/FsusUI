import { buildProps } from '@element-plus/utils'

import type { ExtractPropTypes, VNode } from 'vue'
import type TaskPageHeader from './task-page-header.vue'

export const taskPageHeaderDensities = ['default', 'compact'] as const
export const taskPageHeaderTitleTags = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
] as const

export type TaskPageHeaderDensity = (typeof taskPageHeaderDensities)[number]
export type TaskPageHeaderTitleTag = (typeof taskPageHeaderTitleTags)[number]

export const taskPageHeaderProps = buildProps({
  /**
   * @description task-page title; may be replaced by the title slot
   */
  title: {
    type: String,
    default: '',
  },
  /**
   * @description optional readable supporting description
   */
  description: {
    type: String,
    default: '',
  },
  /**
   * @description semantic heading tag for the task-page title
   */
  titleTag: {
    type: String,
    values: taskPageHeaderTitleTags,
    default: 'h1',
  },
  /**
   * @description spacing density; typography remains stable across densities
   */
  density: {
    type: String,
    values: taskPageHeaderDensities,
    default: 'default',
  },
} as const)

export const taskPageHeaderEmits = {}

export interface TaskPageHeaderSlots {
  title?: () => VNode[]
  description?: () => VNode[]
  actions?: () => VNode[]
}

export type TaskPageHeaderProps = ExtractPropTypes<typeof taskPageHeaderProps>
export type TaskPageHeaderEmits = typeof taskPageHeaderEmits
export type TaskPageHeaderInstance = InstanceType<typeof TaskPageHeader>
