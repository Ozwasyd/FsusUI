import { buildProps } from '@element-plus/utils'

import type { ExtractPropTypes } from 'vue'

/**
 * TODO: make this under constants or tokens
 */
export const tooltipV2CommonProps = buildProps({
  nowrap: Boolean,
} as const)

export type TooltipV2CommonProps = ExtractPropTypes<typeof tooltipV2CommonProps>

// Ambient enum types retain nominal members; the runtime object uses erasable syntax.
declare enum TooltipV2Sides {
  top = 'top',
  bottom = 'bottom',
  left = 'left',
  right = 'right',
}

const tooltipSides = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
} as typeof TooltipV2Sides

type tooltipSides = TooltipV2Sides
declare namespace tooltipSides {
  type top = TooltipV2Sides.top
  type bottom = TooltipV2Sides.bottom
  type left = TooltipV2Sides.left
  type right = TooltipV2Sides.right
}

export { tooltipSides as TooltipV2Sides }

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
