import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes } from 'vue'

export const perceptionChallengeKinds = [
  'text-task',
  'localization',
  'micro-interaction',
] as const

export const perceptionChallengeStates = [
  'idle',
  'loading',
  'ready',
  'error',
  'verifying',
  'submitting',
  'failed',
  'verified',
  'expired',
] as const

export type PerceptionChallengeKind = (typeof perceptionChallengeKinds)[number]
export type PerceptionChallengeState =
  (typeof perceptionChallengeStates)[number]

export type PerceptionChallengePoint = {
  x: number
  y: number
}

export type PerceptionChallengeRenderPayload =
  | {
      kind: 'image-url'
      src: string
      width: number
      height: number
      alt?: string
    }
  | {
      kind: 'bitmap'
      bitmap: ImageBitmap
      width: number
      height: number
      alt?: string
    }
  | {
      kind: 'rgba-raster'
      pixels: Uint8ClampedArray
      width: number
      height: number
      alt?: string
    }

export type PerceptionChallengeAssignment = {
  challengeId?: string
  kind: PerceptionChallengeKind
  prompt?: string
  description?: string
  gridWidth?: number
  gridHeight?: number
  expiresAtUnixMs?: number
  renderPayload?: PerceptionChallengeRenderPayload | null
  microInteractionEnabled?: boolean
  meta?: Record<string, unknown>
}

export type PerceptionTextTaskSubmitPayload = {
  kind: 'text-task'
  value: string
  challengeId?: string
}

export type PerceptionLocalizationSubmitPayload = {
  kind: 'localization'
  x: number
  y: number
  challengeId?: string
}

export type PerceptionMicroInteractionSubmitPayload = {
  kind: 'micro-interaction'
  steps: string[]
  challengeId?: string
}

export type PerceptionChallengeSubmitPayload =
  | PerceptionTextTaskSubmitPayload
  | PerceptionLocalizationSubmitPayload
  | PerceptionMicroInteractionSubmitPayload

export type PerceptionChallengeVerifyResult = {
  verified: boolean
  proofToken?: string
  reason?: string
  retryAfterMs?: number
}

export type PerceptionChallengeExpiredPayload = {
  challengeId?: string
  reason: 'state' | 'proofExpired' | 'expiresAtUnixMs'
}

export type PerceptionChallengeClient = {
  refresh?: () =>
    | PerceptionChallengeAssignment
    | null
    | Promise<PerceptionChallengeAssignment | null>
  verify?: (
    payload: PerceptionChallengeSubmitPayload,
  ) =>
    | PerceptionChallengeVerifyResult
    | Promise<PerceptionChallengeVerifyResult>
}

export type PerceptionChallengeRenderer = {
  render: (
    challenge: PerceptionChallengeAssignment,
  ) =>
    | PerceptionChallengeRenderPayload
    | null
    | Promise<PerceptionChallengeRenderPayload | null>
}

export const perceptionChallengeCommonProps = buildProps({
  prompt: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  disabled: Boolean,
  loading: Boolean,
  expired: Boolean,
  error: {
    type: String,
    default: '',
  },
} as const)

export const perceptionChallengeProps = buildProps({
  challenge: {
    type: definePropType<PerceptionChallengeAssignment | null>(Object),
    default: null,
  },
  client: {
    type: definePropType<PerceptionChallengeClient | null>(Object),
    default: null,
  },
  renderer: {
    type: definePropType<PerceptionChallengeRenderer | null>(Object),
    default: null,
  },
  renderPayload: {
    type: definePropType<PerceptionChallengeRenderPayload | null>(Object),
    default: null,
  },
  kind: {
    type: String,
    values: perceptionChallengeKinds,
    default: 'text-task',
  },
  state: {
    type: String,
    values: perceptionChallengeStates,
  },
  title: {
    type: String,
    default: 'Perception challenge',
  },
  eyebrow: {
    type: String,
    default: '',
  },
  autoLoad: Boolean,
  disabled: Boolean,
  retryable: {
    type: Boolean,
    default: true,
  },
  proofExpired: Boolean,
  error: {
    type: String,
    default: '',
  },
  refreshLabel: {
    type: String,
    default: 'Refresh',
  },
  retryLabel: {
    type: String,
    default: 'Retry',
  },
  cancelLabel: {
    type: String,
    default: 'Cancel',
  },
  loadingText: {
    type: String,
    default: 'Preparing challenge',
  },
  failedText: {
    type: String,
    default: 'Challenge verification failed',
  },
  expiredText: {
    type: String,
    default: 'Challenge proof expired',
  },
  microInteractionEnabled: Boolean,
  now: {
    type: definePropType<() => number>(Function),
    default: Date.now,
  },
} as const)

