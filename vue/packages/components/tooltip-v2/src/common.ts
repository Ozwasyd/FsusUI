import { TooltipV2Sides as tooltipSides } from './common.enum-members.js'
export { tooltipSides as TooltipV2Sides }
import { buildProps } from '@element-plus/utils'

import type { ExtractPropTypes } from 'vue'

/**
 * TODO: make this under constants or tokens
 */
export const tooltipV2CommonProps = buildProps({
  nowrap: Boolean,
} as const)

export type TooltipV2CommonProps = ExtractPropTypes<typeof tooltipV2CommonProps>

export const tooltipV2Sides = Object.values(tooltipSides)

export const tooltipV2OppositeSide = {
  [tooltipSides.top]: tooltipSides.bottom,
  [tooltipSides.bottom]: tooltipSides.top,
  [tooltipSides.left]: tooltipSides.right,
  [tooltipSides.right]: tooltipSides.left,
} as const

export const tooltipV2ArrowBorders = {
  [tooltipSides.top]: [tooltipSides.left, tooltipSides.top],
  [tooltipSides.bottom]: [tooltipSides.bottom, tooltipSides.right],
  [tooltipSides.left]: [tooltipSides.bottom, tooltipSides.left],
  [tooltipSides.right]: [tooltipSides.top, tooltipSides.right],
} as const
