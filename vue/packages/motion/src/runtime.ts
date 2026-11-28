import {
  getMotionPreset,
  getMotionPresetBundle,
  resolveMotionPresetName,
} from './presets'
import { isMotionDisabled, isMotionReduced } from './preference'
import {
  claimMotionBudgetNode,
  clampStaggerIndex,
  isMotionPropertyAllowed,
  releaseMotionBudgetNode,
  resolveMotionBudget,
} from './budget'
import type {
  MotionDirectiveValue,
  MotionPhase,
  MotionPresetDefinition,
  MotionPresetName,
  MotionRunOptions,
  MotionRuntimeControls,
  MotionStyleState,
  MotionSurfaceCategory,
} from './types'

const motionStateKey = Symbol('fsusMotionState')

type MotionElement = HTMLElement & {
  [motionStateKey]?: MotionRuntimeControls
}

const transitionProperties = ['opacity', 'transform', 'filter'] as const
const readingSurfaceSelector =
  ".fsus-reading-surface, [data-fsus-surface='reading']"
const readingSurfaceMotionTokens = {
  '--fsus-interactive-motion-blur': '0px',
  '--fsus-interactive-motion-glow': '0px',
  '--fsus-interactive-motion-offset-x': '0px',
  '--fsus-interactive-motion-offset-y': '0px',
  '--fsus-interactive-motion-strength': '0',
  '--fsus-interactive-motion-trail-opacity': '0',
  '--fsus-motion-blur': '0px',
  '--fsus-motion-slider-blur': '0px',
  '--fsus-motion-scroll-blur': '0px',
  '--fsus-motion-scroll-offset': '0px',
  '--fsus-motion-scroll-max-offset': '0px',
  '--fsus-motion-drag-blur': '0px',
  '--fsus-motion-drag-max-offset': '0px',
  '--fsus-motion-drag-scale': '0',
  '--fsus-motion-scroll-trail-opacity': '0',
  '--fsus-motion-drag-trail-opacity': '0',
  '--fsus-motion-trail': 'transparent',
  '--fsus-motion-slider-trail': 'transparent',
} as const

// Combined check: motion is reduced if either the user prefers
// reduced motion (or the root is set to 'reduced') OR a component
// has been explicitly disabled. The two axes are tracked separately
// by `isMotionReduced` and `isMotionDisabled`; this helper is for
// call sites that want the union (the common case for runtime
// branches that should not animate at all).
export const isMotionReducedOrDisabled = (disabled?: boolean) => {
  return isMotionDisabled(disabled) || isMotionReduced()
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
  bundle: { stagger: string },
  options: MotionRunOptions,
) => {
  const directDelay = toTimeValue(options.delay, preset.delay || '0ms')
  const stagger = preset.stagger ?? bundle.stagger
  if (!stagger || options.index === undefined) return directDelay

  const budget = resolveMotionBudget(options.budget)
  const index = clampStaggerIndex(options.index ?? 0, budget)
  if (index <= 0) return directDelay

  const numericStagger = numericTimeValue(stagger)
  if (numericStagger !== undefined) {
    return `${numericStagger * index}ms`
  }

  return `calc(${stagger} * ${index})`
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
  fallback: MotionPresetName = 'surface-settle',
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
  surface?: MotionSurfaceCategory,
) => {
  const states =
    phase === 'leave'
      ? {
          from: preset.leaveFrom || preset.to,
          to: preset.leaveTo || preset.from,
        }
      : {
          from: preset.from,
          to: preset.to,
        }

  if (surface !== 'reading-surface') return states

  const sanitize = (state: MotionStyleState): MotionStyleState => ({
    ...state,
    filter: 'none',
    ...(state.transform?.includes('translate') ? { transform: 'none' } : {}),
  })
  return {
    from: sanitize(states.from),
    to: sanitize(states.to),
  }
}

const resolveMotionSurface = (
  el: HTMLElement,
  explicit?: MotionSurfaceCategory,
): MotionSurfaceCategory | undefined =>
  explicit ??
  (el.closest(readingSurfaceSelector) ? 'reading-surface' : undefined)

const applyReadingSurfaceGuard = (el: HTMLElement) => {
  for (const [token, value] of Object.entries(readingSurfaceMotionTokens)) {
    el.style.setProperty(token, value)
  }
}

