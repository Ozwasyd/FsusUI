import { getCurrentScope, onScopeDispose } from 'vue'
import { isMotionReducedOrDisabled } from '../runtime'
import { resolveMotionTarget } from '../gsap/resolve'
import type { MotionTarget } from '../gsap/resolve'
import type { MotionRuntimeControls } from '../types'

export type FlipMotionState = {
  left: number
  top: number
  width: number
  height: number
}

export type FlipMotionOptions = {
  duration?: number
  easing?: string
  disabled?: boolean
}

const defaultFlipOptions: Required<Omit<FlipMotionOptions, 'disabled'>> = {
  duration: 220,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
}

const toElement = (target: MotionTarget) => {
  const resolved = resolveMotionTarget(target)
  return resolved instanceof HTMLElement ? resolved : undefined
}

export const measureFlipState = (
  target: MotionTarget,
): FlipMotionState | undefined => {
  const element = toElement(target)
  if (!element) return undefined

  const rect = element.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export const playFlipMotion = (
  target: MotionTarget,
  from: FlipMotionState | undefined,
  options: FlipMotionOptions = {},
): MotionRuntimeControls => {
  const element = toElement(target)
  const noop = {
    cancel: () => undefined,
    finish: () => undefined,
  }
  if (!element || !from) return noop

  const to = measureFlipState(element)
  if (!to) return noop

  const deltaX = from.left - to.left
  const deltaY = from.top - to.top
  const scaleX = to.width === 0 ? 1 : from.width / to.width
  const scaleY = to.height === 0 ? 1 : from.height / to.height

  if (isMotionReducedOrDisabled(options.disabled)) {
    element.style.transform = ''
    element.style.opacity = ''
    return noop
  }

  const duration = options.duration ?? defaultFlipOptions.duration
  const easing = options.easing ?? defaultFlipOptions.easing
  const keyframes = [
    {
      opacity: 0.96,
      transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`,
    },
    { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1, 1)' },
  ]

  if (typeof element.animate === 'function') {
    const animation = element.animate(keyframes, {
      duration,
      easing,
      fill: 'both',
    })
    return {
      cancel: () => animation.cancel(),
      finish: () => animation.finish(),
    }
  }

  element.style.transition = 'none'
  element.style.transform = keyframes[0].transform
  element.style.opacity = String(keyframes[0].opacity)
  void element.offsetWidth
  element.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`
  element.style.transform = keyframes[1].transform
  element.style.opacity = String(keyframes[1].opacity)

  return {
    cancel: () => {
      element.style.transition = ''
    },
    finish: () => {
      element.style.transition = ''
      element.style.transform = ''
      element.style.opacity = ''
    },
  }
}

export const useFlipMotion = (options: FlipMotionOptions = {}) => {
  const states = new WeakMap<Element, FlipMotionState>()
  const controls = new Set<MotionRuntimeControls>()

  const capture = (target: MotionTarget) => {
    const element = toElement(target)
    const state = measureFlipState(element)
    if (element && state) states.set(element, state)
    return state
  }

  const play = (target: MotionTarget, from?: FlipMotionState) => {
    const element = toElement(target)
    const state = from ?? (element ? states.get(element) : undefined)
    const control = playFlipMotion(target, state, options)
    controls.add(control)
    return control
  }

  const kill = () => {
    for (const control of controls) {
      control.cancel()
    }
    controls.clear()
  }

  if (getCurrentScope()) {
    onScopeDispose(kill)
  }

  return {
    capture,
    play,
    kill,
    states,
  }
}

export default useFlipMotion
