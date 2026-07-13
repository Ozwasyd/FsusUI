import type {
  MotionPattern,
  MotionTier,
} from '../tokens'

export type {
  MotionPattern,
  MotionTier,
  MotionTokens,
} from '../tokens'

// Intent-based canonical motion preset vocabulary.
// Replaces the previous 33-name enumeration that mixed generic effect names
// (fade-in, scale-fade, slide-up, …) with intent names (surface-settle,
// dialog-settle, sheet-settle, …). Each entry is an *intent* — what the
// component is doing — not a *mechanism* — how the visual is achieved.
export const motionPresetNames = [
  // Reading/text surfaces — quiet, opacity-led, no translate
  'surface-settle',
  'paper-settle',
  // Routing / page-level — short soft-focus fade-through
  'route-settle',
  'ownership-transfer-snapshot',
  'overlay-settle',
  // Overlay surfaces — dialog/drawer/sheet
  'dialog-settle',
  'sheet-settle',
  'lightbox-focus',
  // Mobile dock
  'dock-settle',
  // Receipt surfaces — toast / banner
  'toast-receipt',
  'banner-receipt',
  // List surfaces — small stagger
  'index-list-settle',
  // Reading body micro-effects
  'reading-title-settle',
  'media-develop',
  'media-focus',
  'code-ready',
  'grid-settle',
  'quote-line',
  'toc-anchor',
  'anchor-mark',
  'reading-progress-transform',
  'copy-confirm',
] as const

export type MotionPresetName = (typeof motionPresetNames)[number]

// Legacy preset names retained as one-release compatibility shims.
// Each entry resolves to an intent-based preset via `motionPresetAliases`.
// Documented as deprecated; new code should use intent names directly.
export const motionLegacyPresetNames = [
  'fade-in',
  'fade-up',
  'fade-down',
  'fade-left',
  'fade-right',
  'scale-fade',
  'slide-up',
  'slide-left',
  'slide-right',
  'list-stagger',
  'route-fade',
  'card-hover',
] as const

export type MotionLegacyPresetName = (typeof motionLegacyPresetNames)[number]

// Acceptable input shape for motion preset lookups: intent names, legacy
// aliases, or `false`/`undefined` (caller-side disabled).
export type MotionPresetInput =
  | MotionPresetName
  | MotionLegacyPresetName
  | string
  | false
  | null
  | undefined

export const motionSurfaceCategories = [
  'ordinary-content',
  'reading-surface',
  'list-table-surface',
  'admin-operation-surface',
  'overlay-sheet-dialog-surface',
  'mobile-dock-surface',
  'toast-banner-surface',
  'media-preview-surface',
  'route-surface',
  'ownership-transfer-surface',
] as const

export type MotionSurfaceCategory = (typeof motionSurfaceCategories)[number]

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


// Pattern-tier bundle — see tokens/index.ts for the 4×2 matrix.

// Re-exported from tokens to keep a single canonical location.

export type MotionStyleState = {
  opacity?: string
  transform?: string
  filter?: string
}

export type MotionPresetDefinition = {
  name: MotionPresetName
  pattern: MotionPattern
  tier: MotionTier
  delay?: string
  stagger?: string
  surfaces: readonly MotionSurfaceCategory[]
  forbiddenSurfaces?: readonly MotionSurfaceCategory[]
  from: MotionStyleState
  to: MotionStyleState
  reduced: MotionStyleState
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
  pattern: MotionPattern
  tier: MotionTier
  allowedTargets: readonly string[]
  reducedFallback: 'terminal' | 'opacity-only'
  disabledFallback: 'terminal'
  maxItemCount?: number
  budget?: Partial<MotionBudgetConfig>
}

export type MotionOptions = {
  name?: MotionPresetInput
  surface?: MotionSurfaceCategory
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
  | MotionLegacyPresetName
  | MotionOptions
  | false
  | null
  | undefined

export type MotionPhase = 'enter' | 'leave'

export type MotionRunOptions = Omit<MotionOptions, 'name'> & {
  name: MotionPresetInput
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
