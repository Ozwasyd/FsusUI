export const motionPresetNames = [
  'fade-in',
  'fade-up',
  'fade-down',
  'fade-left',
  'fade-right',
  'scale-fade',
  'slide-left',
  'slide-right',
  'slide-up',
  'list-stagger',
  'route-fade',
  'card-hover',
] as const

export type MotionPresetName = (typeof motionPresetNames)[number]

export const motionRecipeNames = [
  'content-enter',
  'article-list-enter',
  'island-enter',
  'state-pending',
  'state-settled',
  'state-error',
  'route-crossfade',
  'reading-anchor-highlight',
  'panel-enter',
  'list-enter-small',
  'card-interactive',
  'page-enter',
  'media-hover-subtle',
] as const

export type MotionRecipeName = (typeof motionRecipeNames)[number]

export type MotionTokenScale<T extends string> = Record<T, string>

export type MotionTokens = {
  duration: MotionTokenScale<
    'instant' | 'fast' | 'base' | 'slow' | 'panel' | 'route'
  >
  easing: MotionTokenScale<
    'linear' | 'standard' | 'emphasized' | 'decelerate' | 'accelerate'
  >
  distance: MotionTokenScale<'none' | 'xs' | 'sm' | 'md' | 'lg'>
  stagger: MotionTokenScale<'none' | 'tight' | 'base' | 'loose'>
  intensity: MotionTokenScale<'subtle' | 'standard' | 'expressive'>
}

export type MotionStyleState = {
  opacity?: string
  transform?: string
  filter?: string
}

export type MotionPresetDefinition = {
  name: MotionPresetName
  duration: string
  easing: string
  delay?: string
  stagger?: string
  from: MotionStyleState
  to: MotionStyleState
  leaveFrom?: MotionStyleState
  leaveTo?: MotionStyleState
}

export type MotionBudgetConfig = {
  maxStaggerItems: number
  maxAnimatedNodesPerViewport: number
  disableScrollEffectsBelowFps: number
  disableBlurOnLowPower: boolean
  disableParallaxOnTouch: boolean
  preferCssWhenPossible: boolean
  allowedProperties: readonly (keyof MotionStyleState)[]
}

export type MotionRecipeDefinition = {
  name: MotionRecipeName
  intent: string
  preset: MotionPresetName
  durationClass: 'instant' | 'fast' | 'base' | 'slow' | 'panel' | 'route'
  allowedTargets: readonly string[]
  reducedFallback: 'terminal' | 'opacity-only'
  disabledFallback: 'terminal'
  maxItemCount?: number
  budget?: Partial<MotionBudgetConfig>
}

export type MotionOptions = {
  name?: MotionPresetName
  duration?: string | number
  delay?: string | number
  easing?: string
  index?: number
  disabled?: boolean
  once?: boolean
  immediate?: boolean
  budget?: Partial<MotionBudgetConfig>
}

export type MotionDirectiveValue =
  | MotionPresetName
  | MotionOptions
  | false
  | null
  | undefined

export type MotionPhase = 'enter' | 'leave'

export type MotionRunOptions = MotionOptions & {
  name: MotionPresetName
  phase?: MotionPhase
  onFinish?: () => void
}

export type MotionRuntimeControls = {
  cancel: () => void
  finish: () => void
}

export type MotionPluginConfig = {
  defaultPreset?: MotionPresetName
  disabled?: boolean
  budget?: Partial<MotionBudgetConfig>
}
