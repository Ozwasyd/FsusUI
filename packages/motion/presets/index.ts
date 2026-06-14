import { motionCssVars, motionTokens } from '../tokens'
import { motionPresetNames } from '../types'
import type {
  MotionPresetDefinition,
  MotionPresetName,
  MotionSurfaceCategory,
  MotionStyleState,
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

export const motionPresetAliases = {
  'fade-in': 'surface-settle',
  'fade-up': 'paper-settle',
  'route-fade': 'route-settle',
  'scale-fade': 'dialog-settle',
  'slide-up': 'sheet-settle',
  'list-stagger': 'index-list-settle',
} as const satisfies Partial<Record<MotionPresetName, MotionPresetName>>

export const motionPresets: Record<MotionPresetName, MotionPresetDefinition> = {
  'fade-in': {
    name: 'fade-in',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    surfaces: ['ordinary-content', 'admin-operation-surface'],
    forbiddenSurfaces: ['reading-surface'],
    from: { opacity: '0' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0' },
  },
  'fade-up': {
    name: 'fade-up',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.decelerate ?? motionTokens.easing.decelerate,
    surfaces: ['ordinary-content', 'media-preview-surface'],
    forbiddenSurfaces: ['reading-surface', 'list-table-surface'],
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
  'fade-down': {
    name: 'fade-down',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    surfaces: ['overlay-sheet-dialog-surface'],
    forbiddenSurfaces: ['reading-surface'],
    from: {
      opacity: '0',
      transform: `translate3d(0, calc(${motionCssVars.distance.sm} * -1), 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, calc(${motionCssVars.distance.sm} * -1), 0)`,
    },
  },
  'fade-left': {
    name: 'fade-left',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    surfaces: ['ordinary-content'],
    forbiddenSurfaces: ['reading-surface'],
    from: {
      opacity: '0',
      transform: `translate3d(${motionCssVars.distance.sm}, 0, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(${motionCssVars.distance.sm}, 0, 0)`,
    },
  },
  'fade-right': {
    name: 'fade-right',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    surfaces: ['ordinary-content'],
    forbiddenSurfaces: ['reading-surface'],
    from: {
      opacity: '0',
      transform: `translate3d(calc(${motionCssVars.distance.sm} * -1), 0, 0)`,
    },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(calc(${motionCssVars.distance.sm} * -1), 0, 0)`,
    },
  },
  'scale-fade': {
    name: 'scale-fade',
    duration: motionCssVars.duration.panel,
    easing: motionCssVars.easing.emphasized,
    surfaces: ['overlay-sheet-dialog-surface', 'media-preview-surface'],
    forbiddenSurfaces: ['ordinary-content', 'reading-surface'],
    from: { opacity: '0', transform: 'scale(0.96)' },
    to: { opacity: '1', transform: 'scale(1)' },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: 'scale(1)' },
    leaveTo: { opacity: '0', transform: 'scale(0.98)' },
  },
  'slide-left': {
    name: 'slide-left',
    duration: motionCssVars.duration.panel,
    easing: motionCssVars.easing.emphasized,
    surfaces: ['overlay-sheet-dialog-surface'],
    forbiddenSurfaces: ['reading-surface', 'ordinary-content'],
    from: { transform: 'translate3d(100%, 0, 0)' },
    to: { transform: none },
    reduced: terminal,
    leaveFrom: { transform: none },
    leaveTo: { transform: 'translate3d(100%, 0, 0)' },
  },
  'slide-right': {
    name: 'slide-right',
    duration: motionCssVars.duration.panel,
    easing: motionCssVars.easing.emphasized,
    surfaces: ['overlay-sheet-dialog-surface'],
    forbiddenSurfaces: ['reading-surface', 'ordinary-content'],
    from: { transform: 'translate3d(-100%, 0, 0)' },
    to: { transform: none },
    reduced: terminal,
    leaveFrom: { transform: none },
    leaveTo: { transform: 'translate3d(-100%, 0, 0)' },
  },
  'slide-up': {
    name: 'slide-up',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.emphasized,
    surfaces: ['overlay-sheet-dialog-surface', 'mobile-dock-surface'],
    forbiddenSurfaces: ['reading-surface', 'ordinary-content'],
    from: { transform: 'translate3d(0, 100%, 0)' },
    to: { transform: none },
    reduced: terminal,
    leaveFrom: { transform: none },
    leaveTo: { transform: 'translate3d(0, 100%, 0)' },
  },
  'list-stagger': {
    name: 'list-stagger',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    stagger: motionCssVars.stagger.base,
    surfaces: ['list-table-surface'],
    forbiddenSurfaces: ['reading-surface'],
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
  'route-fade': {
    name: 'route-fade',
    duration: motionCssVars.duration.route,
    easing: motionCssVars.easing.standard,
    surfaces: ['route-surface'],
    from: { opacity: '0' },
    to: { opacity: '1' },
    reduced: opacityTerminal,
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0' },
  },
  'card-hover': {
    name: 'card-hover',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.standard,
    surfaces: ['media-preview-surface', 'admin-operation-surface'],
    forbiddenSurfaces: ['reading-surface'],
    from: { opacity: '0.92', transform: 'translate3d(0, 2px, 0)' },
    to: { opacity: '1', transform: none },
    reduced: terminal,
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: { opacity: '0.92', transform: 'translate3d(0, 2px, 0)' },
  },
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
}

export const isMotionPresetName = (value: unknown): value is MotionPresetName =>
  motionPresetNames.includes(value as MotionPresetName)

export const resolveMotionPresetName = (
  value: unknown,
  fallback: MotionPresetName = 'fade-in',
): MotionPresetName => (isMotionPresetName(value) ? value : fallback)

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
