export const isClient = typeof window !== 'undefined' && typeof document !== 'undefined'

export const isObject = (val: unknown): val is Record<string, any> =>
  val !== null && typeof val === 'object'

export const isPlainObject = (val: unknown): val is Record<string, unknown> => {
  if (!isObject(val)) return false
  const proto = Object.getPrototypeOf(val)
  return proto === null || proto === Object.prototype
}

export const isFunction = (val: unknown): val is (...args: any[]) => any =>
  typeof val === 'function'

export const isString = (val: unknown): val is string => typeof val === 'string'
export const isNumber = (val: unknown): val is number =>
  typeof val === 'number' && !Number.isNaN(val)
export const isBoolean = (val: unknown): val is boolean => typeof val === 'boolean'
export const isUndefined = (val: unknown): val is undefined => val === undefined
export const isNil = (val: unknown): val is null | undefined => val === null || val === undefined
export const isArray = Array.isArray
export const isPromise = <T = unknown>(val: unknown): val is Promise<T> =>
  isObject(val) && isFunction((val as PromiseLike<T>).then)
export const isElement = (val: unknown): val is Element =>
  typeof Element !== 'undefined' && val instanceof Element

export const hasOwn = (obj: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key)

export const clamp = (val: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, val))

export const ensureArray = <T>(val: T | readonly T[] | null | undefined): T[] => {
  if (isNil(val)) return []
  return Array.isArray(val) ? [...val] : [val as T]
}

export const unique = <T>(arr: readonly T[]): T[] => Array.from(new Set(arr))

export const findLastIndex = <T>(
  arr: readonly T[],
  predicate: (item: T, index: number) => boolean,
): number => {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i]!, i)) return i
  }
  return -1
}

export const getByPath = <T = unknown>(
  obj: unknown,
  path: string | readonly string[],
  fallback?: T,
): T | undefined => {
  if (!isObject(obj)) return fallback
  const segments = isString(path)
    ? path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
    : path
  let cur: any = obj
  for (const seg of segments) {
    if (cur == null) return fallback
    cur = cur[seg]
  }
  return (cur === undefined ? fallback : cur) as T | undefined
}

export const setByPath = (
  obj: Record<string, any>,
  path: string | readonly string[],
  value: unknown,
): void => {
  const segments = isString(path)
    ? path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
    : path
  if (segments.length === 0) return
  let cur: Record<string, any> = obj
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    if (seg === '__proto__' || seg === 'constructor' || seg === 'prototype') return
    if (!isObject(cur[seg])) {
      cur[seg] = /^\d+$/.test(segments[i + 1]!) ? [] : {}
    }
    cur = cur[seg]
  }
  const last = segments[segments.length - 1]!
  if (last === '__proto__' || last === 'constructor' || last === 'prototype') return
  cur[last] = value
}

export const pick = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> => {
  const out = {} as Pick<T, K>
  for (const key of keys) {
    if (key in obj) out[key] = obj[key]
  }
  return out
}

export const omit = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> => {
  const excluded = new Set<PropertyKey>(keys)
  const out = {} as Record<string, any>
  for (const key of Object.keys(obj)) {
    if (!excluded.has(key)) out[key] = obj[key]
  }
  return out as Omit<T, K>
}

export const deepClone = <T>(value: T): T => {
  if (!isObject(value)) return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Fallback for functions/proxies/DOM nodes
    }
  }
  if (value instanceof Date) return new Date(value.getTime()) as T
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as T
  if (Array.isArray(value)) return value.map((item) => deepClone(item)) as T
  const out: Record<string, any> = {}
  for (const key of Object.keys(value)) {
    out[key] = deepClone((value as Record<string, any>)[key])
  }
  return out as T
}

export const deepMerge = <T extends Record<string, any>>(
  target: T,
  ...sources: Array<Record<string, any> | undefined>
): T => {
  const result: Record<string, any> = { ...target }
  for (const source of sources) {
    if (!isPlainObject(source)) continue
    for (const key of Object.keys(source)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
      const next = source[key]
      const prev = result[key]
      result[key] =
        isPlainObject(prev) && isPlainObject(next) ? deepMerge(prev, next) : next
    }
  }
  return result as T
}

export const isEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof RegExp && b instanceof RegExp)
    return a.source === b.source && a.flags === b.flags
  if (!isObject(a) || !isObject(b)) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false
    }
    return true
  }
  const objA = a as Record<string, unknown>
  const objB = b as Record<string, unknown>
  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!hasOwn(objB, key) || !isEqual(objA[key], objB[key])) return false
  }
  return true
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export const escapeHtml = (input: string): string =>
  input.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]!)

export const escapeRegExp = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const kebabCase = (str: string): string =>
  str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()

export const camelCase = (str: string): string =>
  str.replace(/[-_\s]+([a-zA-Z0-9])/g, (_, ch: string) => ch.toUpperCase())

export const addUnit = (value?: string | number, unit = 'px'): string | undefined => {
  if (isNil(value) || value === '') return undefined
  if (isNumber(value) || /^-?\d+(?:\.\d+)?$/.test(String(value).trim())) {
    return `${value}${unit}`
  }
  return String(value)
}

export interface DebouncedFn<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void
  cancel: () => void
  flush: () => void
}

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  wait = 150,
): DebouncedFn<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T> | undefined
  const run = () => {
    if (lastArgs) {
      const args = lastArgs
      lastArgs = undefined
      fn(...args)
    }
  }
  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      run()
    }, wait)
  }) as DebouncedFn<T>
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    lastArgs = undefined
  }
  debounced.flush = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    run()
  }
  return debounced
}

export interface ThrottledFn<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void
  cancel: () => void
}

export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  wait = 100,
): ThrottledFn<T> => {
  let lastTime = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingArgs: Parameters<T> | undefined
  const throttled = ((...args: Parameters<T>) => {
    const now = Date.now()
    const remaining = wait - (now - lastTime)
    if (remaining <= 0) {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      lastTime = now
      fn(...args)
    } else {
      pendingArgs = args
      if (timer === undefined) {
        timer = setTimeout(() => {
          timer = undefined
          lastTime = Date.now()
          if (pendingArgs) {
            const a = pendingArgs
            pendingArgs = undefined
            fn(...a)
          }
        }, remaining)
      }
    }
  }) as ThrottledFn<T>
  throttled.cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pendingArgs = undefined
  }
  return throttled
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

export const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  )

export const getScrollContainer = (el: HTMLElement | null): HTMLElement | Window => {
  if (!isClient || !el) return window
  let parent = el.parentElement
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const { overflow, overflowY, overflowX } = getComputedStyle(parent)
    if (/(auto|scroll|overlay)/.test(`${overflow}${overflowY}${overflowX}`)) {
      return parent
    }
    parent = parent.parentElement
  }
  return window
}
