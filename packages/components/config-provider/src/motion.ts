export const motionModes = ['system', 'enabled', 'reduced', 'disabled'] as const
export type MotionMode = (typeof motionModes)[number]

export const motionPresets = ['standard', 'smooth', 'expressive'] as const
export type MotionPreset = (typeof motionPresets)[number]

export type MotionConfigContract = {
  mode?: MotionMode
  preset?: MotionPreset
}

type ResolvedMotionMode = Exclude<MotionMode, 'system'>

type MotionTokenMap = Record<string, string>

export const defaultMotionConfig: Required<MotionConfigContract> = {
  mode: 'system',
  preset: 'smooth',
}

const prefersReducedQuery = '(prefers-reduced-motion: reduce)'

const motionTokenNames = [
  '--fsus-motion-standard',
  '--fsus-motion-emphasized',
  '--fsus-motion-control',
  '--fsus-motion-control-fast',
  '--fsus-motion-slider-follow',
  '--fsus-motion-slider-release',
  '--fsus-motion-panel',
  '--fsus-motion-overlay',
  '--fsus-motion-blur',
  '--fsus-motion-slider-blur',
  '--fsus-motion-scroll-blur',
  '--fsus-motion-scroll-offset',
  '--fsus-motion-scroll-max-offset',
  '--fsus-motion-scroll-settle',
  '--fsus-motion-scroll-trail-opacity',
  '--fsus-motion-drag-max-offset',
  '--fsus-motion-drag-blur',
  '--fsus-motion-drag-scale',
  '--fsus-motion-drag-trail-opacity',
  '--fsus-motion-trail',
  '--fsus-motion-slider-trail',
  '--fsus-motion-spring-stiffness',
  '--fsus-motion-spring-damping',
  '--fsus-motion-spring-mass',
  '--fsus-motion-scroll-idle',
] as const

const presetTokens: Record<MotionPreset, MotionTokenMap> = {
  standard: {
    '--fsus-motion-standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
    '--fsus-motion-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
    '--fsus-motion-control': '220ms',
    '--fsus-motion-control-fast': '140ms',
    '--fsus-motion-slider-follow': '90ms',
    '--fsus-motion-slider-release': '200ms',
    '--fsus-motion-panel': '360ms',
    '--fsus-motion-overlay': '260ms',
    '--fsus-motion-blur': '0.28px',
    '--fsus-motion-slider-blur': '0.22px',
    '--fsus-motion-scroll-blur': '0px',
    '--fsus-motion-scroll-offset': '1.5px',
    '--fsus-motion-scroll-max-offset': '3px',
    '--fsus-motion-scroll-settle': '100ms',
    '--fsus-motion-scroll-trail-opacity': '0.36',
    '--fsus-motion-drag-max-offset': '3px',
    '--fsus-motion-drag-blur': '0.22px',
    '--fsus-motion-drag-scale': '0.06',
    '--fsus-motion-drag-trail-opacity': '0.36',
    '--fsus-motion-trail': 'rgba(42, 89, 156, 0.14)',
    '--fsus-motion-slider-trail': 'rgba(42, 89, 156, 0.18)',
    '--fsus-motion-spring-stiffness': '260',
    '--fsus-motion-spring-damping': '28',
    '--fsus-motion-spring-mass': '0.9',
    '--fsus-motion-scroll-idle': '110ms',
  },
  smooth: {
    '--fsus-motion-standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
    '--fsus-motion-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
    '--fsus-motion-control': '260ms',
    '--fsus-motion-control-fast': '160ms',
    '--fsus-motion-slider-follow': '96ms',
    '--fsus-motion-slider-release': '220ms',
    '--fsus-motion-panel': '420ms',
    '--fsus-motion-overlay': '300ms',
    '--fsus-motion-blur': '0.35px',
    '--fsus-motion-slider-blur': '0.28px',
    '--fsus-motion-scroll-blur': '0px',
    '--fsus-motion-scroll-offset': '2px',
    '--fsus-motion-scroll-max-offset': '4px',
    '--fsus-motion-scroll-settle': '120ms',
    '--fsus-motion-scroll-trail-opacity': '0.46',
    '--fsus-motion-drag-max-offset': '4px',
    '--fsus-motion-drag-blur': '0.28px',
    '--fsus-motion-drag-scale': '0.08',
    '--fsus-motion-drag-trail-opacity': '0.46',
    '--fsus-motion-trail': 'rgba(42, 89, 156, 0.16)',
    '--fsus-motion-slider-trail': 'rgba(42, 89, 156, 0.2)',
    '--fsus-motion-spring-stiffness': '300',
    '--fsus-motion-spring-damping': '30',
    '--fsus-motion-spring-mass': '0.82',
    '--fsus-motion-scroll-idle': '130ms',
  },
  expressive: {
    '--fsus-motion-standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
    '--fsus-motion-emphasized': 'cubic-bezier(0.16, 1, 0.3, 1)',
    '--fsus-motion-control': '300ms',
    '--fsus-motion-control-fast': '180ms',
    '--fsus-motion-slider-follow': '120ms',
    '--fsus-motion-slider-release': '280ms',
    '--fsus-motion-panel': '520ms',
    '--fsus-motion-overlay': '360ms',
    '--fsus-motion-blur': '0.45px',
    '--fsus-motion-slider-blur': '0.36px',
    '--fsus-motion-scroll-blur': '0px',
    '--fsus-motion-scroll-offset': '2.5px',
    '--fsus-motion-scroll-max-offset': '5px',
    '--fsus-motion-scroll-settle': '150ms',
    '--fsus-motion-scroll-trail-opacity': '0.58',
    '--fsus-motion-drag-max-offset': '5px',
    '--fsus-motion-drag-blur': '0.36px',
    '--fsus-motion-drag-scale': '0.1',
    '--fsus-motion-drag-trail-opacity': '0.58',
    '--fsus-motion-trail': 'rgba(42, 89, 156, 0.2)',
    '--fsus-motion-slider-trail': 'rgba(42, 89, 156, 0.24)',
    '--fsus-motion-spring-stiffness': '340',
    '--fsus-motion-spring-damping': '24',
    '--fsus-motion-spring-mass': '0.72',
    '--fsus-motion-scroll-idle': '160ms',
  },
}

