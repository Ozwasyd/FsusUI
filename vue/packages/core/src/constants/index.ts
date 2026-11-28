export const FSUS_SIZES = ['sm', 'md', 'lg'] as const
export type FsusSize = (typeof FSUS_SIZES)[number]

export const FSUS_TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const
export type FsusTone = (typeof FSUS_TONES)[number]

export const FSUS_VARIANTS = [
  'default',
  'primary',
  'secondary',
  'ghost',
  'link',
  'danger',
] as const
export type FsusVariant = (typeof FSUS_VARIANTS)[number]

export const FSUS_KEY = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
  BACKSPACE: 'Backspace',
  DELETE: 'Delete',
} as const
