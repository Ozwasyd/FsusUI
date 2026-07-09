export const themeModes = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof themeModes)[number]
export type ResolvedTheme = Exclude<ThemeMode, 'system'>

const prefersDarkQuery = '(prefers-color-scheme: dark)'
const defaultThemeModeStorageKey = 'fsus.ui.themeMode'

let removeSystemThemeListener: (() => void) | undefined
const themeModeSubscribers = new Set<(detail: ThemeModeChangeDetail) => void>()

const getThemeRoot = () =>
  typeof document === 'undefined' ? undefined : document.documentElement

const clearSystemThemeListener = () => {
  removeSystemThemeListener?.()
  removeSystemThemeListener = undefined
}

const getSystemThemeMedia = () =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? undefined
    : window.matchMedia(prefersDarkQuery)

const resolveThemeModeStorage = (
  storage: Storage | null | undefined,
): Storage | undefined => {
  if (storage === null) return undefined
  if (storage) return storage
  if (typeof window === 'undefined') return undefined

  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export interface ThemeModeChangeDetail {
  mode: ThemeMode
  resolved: ResolvedTheme
  root?: HTMLElement
}

export interface ThemeRuntimeOptions {
  defaultMode?: ThemeMode
  persist?: boolean
  root?: HTMLElement
  storage?: Storage | null
  storageKey?: string
}

export interface ThemeRuntime {
  readonly mode: ThemeMode
  readonly resolved: ResolvedTheme
  clear: () => void
  read: () => ThemeMode
  setMode: (mode: string | null | undefined) => ResolvedTheme
  subscribe: (listener: (detail: ThemeModeChangeDetail) => void) => () => void
  write: (mode: string | null | undefined) => ResolvedTheme
}

const emitThemeModeChange = (
  detail: ThemeModeChangeDetail,
): ThemeModeChangeDetail => {
  themeModeSubscribers.forEach((listener) => listener(detail))
  detail.root?.dispatchEvent(
    new CustomEvent('fsus:theme-change', {
      bubbles: true,
      detail,
    }),
  )
  return detail
}

const setResolvedThemeMode = (root: HTMLElement, mode: ResolvedTheme) => {
  root.dataset.themeResolved = mode
  root.style.colorScheme = mode
}

const resolveSystemThemeMode = (): ResolvedTheme =>
  getSystemThemeMedia()?.matches ? 'dark' : 'light'

export const clearThemeMode = (root = getThemeRoot()) => {
  if (!root) return

  clearSystemThemeListener()
  root.classList.remove('dark', 'light')
  delete root.dataset.themeMode
  delete root.dataset.themeResolved
  root.style.removeProperty('color-scheme')
}

export const normalizeThemeMode = (
  value: unknown,
  fallback: ThemeMode = 'system',
): ThemeMode =>
  themeModes.includes(value as ThemeMode) ? (value as ThemeMode) : fallback

export const syncThemeMode = (
  mode: ThemeMode,
  root = getThemeRoot(),
): ResolvedTheme => {
  const normalized = normalizeThemeMode(mode)
  const fallbackResolved =
    normalized === 'dark' || normalized === 'light'
      ? normalized
      : resolveSystemThemeMode()

  if (!root || typeof window === 'undefined') return fallbackResolved

  clearSystemThemeListener()
  root.dataset.themeMode = normalized

  if (normalized === 'light') {
    root.classList.add('light')
    root.classList.remove('dark')
    setResolvedThemeMode(root, 'light')
    emitThemeModeChange({ mode: normalized, resolved: 'light', root })
    return 'light'
  }

  if (normalized === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
    setResolvedThemeMode(root, 'dark')
    emitThemeModeChange({ mode: normalized, resolved: 'dark', root })
    return 'dark'
  }

  root.classList.remove('dark', 'light')

  const media = getSystemThemeMedia()
  const applyResolvedThemeMode = () => {
    const resolved = resolveSystemThemeMode()
    setResolvedThemeMode(root, resolved)
    emitThemeModeChange({ mode: normalized, resolved, root })
    return resolved
  }

  const resolved = applyResolvedThemeMode()

  if (!media) return resolved

  const handleThemeModeChange = () => {
    applyResolvedThemeMode()
  }

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handleThemeModeChange)
    removeSystemThemeListener = () =>
      media.removeEventListener('change', handleThemeModeChange)
    return resolved
  }

  media.addListener(handleThemeModeChange)
  removeSystemThemeListener = () => media.removeListener(handleThemeModeChange)
  return resolved
}

export const readThemeMode = (
  options: Pick<
    ThemeRuntimeOptions,
    'defaultMode' | 'storage' | 'storageKey'
  > = {},
): ThemeMode => {
  const storage = resolveThemeModeStorage(options.storage)
  return normalizeThemeMode(
    storage?.getItem(options.storageKey ?? defaultThemeModeStorageKey),
    options.defaultMode ?? 'system',
  )
}