const reducedTokens: MotionTokenMap = {
  '--fsus-motion-control': '1ms',
  '--fsus-motion-control-fast': '1ms',
  '--fsus-motion-slider-follow': '1ms',
  '--fsus-motion-slider-release': '1ms',
  '--fsus-motion-panel': '1ms',
  '--fsus-motion-overlay': '1ms',
  '--fsus-motion-blur': '0px',
  '--fsus-motion-slider-blur': '0px',
  '--fsus-motion-scroll-blur': '0px',
  '--fsus-motion-scroll-offset': '0px',
  '--fsus-motion-scroll-max-offset': '0px',
  '--fsus-motion-scroll-settle': '1ms',
  '--fsus-motion-scroll-trail-opacity': '0',
  '--fsus-motion-drag-max-offset': '0px',
  '--fsus-motion-drag-blur': '0px',
  '--fsus-motion-drag-scale': '0',
  '--fsus-motion-drag-trail-opacity': '0',
  '--fsus-motion-trail': 'transparent',
  '--fsus-motion-slider-trail': 'transparent',
  '--fsus-motion-scroll-idle': '1ms',
}

let removeSystemMotionListener: (() => void) | undefined

const getMotionRoot = () =>
  typeof document === 'undefined' ? undefined : document.documentElement

const clearSystemMotionListener = () => {
  removeSystemMotionListener?.()
  removeSystemMotionListener = undefined
}

const getSystemMotionMedia = () =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? undefined
    : window.matchMedia(prefersReducedQuery)

const resolveSystemMotionMode = (): ResolvedMotionMode =>
  getSystemMotionMedia()?.matches ? 'reduced' : 'enabled'

const normalizeMotionPreset = (preset?: string): MotionPreset =>
  motionPresets.includes(preset as MotionPreset)
    ? (preset as MotionPreset)
    : defaultMotionConfig.preset

const normalizeMotionMode = (mode?: string): MotionMode =>
  motionModes.includes(mode as MotionMode)
    ? (mode as MotionMode)
    : defaultMotionConfig.mode

export const normalizeMotionConfig = (
  config?: MotionConfigContract | null,
): Required<MotionConfigContract> => ({
  mode: normalizeMotionMode(config?.mode),
  preset: normalizeMotionPreset(config?.preset),
})

const resolveMotionMode = (mode: MotionMode): ResolvedMotionMode => {
  if (mode === 'system') return resolveSystemMotionMode()
  return mode
}

const writeMotionTokens = (
  root: HTMLElement,
  config: Required<MotionConfigContract>,
  resolvedMode: ResolvedMotionMode,
) => {
  const tokens = {
    ...presetTokens[config.preset],
    ...(resolvedMode === 'enabled' ? {} : reducedTokens),
  }

  for (const token of motionTokenNames) {
    const value = tokens[token]
    if (value) root.style.setProperty(token, value)
  }
}

const writeMotionDataset = (
  root: HTMLElement,
  config: Required<MotionConfigContract>,
  resolvedMode: ResolvedMotionMode,
) => {
  root.dataset.fsusMotionMode = config.mode
  root.dataset.fsusMotion = resolvedMode
  root.dataset.fsusMotionPreset = config.preset
}

export const clearMotionConfig = (root = getMotionRoot()) => {
  if (!root) return

  clearSystemMotionListener()
  delete root.dataset.fsusMotion
  delete root.dataset.fsusMotionMode
  delete root.dataset.fsusMotionPreset

  for (const token of motionTokenNames) {
    root.style.removeProperty(token)
  }
}

export const syncMotionConfig = (
  motionConfig?: MotionConfigContract | null,
  root = getMotionRoot(),
) => {
  if (!root || typeof window === 'undefined') return

  clearSystemMotionListener()
  const config = normalizeMotionConfig(motionConfig)
  const apply = () => {
    const resolvedMode = resolveMotionMode(config.mode)
    writeMotionDataset(root, config, resolvedMode)
    writeMotionTokens(root, config, resolvedMode)
  }

  apply()

  if (config.mode !== 'system') return

  const media = getSystemMotionMedia()
  if (!media) return

  const handleMotionChange = () => apply()

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handleMotionChange)
    removeSystemMotionListener = () =>
      media.removeEventListener('change', handleMotionChange)
    return
  }

  media.addListener(handleMotionChange)
  removeSystemMotionListener = () => media.removeListener(handleMotionChange)
}
