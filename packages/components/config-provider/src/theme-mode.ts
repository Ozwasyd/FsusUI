export const themeModes = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof themeModes)[number]

const prefersDarkQuery = '(prefers-color-scheme: dark)'
const defaultThemeModeTestStorageKey = 'fsus.ui.themeMode'

let removeSystemThemeListener: (() => void) | undefined

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

const setResolvedThemeMode = (
  root: HTMLElement,
  mode: Exclude<ThemeMode, 'system'>,
) => {
  root.dataset.themeResolved = mode
  root.style.colorScheme = mode
}

const resolveSystemThemeMode = () =>
  getSystemThemeMedia()?.matches ? 'dark' : 'light'

export const clearThemeMode = (root = getThemeRoot()) => {
  if (!root) return

  clearSystemThemeListener()
  root.classList.remove('dark', 'light')
  delete root.dataset.themeMode
  delete root.dataset.themeResolved
  root.style.removeProperty('color-scheme')
}

export const syncThemeMode = (mode: ThemeMode, root = getThemeRoot()) => {
  if (!root || typeof window === 'undefined') return

  clearSystemThemeListener()
  root.dataset.themeMode = mode

  if (mode === 'light') {
    root.classList.add('light')
    root.classList.remove('dark')
    setResolvedThemeMode(root, 'light')
    return
  }

  if (mode === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
    setResolvedThemeMode(root, 'dark')
    return
  }

  root.classList.remove('dark', 'light')

  const media = getSystemThemeMedia()
  const applyResolvedThemeMode = () => {
    setResolvedThemeMode(root, resolveSystemThemeMode())
  }

  applyResolvedThemeMode()

  if (!media) return

  const handleThemeModeChange = () => {
    applyResolvedThemeMode()
  }

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handleThemeModeChange)
    removeSystemThemeListener = () =>
      media.removeEventListener('change', handleThemeModeChange)
    return
  }

  media.addListener(handleThemeModeChange)
  removeSystemThemeListener = () => media.removeListener(handleThemeModeChange)
}

export const normalizeThemeMode = (
  value: string | null | undefined,
  fallback: ThemeMode = 'system',
): ThemeMode =>
  themeModes.includes(value as ThemeMode) ? (value as ThemeMode) : fallback

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
  storage?.setItem(options.storageKey ?? defaultThemeModeTestStorageKey, mode)
}

const clearPersistedThemeModeForTesting = (options: ThemeModeTestOptions) => {
  const storage = resolveThemeModeTestStorage(options.storage)
  storage?.removeItem(options.storageKey ?? defaultThemeModeTestStorageKey)
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
