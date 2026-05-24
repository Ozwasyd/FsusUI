export const themeModes = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof themeModes)[number]

const prefersDarkQuery = '(prefers-color-scheme: dark)'

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
  mode: Exclude<ThemeMode, 'system'>
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
  removeSystemThemeListener = () =>
    media.removeListener(handleThemeModeChange)
}

export const normalizeThemeMode = (
  value: string | null | undefined,
  fallback: ThemeMode = 'system'
): ThemeMode =>
  themeModes.includes(value as ThemeMode) ? (value as ThemeMode) : fallback
