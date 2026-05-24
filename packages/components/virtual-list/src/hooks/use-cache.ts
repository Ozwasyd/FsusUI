import { computed, getCurrentInstance } from 'vue'
import memoOne from 'memoize-one'

import type { VirtualizedProps } from '../props'

const MAX_MEMOIZED_STYLE_CACHE = 64

const memoizeWithLimit = <T extends (...args: any[]) => any>(fn: T) => {
  const cache = new Map<string, ReturnType<T>>()
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args)
    const cached = cache.get(key)
    if (cached) return cached

    const value = fn(...args)
    cache.set(key, value)
    if (cache.size > MAX_MEMOIZED_STYLE_CACHE) {
      const firstKey = cache.keys().next().value
      if (firstKey) cache.delete(firstKey)
    }
    return value
  }) as T
}

export const useCache = () => {
  const vm = getCurrentInstance()!

  const props = vm.proxy!.$props as VirtualizedProps

  return computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _getItemStyleCache = (_: any, __: any, ___: any) => ({})
    return props.perfMode
      ? memoizeWithLimit(_getItemStyleCache)
      : memoOne(_getItemStyleCache)
  })
}
