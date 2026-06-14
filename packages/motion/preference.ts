export type MotionMode = 'system' | 'enabled' | 'reduced' | 'disabled'

export type MotionPreferenceSnapshot = {
  mode: MotionMode
  prefersReduced: boolean
  reduced: boolean
  disabled: boolean
}

const motionModes = ['system', 'enabled', 'reduced', 'disabled'] as const

export const getRootMotionMode = (): MotionMode =>
  typeof document === 'undefined' ||
  !motionModes.includes(
    document.documentElement.dataset.fsusMotion as MotionMode,
  )
    ? 'system'
    : (document.documentElement.dataset.fsusMotion as MotionMode)

export const getPrefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const resolveMotionPreference = (
  disabled = false,
): MotionPreferenceSnapshot => {
  const mode = getRootMotionMode()
  const prefersReduced = getPrefersReducedMotion()
  const motionDisabled = disabled || mode === 'disabled'
  const reduced = motionDisabled || mode === 'reduced' || (
    mode === 'system' && prefersReduced
  )

  return {
    mode,
    prefersReduced,
    reduced,
    disabled: motionDisabled,
  }
}

export const isMotionReduced = (disabled = false) =>
  resolveMotionPreference(disabled).reduced

export const resolveMotionScrollBehavior = (
  behavior: ScrollBehavior = 'smooth',
  disabled = false,
): ScrollBehavior => (isMotionReduced(disabled) ? 'auto' : behavior)
