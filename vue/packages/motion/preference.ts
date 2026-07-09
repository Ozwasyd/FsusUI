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
    document.documentElement.dataset.fsusMotion as MotionMode
  )
    ? 'system'
    : (document.documentElement.dataset.fsusMotion as MotionMode)

export const getPrefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Read the disabled state independently of the reduced-motion preference.
// A component (or its consumer) can disable motion without the user
// having `prefers-reduced-motion: reduce` set, and a user preference
// can reduce motion without any component having been disabled. The
// two are tracked as separate axes so each can be reasoned about
// (and asserted against) in isolation.
export const isMotionDisabled = (disabled = false): boolean => {
  if (disabled) return true
  return getRootMotionMode() === 'disabled'
}

// Read the reduced-motion preference independently of the disabled
// flag. A user setting `prefers-reduced-motion: reduce` (or the root
// being set to 'reduced') reports `reduced: true` here even when no
// component has been explicitly disabled.
export const isMotionReduced = (): boolean => {
  const mode = getRootMotionMode()
  if (mode === 'reduced') return true
  if (mode !== 'system') return false
  return getPrefersReducedMotion()
}

export const resolveMotionPreference = (
  disabled = false
): MotionPreferenceSnapshot => {
  const mode = getRootMotionMode()
  const prefersReduced = getPrefersReducedMotion()
  const motionDisabled = isMotionDisabled(disabled)
  const reduced = motionDisabled || isMotionReduced()

  return {
    mode,
    prefersReduced,
    reduced,
    disabled: motionDisabled,
  }
}

export const resolveMotionScrollBehavior = (
  behavior: ScrollBehavior = 'smooth',
  disabled = false
): ScrollBehavior => (isMotionReduced() || isMotionDisabled(disabled) ? 'auto' : behavior)