export const writeThemeMode = (
  mode: string | null | undefined,
  options: ThemeRuntimeOptions = {},
): ResolvedTheme => {
  const normalized = normalizeThemeMode(mode, options.defaultMode ?? 'system')
  const storage = resolveThemeModeStorage(options.storage)
  storage?.setItem(options.storageKey ?? defaultThemeModeStorageKey, normalized)
  return syncThemeMode(normalized, options.root)
}

export const removeThemeMode = (
  options: Pick<ThemeRuntimeOptions, 'root' | 'storage' | 'storageKey'> = {},
): void => {
  const storage = resolveThemeModeStorage(options.storage)
  storage?.removeItem(options.storageKey ?? defaultThemeModeStorageKey)
  clearThemeMode(options.root)
}

export const subscribeThemeMode = (
  listener: (detail: ThemeModeChangeDetail) => void,
): (() => void) => {
  themeModeSubscribers.add(listener)
  return () => themeModeSubscribers.delete(listener)
}

export const useThemeMode = (
  options: ThemeRuntimeOptions = {},
): ThemeRuntime => {
  let currentMode = readThemeMode(options)
  let currentResolved = syncThemeMode(currentMode, options.root)

  return {
    get mode() {
      return currentMode
    },
    get resolved() {
      return currentResolved
    },
    clear: () => {
      removeThemeMode(options)
      currentMode = options.defaultMode ?? 'system'
      currentResolved = syncThemeMode(currentMode, options.root)
    },
    read: () => {
      currentMode = readThemeMode(options)
      return currentMode
    },
    setMode: (mode) => {
      currentMode = normalizeThemeMode(mode, currentMode)
      if (options.persist !== false) {
        currentResolved = writeThemeMode(currentMode, options)
      } else {
        currentResolved = syncThemeMode(currentMode, options.root)
      }
      return currentResolved
    },
    subscribe: subscribeThemeMode,
    write: (mode) => {
      currentMode = normalizeThemeMode(mode, currentMode)
      currentResolved = writeThemeMode(currentMode, options)
      return currentResolved
    },
  }
}

export interface ThemeModeTestOptions {
  mode?: string | null
  root?: HTMLElement
  persist?: boolean
  storage?: Storage | null
  storageKey?: string
}

export interface ThemeModeTestController {
  set: (
    mode: string | null | undefined,
    options?: ThemeModeTestOptions,
  ) => ThemeMode
  clear: (options?: ThemeModeTestOptions) => void
  normalize: (
    mode: string | null | undefined,
    fallback?: ThemeMode,
  ) => ThemeMode
}

declare global {
  interface Window {
    __fsusUiThemeMode?: ThemeModeTestController
  }
}

const resolveThemeModeTestStorage = (
  storage: Storage | null | undefined,
): Storage | undefined => {
  if (storage === null) return undefined
  if (storage) return storage
  if (typeof window === 'undefined') return undefined

  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const persistThemeModeForTesting = (
  mode: ThemeMode,
  options: ThemeModeTestOptions,
) => {
  if (!options.persist) return

  const storage = resolveThemeModeTestStorage(options.storage)
  storage?.setItem(options.storageKey ?? defaultThemeModeStorageKey, mode)
}

const clearPersistedThemeModeForTesting = (options: ThemeModeTestOptions) => {
  const storage = resolveThemeModeTestStorage(options.storage)
  storage?.removeItem(options.storageKey ?? defaultThemeModeStorageKey)
}

export const applyThemeModeForTesting = (
  mode: string | null | undefined,
  options: ThemeModeTestOptions = {},
): ThemeMode => {
  const normalized = normalizeThemeMode(mode)
  syncThemeMode(normalized, options.root)
  persistThemeModeForTesting(normalized, options)
  return normalized
}

export const installThemeModeTestHelper = (
  options: ThemeModeTestOptions = {},
): ThemeModeTestController | undefined => {
  if (typeof window === 'undefined') return undefined

  const controller: ThemeModeTestController = {
    set: (mode, overrideOptions = {}) =>
      applyThemeModeForTesting(mode, { ...options, ...overrideOptions }),
    clear: (overrideOptions = {}) => {
      const mergedOptions = { ...options, ...overrideOptions }
      clearThemeMode(mergedOptions.root)
      clearPersistedThemeModeForTesting(mergedOptions)
    },
    normalize: normalizeThemeMode,
  }

  window.__fsusUiThemeMode = controller
  if (options.mode !== undefined) {
    controller.set(options.mode)
  }
  return controller
}
