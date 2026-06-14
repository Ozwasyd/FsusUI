import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'
import {
  getPrefersReducedMotion,
  getRootMotionMode,
  resolveMotionPreference,
  resolveMotionScrollBehavior,
} from '../preference'
import type { MotionMode } from '../preference'

export type UseMotionPreferenceOptions = {
  disabled?: boolean
}

export const useMotionPreference = (
  options: UseMotionPreferenceOptions = {},
) => {
  const prefersReduced = ref(getPrefersReducedMotion())
  const mode = ref<MotionMode>(getRootMotionMode())

  const media =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : undefined

  const sync = () => {
    prefersReduced.value = getPrefersReducedMotion()
    mode.value = getRootMotionMode()
  }

  if (media) {
    media.addEventListener?.('change', sync)
    media.addListener?.(sync)
  }

  const snapshot = computed(() => resolveMotionPreference(options.disabled))

  const controls = {
    mode,
    prefersReduced,
    reduced: computed(() => snapshot.value.reduced),
    disabled: computed(() => snapshot.value.disabled),
    scrollBehavior: computed(() =>
      resolveMotionScrollBehavior('smooth', options.disabled),
    ),
    sync,
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      media?.removeEventListener?.('change', sync)
      media?.removeListener?.(sync)
    })
  }

  return controls
}

export default useMotionPreference
