import type { MotionTokens } from '../types'

export const motionTokens: MotionTokens = {
  duration: {
    instant: '1ms',
    fast: '140ms',
    base: '220ms',
    slow: '320ms',
    panel: '420ms',
    route: '260ms',
  },
  easing: {
    linear: 'linear',
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  distance: {
    none: '0',
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
  },
  stagger: {
    none: '0ms',
    tight: '35ms',
    base: '55ms',
    loose: '85ms',
  },
  intensity: {
    subtle: '0.98',
    standard: '0.96',
    expressive: '0.92',
  },
}

export const motionCssVars = {
  duration: {
    instant: 'var(--fsus-motion-duration-instant, 1ms)',
    fast: 'var(--fsus-motion-control-fast, 140ms)',
    base: 'var(--fsus-motion-control, 220ms)',
    slow: 'var(--fsus-motion-duration-slow, 320ms)',
    panel: 'var(--fsus-motion-panel, 420ms)',
    route: 'var(--fsus-motion-overlay, 260ms)',
  },
  easing: {
    linear: 'var(--fsus-motion-linear, linear)',
    standard: 'var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1))',
    emphasized: 'var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1))',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  },
  distance: {
    xs: 'var(--fsus-motion-distance-xs, 4px)',
    sm: 'var(--fsus-motion-distance-sm, 8px)',
    md: 'var(--fsus-motion-distance-md, 16px)',
  },
  stagger: {
    tight: 'var(--fsus-motion-stagger-tight, 35ms)',
    base: 'var(--fsus-motion-stagger, 55ms)',
  },
} as const

export const motionTokenAliases = {
  fast: motionCssVars.duration.fast,
  control: motionCssVars.duration.base,
  panel: motionCssVars.duration.panel,
  overlay: motionCssVars.duration.route,
  route: motionCssVars.duration.route,
  standardEase: motionCssVars.easing.standard,
  emphasizedEase: motionCssVars.easing.emphasized,
} as const
