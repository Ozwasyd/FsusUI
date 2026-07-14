import { computed, getCurrentInstance } from 'vue'

import type { ComputedRef, CSSProperties } from 'vue'
import type { VirtualizedProps } from '../props'

const MAX_MEMOIZED_STYLE_CACHE = 64

export type StyleCache = Record<string, CSSProperties>
export type StyleCacheGetter = ((...keys: unknown[]) => StyleCache) & {
  clear: () => void
  invalidate: (...keys: unknown[]) => void
  size: () => number
}

export const createStyleCache = (
  limit = MAX_MEMOIZED_STYLE_CACHE,
): StyleCacheGetter => {
  const entries = new Map<string, StyleCache>()
  const keyOf = (keys: unknown[]) =>
    keys.map((key) => `${typeof key}:${String(key)}`).join('|')
  const get = ((...keys: unknown[]) => {
    const key = keyOf(keys)
    const cached = entries.get(key)
    if (cached) {
      entries.delete(key)
      entries.set(key, cached)
      return cached
    }
    const value: StyleCache = {}
    entries.set(key, value)
    if (entries.size > Math.max(1, limit)) {
      const oldest = entries.keys().next().value
      if (oldest !== undefined) entries.delete(oldest)
    }
    return value
  }) as StyleCacheGetter
  get.clear = () => entries.clear()
  get.invalidate = (...keys) => entries.delete(keyOf(keys))
  get.size = () => entries.size
  return get
}

export const resolveVirtualLayerBudget = ({
  configuredBudget,
  devicePixelRatio = 1,
  unitArea,
  pixelBudget = 16_000_000,
}: {
  configuredBudget: number
  devicePixelRatio?: number
  unitArea: number
  pixelBudget?: number
}) =>
  Math.max(
    1,
    Math.min(
      Math.max(1, Math.floor(configuredBudget)),
      Math.floor(
        pixelBudget /
          Math.max(1, unitArea * Math.max(1, devicePixelRatio) ** 2),
      ),
    ),
  )

export const useCache = (): ComputedRef<StyleCacheGetter> => {
  const vm = getCurrentInstance()!
  const props = vm.proxy!.$props as VirtualizedProps
  const cache = createStyleCache()
  return computed(() => {
    props.perfMode
    return cache
  })
}
