import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes } from 'vue'

export type ResizeSeparatorCoordinateRange = Readonly<{
  start: number
  end: number
}>

export type ResizeSeparatorPayload = Readonly<{
  value: number
  source: 'pointer' | 'keyboard'
  pointerId: number | null
}>

export type ResizeSeparatorCancelReason =
  | 'pointercancel'
  | 'lostpointercapture'
  | 'escape'
  | 'disabled'
  | 'configuration-change'
  | 'consumer'
  | 'unmount'

export type ResizeSeparatorCancelPayload = ResizeSeparatorPayload &
  Readonly<{ reason: ResizeSeparatorCancelReason }>

export const resizeSeparatorProps = buildProps({
  value: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 1 },
  step: { type: Number, default: 0.01 },
  label: { type: String, required: true },
  primaryRegionId: { type: String, required: true },
  secondaryRegionId: String,
  valueText: String,
  disabled: Boolean,
  orientation: {
    type: String,
    values: ['vertical', 'horizontal'],
    default: 'vertical',
  },
  /** Viewport clientX (vertical) or clientY (horizontal) at min and max. */
  coordinateRange: {
    type: definePropType<ResizeSeparatorCoordinateRange>(Object),
    required: true,
  },
} as const)

export const resizeSeparatorEmits = {
  start: (payload: ResizeSeparatorPayload) => Number.isFinite(payload.value),
  proposal: (payload: ResizeSeparatorPayload) => Number.isFinite(payload.value),
  end: (payload: ResizeSeparatorPayload) => Number.isFinite(payload.value),
  cancel: (payload: ResizeSeparatorCancelPayload) =>
    Number.isFinite(payload.value),
}

export type ResizeSeparatorProps = ExtractPropTypes<typeof resizeSeparatorProps>
export type ResizeSeparatorEmits = typeof resizeSeparatorEmits
