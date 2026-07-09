export const isClient =
  typeof window !== 'undefined' && typeof document !== 'undefined'

export const isIOS =
  isClient &&
  /iP(?:ad|hone|od)/.test(window.navigator.userAgent) &&
  !('MSStream' in window)

export const isFirefox = (): boolean =>
  isClient && /firefox/i.test(window.navigator.userAgent)
