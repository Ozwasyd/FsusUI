import { computed, getCurrentInstance } from 'vue'
import memoOne from 'memoize-one'

import type { VirtualizedProps } from '../props'

const MAX_MEMOIZED_STYLE_CACHE = 64

const memoizeWithLimit = <T extends (...args: any[]) => any>(fn: T) => {
  const cache: Array<{
    args: Parameters<T>
    value: ReturnType<T>
  }> = []
  return ((...args: Parameters<T>) => {
    const cachedIndex = cache.findIndex(
      (entry) =>
        entry.args.length === args.length &&
        entry.args.every((value, index) => Object.is(value, args[index])),
    )
    if (cachedIndex >= 0) {
      const [cached] = cache.splice(cachedIndex, 1)
      cache.push(cached)
      return cached.value
    }

    const value = fn(...args)
    cache.push({ args, value })
    if (cache.length > MAX_MEMOIZED_STYLE_CACHE) cache.shift()
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
