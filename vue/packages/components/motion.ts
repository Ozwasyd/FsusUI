import { computed, unref } from 'vue'
import { definePropType } from '@element-plus/utils'
import { resolveMotionPresetName } from '../motion/presets'
import type { ComputedRef, MaybeRef } from 'vue'
import type { MotionPresetName } from '../motion/types'

export type ComponentMotion = string | false | undefined

export const componentMotionProps = {
  /**
   * @description semantic motion preset for the component; `false` disables component motion. Legacy preset names are resolved to intent-based equivalents via `motionPresetAliases`.
   */
  motion: {
    type: definePropType<ComponentMotion>([String, Boolean]),
    default: undefined,
  },
} as const

// Resolve a component-level motion value to its intent-based preset name.
// Returns `false` for the explicit disable switch, the resolved intent name
// for a string input (legacy names resolve through `motionPresetAliases`),
// or the fallback when no motion is provided. The fallback is itself
// resolved so callers can pass legacy fallbacks too.
export const resolveComponentMotionPreset = (
  motion: ComponentMotion,
  fallback?: string,
): string | false | undefined => {
  if (motion === false) return false
  if (motion === undefined) {
    return fallback === undefined
      ? undefined
      : resolveMotionPresetName(fallback)
  }
  if (typeof motion === 'string') return resolveMotionPresetName(motion)
  return fallback === undefined
    ? undefined
    : resolveMotionPresetName(fallback)
}

// Normalize a map of preset-to-transition-name by resolving every key
// through `motionPresetAliases`. Last-wins if two keys resolve to the
// same intent; the resolved key is what callers should prefer to use.
const resolvePresetTransitions = (
  presetTransitions: Record<string, string>,
): Record<string, string> => {
  const resolved: Record<string, string> = {}
  for (const [key, value] of Object.entries(presetTransitions)) {
    resolved[resolveMotionPresetName(key)] = value
  }
  return resolved
}

export const resolveComponentMotionAttrs = (
  motion: ComponentMotion,
  fallback?: string,
) => {
  const preset = resolveComponentMotionPreset(motion, fallback)

  return {
    'data-fsus-motion-preset':
      typeof preset === 'string' ? preset : undefined,
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

// Resolve a component-level motion value to a Vue Transition name. The
// preset map is normalized through `motionPresetAliases` so that maps
// keyed by either legacy or intent names both resolve correctly. The
// safe-default behavior is unchanged: `false` disables the transition,
// unknown values fall back to the caller-supplied name.
export const resolveComponentTransitionName = (
  motion: ComponentMotion,
  fallback: string,
  presetTransitions: Record<string, string>,
) => {
  if (motion === false) return ''
  if (typeof motion !== 'string') return fallback

  const resolvedMap = resolvePresetTransitions(presetTransitions)
  const resolvedName = resolveMotionPresetName(motion)
  return resolvedMap[resolvedName] ?? fallback
}

export type { MotionPresetName }
