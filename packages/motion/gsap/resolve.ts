import { unref } from 'vue'
import { getMotionPreset, getMotionPresetBundle } from '../presets'
import type { Ref } from 'vue'
import type { MotionPresetName, MotionStyleState } from '../types'

export type MotionTarget =
  | Element
  | Element[]
  | string
  | Ref<Element | Element[] | string | undefined | null>
  | undefined
  | null

export const resolveMotionTarget = (target: MotionTarget) => unref(target)

// GSAP uses seconds for time-based options. The motion preset token scale
// stores durations in milliseconds; convert to seconds at the boundary.
export const millisecondsToSeconds = (value: string | number | undefined) => {
  if (typeof value === 'number') return value / 1000
  if (!value) return 0.22

  const match = /^(-?\d+(?:\.\d+)?)(ms|s)?$/u.exec(value.trim())
  if (!match) return 0.22

  const amount = Number(match[1])
  return match[2] === 's' ? amount : amount / 1000
}

// Normalize a scrub input to GSAP's seconds convention. Accepts:
// - boolean: passed through (true = real-time, false = no scrub).
// - number: interpreted as seconds. Negative or NaN falls back to true.
// - string with 'ms' or 's' suffix: parsed and converted.
// - undefined: defaults to true (smooth real-time).
export const toGsapScrubSeconds = (
  value: boolean | number | string | undefined,
): boolean | number => {
  if (value === undefined || value === true || value === false) {
    return value ?? true
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : true
  }
  const parsed = millisecondsToSeconds(value)
  return Number.isFinite(parsed) ? parsed : true
}

// Map a CSS-style cubic-bezier easing to the closest GSAP named ease.
// M3 4-pattern mapping:
//   emphasized (0.2, 0, 0, 1)        -> power3.out   (snappy entry, hero)
//   standard   (0.4, 0, 0.2, 1)      -> power2.inOut (smooth default)
//   decel      (0, 0, 0.2, 1)        -> power2.out   (gentle exit)
//   accel      (0.4, 0, 1, 1)        -> power2.in    (sharp entry)
export const resolveGsapEase = (easing: string): string => {
  if (easing.includes('0.2, 0, 0, 1') || easing.includes('0.16, 1, 0.3, 1')) {
    return 'power3.out'
  }
  if (easing.includes('0.4, 0, 0.2, 1')) return 'power2.inOut'
  if (easing.includes('0, 0, 0.2, 1')) return 'power2.out'
  if (easing.includes('0.4, 0, 1, 1')) return 'power2.in'
  return 'power1.inOut'
}

export const getGsapPresetVars = (
  name: MotionPresetName,
  duration?: string | number,
) => {
  const preset = getMotionPreset(name)
  const bundle = getMotionPresetBundle(name)
  return {
    duration: millisecondsToSeconds(duration || bundle.duration),
    ease: resolveGsapEase(bundle.easing),
    from: preset.from as Record<string, string>,
    to: preset.to as Record<string, string>,
  }
}

export const sanitizeGsapVars = (state: MotionStyleState) =>
  Object.fromEntries(
    Object.entries(state).filter(([, value]) => value !== undefined),
  )