const reducedTerminalState = (
  preset: MotionPresetDefinition,
  phase: MotionPhase,
  phaseTarget: MotionStyleState,
): MotionStyleState => ({
  opacity:
    phase === 'leave'
      ? (phaseTarget.opacity ?? '0')
      : (preset.reduced.opacity ?? phaseTarget.opacity ?? '1'),
  transform: 'none',
  filter: 'none',
})

export const cancelMotion = (el: HTMLElement) => {
  const motionEl = el as MotionElement
  motionEl[motionStateKey]?.cancel()
  delete motionEl[motionStateKey]
}

// Build WAAPI keyframes from the from/to MotionStyleState. Each animated
// property is interpolated independently; if the from-state omits a
// property present in the to-state, the to-value is used for both ends
// (so the property is held constant). Conversely if the to-state omits
// a property present in the from-state, the from-value is held.
const buildKeyframes = (
  properties: readonly (keyof MotionStyleState)[],
  from: MotionStyleState,
  to: MotionStyleState,
): Keyframe[] => {
  const fromFrame: Record<string, string> = {}
  const toFrame: Record<string, string> = {}
  for (const property of properties) {
    const fromValue = from[property]
    const toValue = to[property]
    fromFrame[property] = (fromValue ?? toValue ?? '') as string
    toFrame[property] = (toValue ?? fromValue ?? '') as string
  }
  return [fromFrame, toFrame]
}

// WAAPI primary path — uses the browser's animation engine.
const runWaapiMotion = (
  el: HTMLElement,
  properties: readonly (keyof MotionStyleState)[],
  keyframes: Keyframe[],
  durationMs: number,
  delayMs: number,
  easing: string,
  onFinish: () => void,
  onCancel: () => void,
): Animation | null => {
  if (typeof el.animate !== 'function') return null
  const animation = el.animate(keyframes, {
    duration: durationMs,
    delay: delayMs,
    easing,
    fill: 'forwards',
  })
  animation.onfinish = onFinish
  animation.oncancel = onCancel
  return animation
}

// Keep a terminal visual state in the browser animation layer. Unlike
// Animation.commitStyles() or HTMLElement.style writes, this does not create
// a style attribute and therefore remains compatible with style-src-attr
// 'none'. The owning controls cancel the retained fill effect before the next
// motion starts or when the element is unmounted.
const holdWaapiTerminalState = (
  el: HTMLElement,
  state: MotionStyleState,
): Animation | null => {
  if (typeof el.animate !== 'function') return null
  const animation = el.animate([state, state], {
    duration: 0,
    fill: 'forwards',
  })
  animation.finish()
  return animation
}

// Compatibility fallback for environments without WAAPI (jsdom, very old
// browsers). Uses inline CSS transitions, which is the old self-written
// path. Kept narrow on purpose: any code path that hits this is in a
// test or legacy context, not the production runtime.
const runTransitionFallback = (
  el: HTMLElement,
  properties: readonly (keyof MotionStyleState)[],
  from: MotionStyleState,
  to: MotionStyleState,
  durationStr: string,
  delayStr: string,
  easing: string,
  onFinish: () => void,
  onCancel: () => void,
): { cancel: () => void } => {
  el.style.transition = 'none'
  el.style.willChange = properties.join(', ')
  applyStyleState(el, from)
  void el.offsetWidth
  let frame = nextFrame(() => {
    if (finished) return
    el.style.transition = properties
      .map((property) => `${property} ${durationStr} ${easing} ${delayStr}`)
      .join(', ')
    applyStyleState(el, to)
    const handleEnd = () => {
      el.removeEventListener('transitionend', handleEnd)
      onFinish()
    }
    el.addEventListener('transitionend', handleEnd, { once: true })
    timeout = setTimeout(
      handleEnd,
      estimatedDuration(durationStr, delayStr) + 32,
    )
  })
  let finished = false
  let timeout: ReturnType<typeof setTimeout> | undefined
  return {
    cancel() {
      if (finished) return
      finished = true
      if (frame) {
        if (typeof window !== 'undefined') window.cancelAnimationFrame(frame)
        frame = 0
      }
      if (timeout) clearTimeout(timeout)
      el.style.transition = ''
      el.style.willChange = ''
      onCancel()
    },
  }
}

