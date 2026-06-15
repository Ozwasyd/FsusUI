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

export const millisecondsToSeconds = (value: string | number | undefined) => {
  if (typeof value === 'number') return value / 1000
  if (!value) return 0.22

  const match = /^(-?\d+(?:\.\d+)?)(ms|s)?$/u.exec(value.trim())
  if (!match) return 0.22

  const amount = Number(match[1])
  return match[2] === 's' ? amount : amount / 1000
}

export const resolveGsapEase = (easing: string) => {
  if (easing.includes('0.2, 0, 0, 1') || easing.includes('0.16, 1, 0.3, 1')) {
    return 'power3.out'
  }
  if (easing.includes('0, 0, 0.2, 1')) return 'power2.out'
  if (easing.includes('0.4, 0, 1, 1')) return 'power2.in'
  return 'power1.out'
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
