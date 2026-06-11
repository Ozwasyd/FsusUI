import { computed, unref } from 'vue'
import { definePropType } from '@element-plus/utils'
import type { ComputedRef, MaybeRef } from 'vue'

export type ComponentMotion = string | false | undefined

export const componentMotionProps = {
  /**
   * @description semantic motion preset for the component; `false` disables component motion
   */
  motion: {
    type: definePropType<ComponentMotion>([String, Boolean]),
    default: undefined,
  },
} as const

export const resolveComponentMotionPreset = (
  motion: ComponentMotion,
  fallback?: string,
) => (motion === undefined ? fallback : motion)

export const resolveComponentMotionAttrs = (
  motion: ComponentMotion,
  fallback?: string,
) => {
  const preset = resolveComponentMotionPreset(motion, fallback)

  return {
    'data-fsus-motion-preset': typeof preset === 'string' ? preset : undefined,
    'data-fsus-motion-disabled': preset === false ? 'true' : undefined,
  }
}

export const useComponentMotionAttrs = (
  motion: MaybeRef<ComponentMotion>,
  fallback?: MaybeRef<string | undefined>,
) =>
  computed(() =>
    resolveComponentMotionAttrs(unref(motion), unref(fallback)),
  ) as ComputedRef<ReturnType<typeof resolveComponentMotionAttrs>>

export const resolveComponentTransitionName = (
  motion: ComponentMotion,
  fallback: string,
  presetTransitions: Record<string, string>,
) => {
  if (motion === false) return ''
  if (typeof motion === 'string') return presetTransitions[motion] || fallback
  return fallback
}
