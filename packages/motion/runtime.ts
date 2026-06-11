import { getMotionPreset, resolveMotionPresetName } from './presets'
import type {
  MotionDirectiveValue,
  MotionPhase,
  MotionPresetDefinition,
  MotionPresetName,
  MotionRunOptions,
  MotionRuntimeControls,
  MotionStyleState,
} from './types'

const motionStateKey = Symbol('fsusMotionState')

type MotionElement = HTMLElement & {
  [motionStateKey]?: MotionRuntimeControls
}

const transitionProperties = ['opacity', 'transform', 'filter'] as const

const readRootMotionMode = () =>
  typeof document === 'undefined'
    ? 'enabled'
    : document.documentElement.dataset.fsusMotion

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const isMotionReducedOrDisabled = (disabled?: boolean) => {
  if (disabled) return true

  const rootMotionMode = readRootMotionMode()
  return (
    rootMotionMode === 'disabled' ||
    rootMotionMode === 'reduced' ||
    (!rootMotionMode && prefersReducedMotion())
  )
}

const toTimeValue = (value: string | number | undefined, fallback: string) =>
  typeof value === 'number' ? `${value}ms` : value || fallback

const numericTimeValue = (value: string) => {
  const match = /^(-?\d+(?:\.\d+)?)(ms|s)?$/u.exec(value.trim())
  if (!match) return undefined

  const amount = Number(match[1])
  return match[2] === 's' ? amount * 1000 : amount
}

const normalizeStyleValue = (value: string | undefined) =>
  value === undefined ? '' : value

const applyStyleState = (el: HTMLElement, state: MotionStyleState) => {
  if ('opacity' in state) el.style.opacity = normalizeStyleValue(state.opacity)
  if ('transform' in state) {
    el.style.transform = normalizeStyleValue(state.transform)
  }
  if ('filter' in state) el.style.filter = normalizeStyleValue(state.filter)
}

const resolveDelay = (
  preset: MotionPresetDefinition,
  options: MotionRunOptions,
) => {
  const directDelay = toTimeValue(options.delay, preset.delay || '0ms')
  if (options.name !== 'list-stagger') return directDelay

  const index = options.index ?? 0
  if (index <= 0) return directDelay

  const stagger = preset.stagger || '0ms'
  const numericStagger = numericTimeValue(stagger)
  if (numericStagger !== undefined) {
    return `${numericStagger * index}ms`
  }

  return `calc(${stagger} * ${index})`
}

const transitionFor = (
  preset: MotionPresetDefinition,
  options: MotionRunOptions,
  state: MotionStyleState,
) => {
  const duration = toTimeValue(options.duration, preset.duration)
  const delay = resolveDelay(preset, options)
  const easing = options.easing || preset.easing
  const properties = transitionProperties.filter(
    (property) => property in state,
  )

  return {
    delay,
    duration,
    value: properties
      .map((property) => `${property} ${duration} ${easing} ${delay}`)
      .join(', '),
  }
}

const estimatedDuration = (duration: string, delay: string) => {
  const durationMs = numericTimeValue(duration) ?? 260
  const delayMs = numericTimeValue(delay) ?? 0
  return durationMs + delayMs
}

const nextFrame = (callback: () => void) => {
  if (typeof window === 'undefined') {
    callback()
    return 0
  }

  return window.requestAnimationFrame(callback)
}

export const normalizeMotionOptions = (
  value: MotionDirectiveValue,
  fallback: MotionPresetName = 'fade-in',
): MotionRunOptions => {
  if (typeof value === 'string') {
    const name = resolveMotionPresetName(value, fallback)
    return { name }
  }

  if (value === false || value == null) {
    return {
      name: resolveMotionPresetName(undefined, fallback),
      disabled: value === false,
    }
  }

  const name = resolveMotionPresetName(value.name, fallback)
  return { ...value, name }
}

export const getMotionPhaseState = (
  preset: MotionPresetDefinition,
  phase: MotionPhase,
) => {
  if (phase === 'leave') {
    return {
      from: preset.leaveFrom || preset.to,
      to: preset.leaveTo || preset.from,
    }
  }

  return {
    from: preset.from,
    to: preset.to,
  }
}

export const cancelMotion = (el: HTMLElement) => {
  const motionEl = el as MotionElement
  motionEl[motionStateKey]?.cancel()
  delete motionEl[motionStateKey]
}

export const runMotion = (
  el: HTMLElement,
  options: MotionRunOptions,
): MotionRuntimeControls => {
  cancelMotion(el)

  const preset = getMotionPreset(options.name)
  const phase = options.phase || 'enter'
  const { from, to } = getMotionPhaseState(preset, phase)
  const {
    delay,
    duration,
    value: transition,
  } = transitionFor(preset, options, to)

  let finished = false
  let frame = 0
  let timeout: ReturnType<typeof setTimeout> | undefined

  const cleanup = () => {
    if (frame) window.cancelAnimationFrame(frame)
    if (timeout) clearTimeout(timeout)
    el.removeEventListener('transitionend', finish)
    el.style.willChange = ''
  }

  const finish = () => {
    if (finished) return
    finished = true
    cleanup()
    applyStyleState(el, to)
    options.onFinish?.()
  }

  const controls: MotionRuntimeControls = {
    cancel() {
      if (finished) return
      finished = true
      cleanup()
    },
    finish,
  }

  ;(el as MotionElement)[motionStateKey] = controls

  if (isMotionReducedOrDisabled(options.disabled)) {
    el.style.transition = ''
    applyStyleState(el, to)
    finish()
    return controls
  }

  el.style.transition = 'none'
  el.style.willChange = transitionProperties
    .filter((property) => property in to)
    .join(', ')
  applyStyleState(el, from)

  // Force the browser to commit the initial state before enabling transitions.
  void el.offsetWidth

  frame = nextFrame(() => {
    if (finished) return

    el.style.transition = transition
    el.addEventListener('transitionend', finish, { once: true })
    applyStyleState(el, to)
    timeout = setTimeout(finish, estimatedDuration(duration, delay) + 32)
  })

  return controls
}