export const runMotion = (
  el: HTMLElement,
  options: MotionRunOptions,
): MotionRuntimeControls => {
  cancelMotion(el)

  const preset = getMotionPreset(options.name)
  const bundle = getMotionPresetBundle(preset.name)
  const phase = options.phase || 'enter'
  const surface = resolveMotionSurface(el, options.surface)
  const { from, to } = getMotionPhaseState(preset, phase, surface)
  const durationStr = toTimeValue(options.duration, bundle.duration)
  const delayStr = resolveDelay(preset, bundle, options)
  const easing = options.easing || bundle.easing
  const budget = resolveMotionBudget(options.budget)
  const durationMs = numericTimeValue(durationStr) ?? 260
  const delayMs = numericTimeValue(delayStr) ?? 0

  let finished = false
  let claimedBudget = false
  let finalState = to
  let animation: Animation | null = null
  let fallback: { cancel: () => void } | null = null

  if (surface === 'reading-surface') applyReadingSurfaceGuard(el)

  const releaseBudget = () => {
    if (claimedBudget) {
      releaseMotionBudgetNode()
      claimedBudget = false
    }
  }

  const commitAndFinish = () => {
    if (finished) return
    finished = true
    if (animation) {
      try {
        // Advancing the retained WAAPI effect is CSP-safe; commitStyles()
        // would materialize an inline style attribute in WebKit.
        if (animation.playState !== 'finished') animation.finish()
      } catch {
        // A cancelled animation may reject finish(). Its lifecycle is still
        // complete, so release the budget and notify the caller below.
      }
    } else {
      applyStyleState(el, finalState)
    }
    releaseBudget()
    options.onFinish?.()
  }

  const controls: MotionRuntimeControls = {
    cancel() {
      const wasFinished = finished
      finished = true
      animation?.cancel()
      fallback?.cancel()
      if (!wasFinished) releaseBudget()
    },
    finish: commitAndFinish,
  }

  ;(el as MotionElement)[motionStateKey] = controls

  // Reduced / disabled / budget exhausted — apply terminal state immediately.
  if (
    isMotionReducedOrDisabled(options.disabled) ||
    !claimMotionBudgetNode(budget)
  ) {
    finalState = reducedTerminalState(preset, phase, to)
    animation = holdWaapiTerminalState(el, finalState)
    if (!animation) applyStyleState(el, finalState)
    options.onFinish?.()
    finished = true
    return controls
  }
  claimedBudget = true

  // Filter the animated properties by what's in the to-state and the budget.
  const properties = transitionProperties.filter(
    (property) => property in to && isMotionPropertyAllowed(property, budget),
  ) as (keyof MotionStyleState)[]

  // If the to-state is empty (or all properties blocked), commit terminal.
  if (properties.length === 0) {
    animation = holdWaapiTerminalState(el, to)
    if (!animation) applyStyleState(el, to)
    releaseBudget()
    options.onFinish?.()
    finished = true
    return controls
  }

  const keyframes = buildKeyframes(properties, from, to)

  // Primary: WAAPI. The browser's animation engine handles interpolation,
  // easing, delay, and timing. We only need to commitStyles on finish so
  // the final state persists on the element after the animation ends.
  animation = runWaapiMotion(
    el,
    properties,
    keyframes,
    durationMs,
    delayMs,
    easing,
    commitAndFinish,
    () => {
      if (!finished) {
        finished = true
        releaseBudget()
      }
    },
  )

  if (!animation) {
    // Fallback for environments without WAAPI (jsdom, very old browsers).
    // Uses inline CSS transitions — see runTransitionFallback.
    fallback = runTransitionFallback(
      el,
      properties,
      from,
      to,
      durationStr,
      delayStr,
      easing,
      commitAndFinish,
      () => {
        if (!finished) {
          finished = true
          releaseBudget()
        }
      },
    )
  }

  return controls
}

export type OwnershipTransferSnapshotMotionOptions = Omit<
  MotionRunOptions,
  'name'
>

export const runOwnershipTransferSnapshotMotion = (
  el: HTMLElement,
  options: OwnershipTransferSnapshotMotionOptions = {},
): MotionRuntimeControls => {
  el.dataset.fsusMotionPreset = 'ownership-transfer-snapshot'
  return runMotion(el, {
    ...options,
    name: 'ownership-transfer-snapshot',
  })
}
