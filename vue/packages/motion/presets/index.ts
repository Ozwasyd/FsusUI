import { motionCssVars, motionTokens } from '../tokens'
import { motionLegacyPresetNames, motionPresetNames } from '../types'
import type {
  MotionLegacyPresetName,
  MotionPresetDefinition,
  MotionPresetName,
  MotionStyleState,
  MotionSurfaceCategory,
} from '../types'

const none = 'translate3d(0, 0, 0)'
const terminal: MotionStyleState = {
  opacity: '1',
  transform: 'none',
  filter: 'none',
}
const opacityTerminal: MotionStyleState = { opacity: '1' }
const quietSurfaces = [
  'ordinary-content',
  'reading-surface',
  'list-table-surface',
] as const
const overlaySurfaces = ['overlay-sheet-dialog-surface'] as const
const receiptSurfaces = [
  'toast-banner-surface',
  'admin-operation-surface',
] as const

// Legacy 33-name vocabulary is collapsed to 21 intent-based effects.
// Each legacy name points to the intent preset that best matches its
// visual semantics. New code MUST use intent names; legacy lookups are
// routed through `resolveMotionPresetName`.
export const motionPresetAliases = {
  'fade-in': 'surface-settle',
  'fade-up': 'paper-settle',
  'fade-down': 'paper-settle',
  'fade-left': 'paper-settle',
  'fade-right': 'paper-settle',
  'scale-fade': 'dialog-settle',
  'slide-up': 'sheet-settle',
  'slide-left': 'sheet-settle',
  'slide-right': 'sheet-settle',
  'list-stagger': 'index-list-settle',
  'route-fade': 'route-settle',
  'card-hover': 'paper-settle',
  // zoom-in-* overlay/menu/popover transitions
  'zoom-in-center': 'surface-settle',
  'zoom-in-top': 'sheet-settle',
  'zoom-in-bottom': 'sheet-settle',
  'zoom-in-left': 'sheet-settle',
  'el-zoom-in-center': 'surface-settle',
  'el-zoom-in-top': 'sheet-settle',
  'el-zoom-in-bottom': 'sheet-settle',
  'el-zoom-in-left': 'sheet-settle',
  // generic fade / collapse / list
  'el-fade-in-linear': 'surface-settle',
  'el-fade-in': 'surface-settle',
  'collapse-transition': 'list-settle',
  list: 'list-settle',
  'list-inline': 'list-settle',
} as const satisfies Record<MotionLegacyPresetName, MotionPresetName>

