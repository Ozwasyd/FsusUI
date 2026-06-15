import { motionCssVars, motionTokens } from '../tokens'
import {
  motionLegacyPresetNames,
  motionPresetNames,
} from '../types'
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
  transform: '',
  filter: '',
}
const opacityTerminal: MotionStyleState = { opacity: '1' }
const quietSurfaces = [
  'ordinary-content',
  'reading-surface',
  'list-table-surface',
] as const
const overlaySurfaces = ['overlay-sheet-dialog-surface'] as const
const receiptSurfaces = ['toast-banner-surface', 'admin-operation-surface'] as const

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
} as const satisfies Record<MotionLegacyPresetName, MotionPresetName>

export const motionPresets: Record<MotionPresetName, MotionPresetDefinition> = {
  'surface-settle': {
    name: 'surface-settle',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    surfaces: quietSurfaces,
    from: { opacity: '0.94' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.94' },
  },
  'paper-settle': {
    name: 'paper-settle',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    surfaces: ['ordinary-content', 'admin-operation-surface'],
    forbiddenSurfaces: ['reading-surface'],
    from: {
      opacity: '0.96',
      transform: `translate3d(0, ${motionCssVars.distance.xs ?? '4px'}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0.96',
      transform: `translate3d(0, ${motionCssVars.distance.xs ?? '4px'}, 0)`,
    },
  },
  'route-settle': {
    name: 'route-settle',
    duration: motionCssVars.duration.route,
    easing: motionCssVars.easing.standard,
    surfaces: ['route-surface', 'reading-surface'],
    from: { opacity: '0.96' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.96' },
  },
  'dialog-settle': {
    name: 'dialog-settle',
    duration: motionCssVars.duration.panel,
    easing: motionCssVars.easing.emphasized,
    surfaces: overlaySurfaces,
    forbiddenSurfaces: ['ordinary-content', 'reading-surface'],
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.xs ?? '4px'}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.xs ?? '4px'}, 0)`,
    },
  },
  'sheet-settle': {
    name: 'sheet-settle',
    duration: motionCssVars.duration.panel,
    easing: motionCssVars.easing.emphasized,
    surfaces: ['overlay-sheet-dialog-surface', 'mobile-dock-surface'],
    forbiddenSurfaces: ['reading-surface', 'ordinary-content'],
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.md}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.md}, 0)`,
    },
  },
  'overlay-settle': {
    name: 'overlay-settle',
    duration: motionCssVars.duration.route,
    easing: motionCssVars.easing.standard,
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
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    surfaces: ['mobile-dock-surface'],
    forbiddenSurfaces: ['reading-surface', 'ordinary-content'],
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.sm}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.sm}, 0)`,
    },
  },
  'toast-receipt': {
    name: 'toast-receipt',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.standard,
    surfaces: receiptSurfaces,
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.xs ?? '4px'}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: { opacity: '0', transform: none },
  },
  'banner-receipt': {
    name: 'banner-receipt',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.standard,
    surfaces: receiptSurfaces,
    from: { opacity: '0.92' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.92' },
  },
  'lightbox-focus': {
    name: 'lightbox-focus',
    duration: motionCssVars.duration.panel,
    easing: motionCssVars.easing.emphasized,
    surfaces: ['media-preview-surface', 'overlay-sheet-dialog-surface'],
    forbiddenSurfaces: ['ordinary-content'],
    from: { opacity: '0', transform: 'scale(0.985)' },
    to: { opacity: '1', transform: 'scale(1)' },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: 'scale(1)' },
    leaveTo: { opacity: '0', transform: 'scale(0.99)' },
  },
  'index-list-settle': {
    name: 'index-list-settle',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    stagger: motionCssVars.stagger.tight,
    surfaces: ['list-table-surface', 'admin-operation-surface'],
    forbiddenSurfaces: ['reading-surface'],
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.xs ?? '4px'}, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.xs ?? '4px'}, 0)`,
    },
  },
  'reading-title-settle': {
    name: 'reading-title-settle',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    surfaces: ['reading-surface'],
    from: { opacity: '0.92' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.92' },
  },
  'media-develop': {
    name: 'media-develop',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    surfaces: ['reading-surface', 'media-preview-surface'],
    from: { opacity: '0', filter: 'saturate(0.92)' },
    to: { opacity: '1', filter: '' },
    reduced: terminal,
    leaveFrom: { opacity: '1', filter: '' },
    leaveTo: { opacity: '0', filter: 'saturate(0.92)' },
  },
  'media-focus': {
    name: 'media-focus',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.standard,
    surfaces: ['reading-surface', 'media-preview-surface'],
    from: { opacity: '0.96' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.96' },
  },
  'code-ready': {
    name: 'code-ready',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.standard,
    surfaces: ['reading-surface'],
    from: { opacity: '0.9' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.9' },
  },
  'grid-settle': {
    name: 'grid-settle',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    surfaces: ['reading-surface', 'list-table-surface'],
    from: { opacity: '0.94' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.94' },
  },
  'quote-line': {
    name: 'quote-line',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.standard,
    surfaces: ['reading-surface'],
    from: { opacity: '0.88' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.88' },
  },
  'toc-anchor': {
    name: 'toc-anchor',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.standard,
    surfaces: ['reading-surface'],
    from: { opacity: '0.86' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.86' },
  },
  'anchor-mark': {
    name: 'anchor-mark',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.standard,
    surfaces: ['reading-surface'],
    from: { opacity: '0.82' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0.82' },
  },
  'reading-progress-transform': {
    name: 'reading-progress-transform',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.linear ?? motionTokens.easing.linear,
    surfaces: ['reading-surface'],
    from: { transform: 'scaleX(0)' },
    to: { transform: 'scaleX(1)' },
    reduced: { opacity: '1', transform: '' },
    leaveFrom: { transform: 'scaleX(1)' },
    leaveTo: { transform: 'scaleX(0)' },
  },
  'copy-confirm': {
    name: 'copy-confirm',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.standard,
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