export const textTaskChallengeProps = buildProps({
  ...perceptionChallengeCommonProps,
  modelValue: {
    type: String,
    default: '',
  },
  inputLabel: {
    type: String,
    default: 'Challenge answer',
  },
  placeholder: {
    type: String,
    default: '',
  },
  submitLabel: {
    type: String,
    default: 'Submit',
  },
} as const)

export const localizationChallengeProps = buildProps({
  ...perceptionChallengeCommonProps,
  renderPayload: {
    type: definePropType<PerceptionChallengeRenderPayload | null>(Object),
    default: null,
  },
  gridWidth: {
    type: Number,
    default: 0,
  },
  gridHeight: {
    type: Number,
    default: 0,
  },
  selectedPoint: {
    type: definePropType<PerceptionChallengePoint | null>(Object),
    default: null,
  },
  submitOnClick: {
    type: Boolean,
    default: true,
  },
  targetLabel: {
    type: String,
    default: 'Challenge image',
  },
} as const)

export const microInteractionChallengeProps = buildProps({
  ...perceptionChallengeCommonProps,
  enabled: Boolean,
  title: {
    type: String,
    default: 'Micro-interaction challenge',
  },
  gateText: {
    type: String,
    default: 'Micro-interaction challenge is not enabled',
  },
  actionLabel: {
    type: String,
    default: 'Confirm interaction',
  },
} as const)

export const perceptionChallengeEmits = {
  refresh: () => true,
  retry: () => true,
  cancel: () => true,
  submit: (payload: PerceptionChallengeSubmitPayload) =>
    Boolean(payload && typeof payload.kind === 'string'),
  rendered: (payload: PerceptionChallengeRenderPayload | null) =>
    payload === null || typeof payload === 'object',
  verified: (value: PerceptionChallengeVerifyResult) =>
    Boolean(value && typeof value.verified === 'boolean'),
  expired: (value: PerceptionChallengeExpiredPayload) =>
    Boolean(value && typeof value.reason === 'string'),
  error: (value: string) => typeof value === 'string',
}

export const textTaskChallengeEmits = {
  'update:modelValue': (value: string) => typeof value === 'string',
  submit: (payload: PerceptionTextTaskSubmitPayload) =>
    payload.kind === 'text-task' && typeof payload.value === 'string',
}

export const localizationChallengeEmits = {
  'update:selectedPoint': (point: PerceptionChallengePoint | null) =>
    point === null || (Number.isFinite(point.x) && Number.isFinite(point.y)),
  select: (point: PerceptionChallengePoint) =>
    Number.isFinite(point.x) && Number.isFinite(point.y),
  submit: (payload: PerceptionLocalizationSubmitPayload) =>
    payload.kind === 'localization' &&
    Number.isFinite(payload.x) &&
    Number.isFinite(payload.y),
}

export const microInteractionChallengeEmits = {
  submit: (payload: PerceptionMicroInteractionSubmitPayload) =>
    payload.kind === 'micro-interaction' && Array.isArray(payload.steps),
}

export type PerceptionChallengeProps = ExtractPropTypes<
  typeof perceptionChallengeProps
>
export type TextTaskChallengeProps = ExtractPropTypes<
  typeof textTaskChallengeProps
>
export type LocalizationChallengeProps = ExtractPropTypes<
  typeof localizationChallengeProps
>
export type MicroInteractionChallengeProps = ExtractPropTypes<
  typeof microInteractionChallengeProps
>