// Each preset picks a pattern + tier from the M3 4×2 scale. The runtime
// resolves the bundle (`duration`, `easing`, `distance`, `stagger`,
// `intensity`) from `motionTokens.patterns[pattern][tier]` so the 5-axis
// concern no longer leaks into the preset layer.
export const motionPresets: Record<MotionPresetName, MotionPresetDefinition> = {
  'surface-settle': {
    name: 'surface-settle',
    pattern: 'standard',
    tier: 'short',
    surfaces: quietSurfaces,
    from: { opacity: '0.94' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.94' },
  },
  'paper-settle': {
    name: 'paper-settle',
    pattern: 'standard',
    tier: 'short',
    surfaces: ['ordinary-content', 'admin-operation-surface'],
    forbiddenSurfaces: ['reading-surface'],
    from: {
      opacity: '0.96',
      transform: `translate3d(0, ${motionCssVars.patterns.standard.short.distance}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0.96',
      transform: `translate3d(0, ${motionCssVars.patterns.standard.short.distance}, 0)`,
    },
  },
  'route-settle': {
    name: 'route-settle',
    pattern: 'decel',
    tier: 'short',
    surfaces: ['route-surface', 'reading-surface'],
    from: { opacity: '0.72', filter: 'none' },
    to: { opacity: '1', filter: 'none' },
    reduced: terminal,
    leaveFrom: { opacity: '1', filter: 'none' },
    leaveTo: { opacity: '0.72', filter: 'none' },
  },
  'ownership-transfer-snapshot': {
    name: 'ownership-transfer-snapshot',
    pattern: 'decel',
    tier: 'long',
    surfaces: ['ownership-transfer-surface', 'route-surface'],
    from: { opacity: '0' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0' },
  },
  'dialog-settle': {
    name: 'dialog-settle',
    pattern: 'emphasized',
    tier: 'short',
    surfaces: overlaySurfaces,
    forbiddenSurfaces: ['ordinary-content', 'reading-surface'],
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.emphasized.short.distance}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.emphasized.short.distance}, 0)`,
    },
  },
  'sheet-settle': {
    name: 'sheet-settle',
    pattern: 'emphasized',
    tier: 'long',
    surfaces: ['overlay-sheet-dialog-surface', 'mobile-dock-surface'],
    forbiddenSurfaces: ['reading-surface', 'ordinary-content'],
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.emphasized.long.distance}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.emphasized.long.distance}, 0)`,
    },
  },
  'overlay-settle': {
    name: 'overlay-settle',
    pattern: 'decel',
    tier: 'long',
    surfaces: ['overlay-sheet-dialog-surface'],
    forbiddenSurfaces: ['reading-surface', 'ordinary-content'],
    from: { opacity: '0' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0' },
  },
  'dock-settle': {
    name: 'dock-settle',
    pattern: 'standard',
    tier: 'short',
    surfaces: ['mobile-dock-surface'],
    forbiddenSurfaces: ['reading-surface', 'ordinary-content'],
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.standard.short.distance}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.standard.short.distance}, 0)`,
    },
  },
  'toast-receipt': {
    name: 'toast-receipt',
    pattern: 'accel',
    tier: 'short',
    surfaces: receiptSurfaces,
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.accel.short.distance}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: { opacity: '0', transform: none },
  },
  'banner-receipt': {
    name: 'banner-receipt',
    pattern: 'accel',
    tier: 'short',
    surfaces: receiptSurfaces,
    from: { opacity: '0.92' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.92' },
  },
  'lightbox-focus': {
    name: 'lightbox-focus',
    pattern: 'emphasized',
    tier: 'long',
    surfaces: ['media-preview-surface', 'overlay-sheet-dialog-surface'],
    forbiddenSurfaces: ['ordinary-content'],
    from: { opacity: '0', transform: 'scale(0.985)' },
    to: { opacity: '1', transform: 'scale(1)' },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: 'scale(1)' },
    leaveTo: { opacity: '0', transform: 'scale(0.99)' },
  },
  'list-settle': {
    name: 'list-settle',
    pattern: 'standard',
    tier: 'short',
    surfaces: ['list-table-surface', 'admin-operation-surface'],
    forbiddenSurfaces: ['reading-surface'],
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.standard.short.distance}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.standard.short.distance}, 0)`,
    },
  },
  'index-list-settle': {
    name: 'index-list-settle',
    pattern: 'standard',
    tier: 'short',
    stagger: motionCssVars.patterns.standard.short.stagger,
    surfaces: ['list-table-surface', 'admin-operation-surface'],
    forbiddenSurfaces: ['reading-surface'],
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.standard.short.distance}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.patterns.standard.short.distance}, 0)`,
    },
  },
  'reading-title-settle': {
    name: 'reading-title-settle',
    pattern: 'standard',
    tier: 'long',
    surfaces: ['reading-surface'],
    from: { opacity: '0.92' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.92' },
  },
  'media-develop': {
    name: 'media-develop',
    pattern: 'standard',
    tier: 'long',
    surfaces: ['reading-surface', 'media-preview-surface'],
    from: { opacity: '0', filter: 'none' },
    to: { opacity: '1', filter: 'none' },
    reduced: terminal,
    leaveFrom: { opacity: '1', filter: 'none' },
    leaveTo: { opacity: '0', filter: 'none' },
  },
  'media-focus': {
    name: 'media-focus',
    pattern: 'standard',
    tier: 'short',
    surfaces: ['reading-surface', 'media-preview-surface'],
    from: { opacity: '0.96' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.96' },
  },
  'code-ready': {
    name: 'code-ready',
    pattern: 'standard',
    tier: 'short',
    surfaces: ['reading-surface'],
    from: { opacity: '0.9' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.9' },
  },
  'grid-settle': {
    name: 'grid-settle',
    pattern: 'standard',
    tier: 'short',
    surfaces: ['reading-surface', 'list-table-surface'],
    from: { opacity: '0.94' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.94' },
  },
  'quote-line': {
    name: 'quote-line',
    pattern: 'standard',
    tier: 'short',
    surfaces: ['reading-surface'],
    from: { opacity: '0.88' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.88' },
  },
  'toc-anchor': {
    name: 'toc-anchor',
    pattern: 'standard',
    tier: 'short',
    surfaces: ['reading-surface'],
    from: { opacity: '0.86' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.86' },
  },
  'anchor-mark': {
    name: 'anchor-mark',
    pattern: 'standard',
    tier: 'short',
    surfaces: ['reading-surface'],
    from: { opacity: '0.82' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.82' },
  },
  'reading-progress-transform': {
    name: 'reading-progress-transform',
    pattern: 'accel',
    tier: 'short',
    surfaces: ['reading-surface'],
    from: { transform: 'scaleX(0)' },
    to: { transform: 'scaleX(1)' },
    reduced: { opacity: '1', transform: '' },
    leaveFrom: { transform: 'scaleX(1)' },
    leaveTo: { transform: 'scaleX(0)' },
  },
  'copy-confirm': {
    name: 'copy-confirm',
    pattern: 'standard',
    tier: 'short',
    surfaces: ['reading-surface', 'toast-banner-surface'],
    from: { opacity: '0.88' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.88' },
  },
}

export const readingMotionPresetNames = [
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
] as const satisfies readonly MotionPresetName[]

export const readingMotionPolicy = {
  bodyTextAnimatedByDefault: false,
  imageHoverScaleByDefault: false,
  codeBlockMovesOnReady: false,
  tocUsesTransformByDefault: false,
  anchorUsesTransformByDefault: false,
  copyFeedbackSurface: 'toolbar-control',
} as const

export const isMotionPresetName = (value: unknown): value is MotionPresetName =>
  motionPresetNames.includes(value as MotionPresetName)

export const isMotionLegacyPresetName = (
  value: unknown,
): value is MotionLegacyPresetName =>
  motionLegacyPresetNames.includes(value as MotionLegacyPresetName)

export const resolveMotionPresetName = (
  value: unknown,
  fallback: MotionPresetName = 'surface-settle',
): MotionPresetName => {
  if (isMotionPresetName(value)) return value
  if (isMotionLegacyPresetName(value)) return motionPresetAliases[value]
  return fallback
}

export const getMotionPreset = (name: unknown): MotionPresetDefinition =>
  motionPresets[resolveMotionPresetName(name)]

export const getMotionPresetBundle = (name: unknown) => {
  const preset = getMotionPreset(name)
  return motionTokens.patterns[preset.pattern][preset.tier]
}

export const getMotionPresetSurfaces = (name: unknown) => {
  const preset = getMotionPreset(name)

  return {
    allowed: preset.surfaces,
    forbidden: preset.forbiddenSurfaces ?? [],
  }
}

export const isMotionPresetAllowedOnSurface = (
  name: unknown,
  surface: MotionSurfaceCategory,
) => {
  const { allowed, forbidden } = getMotionPresetSurfaces(name)

  return !forbidden.includes(surface) && allowed.includes(surface)
}
