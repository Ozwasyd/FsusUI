import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  unref,
  type MaybeRef,
  type Ref,
} from 'vue'
import { cancelMotion, isMotionReducedOrDisabled, runMotion } from './runtime'
import { resolveMotionPreference } from './preference'
import { getMotionPreset, getMotionPresetBundle, resolveMotionPresetName } from './presets'
import { runMotionRecipe } from './recipes'
import { runViewTransition, type ViewTransitionRunOptions } from './view-transition'
import type {
  MotionPresetName,
  MotionRecipeName,
  MotionRunOptions,
  MotionRuntimeControls,
  MotionStyleState,
} from './types'

export type FsusMotionTarget =
  | Element
  | Element[]
  | string
  | Ref<Element | Element[] | string | null | undefined>
  | null
  | undefined

export const resolveMotionTarget = (target: FsusMotionTarget): Element | Element[] | null => {
  const raw = unref(target)
  if (!raw) return null
  if (typeof raw === 'string') {
    return typeof document === 'undefined' ? null : document.querySelector(raw)
  }
  return raw
}

const toHtmlElement = (target: FsusMotionTarget): HTMLElement | null => {
  const resolved = resolveMotionTarget(target)
  if (Array.isArray(resolved)) {
    return resolved[0] instanceof HTMLElement ? resolved[0] : null
  }
  return resolved instanceof HTMLElement ? resolved : null
}

export const useFsusMotionPreference = (disabled: MaybeRef<boolean> = false) =>
  computed(() => resolveMotionPreference(unref(disabled)))

export const useFsusViewTransition = () => ({
  run: (update: () => void | Promise<void>, options?: ViewTransitionRunOptions) =>
    runViewTransition(update, options),
})

// Native WAAPI FLIP motion (zero GSAP)
export interface FlipMotionState {
  left: number
  top: number
  width: number
  height: number
}

export interface FlipMotionOptions {
  duration?: number
  easing?: string
  disabled?: boolean
}

export const measureFlipState = (target: FsusMotionTarget): FlipMotionState | undefined => {
  const el = toHtmlElement(target)
  if (!el) return undefined
  const rect = el.getBoundingClientRect()
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

export const playFlipMotion = (
  target: FsusMotionTarget,
  from: FlipMotionState | undefined,
  options: FlipMotionOptions = {},
): MotionRuntimeControls => {
  const noop: MotionRuntimeControls = { cancel: () => undefined, finish: () => undefined }
  const el = toHtmlElement(target)
  if (!el || !from) return noop
  const to = measureFlipState(el)
  if (!to || isMotionReducedOrDisabled(options.disabled)) return noop

  const dx = from.left - to.left
  const dy = from.top - to.top
  const sx = to.width === 0 ? 1 : from.width / to.width
  const sy = to.height === 0 ? 1 : from.height / to.height
  if (dx === 0 && dy === 0 && sx === 1 && sy === 1) return noop

  const keyframes: Keyframe[] = [
    { opacity: 0.96, transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})` },
    { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1, 1)' },
  ]
  if (typeof el.animate === 'function') {
    const anim = el.animate(keyframes, {
      duration: options.duration ?? 220,
      easing: options.easing ?? 'cubic-bezier(0.2, 0, 0, 1)',
      fill: 'both',
    })
    return { cancel: () => anim.cancel(), finish: () => anim.finish() }
  }
  return noop
}

export const useFsusFlipMotion = (options: FlipMotionOptions = {}) => {
  const states = new WeakMap<Element, FlipMotionState>()
  const active = new Set<MotionRuntimeControls>()

  const capture = (target: FsusMotionTarget) => {
    const el = toHtmlElement(target)
    const state = measureFlipState(el)
    if (el && state) states.set(el, state)
    return state
  }

  const play = (target: FsusMotionTarget, from?: FlipMotionState) => {
    const el = toHtmlElement(target)
    const ctrl = playFlipMotion(el, from ?? (el ? states.get(el) : undefined), options)
    active.add(ctrl)
    return ctrl
  }

  const kill = () => {
    for (const c of active) c.cancel()
    active.clear()
  }

  if (getCurrentScope()) onScopeDispose(kill)
  return { capture, play, kill }
}

// Native WAAPI Timeline (replaces GSAP timeline)
export interface FsusTimelineStep {
  target: FsusMotionTarget
  preset?: MotionPresetName
  from?: MotionStyleState
  to?: MotionStyleState
  duration?: number
  delay?: number
  easing?: string
}

export const useFsusTimeline = () => {
  const animations = new Set<Animation>()

  const kill = () => {
    for (const anim of animations) anim.cancel()
    animations.clear()
  }

  const play = (steps: FsusTimelineStep[], options: { disabled?: boolean } = {}) => {
    kill()
    const reduced = isMotionReducedOrDisabled(options.disabled)
    let cursorMs = 0

    for (const step of steps) {
      const el = toHtmlElement(step.target)
      if (!el) continue
      const presetName = resolveMotionPresetName(step.preset ?? 'surface-settle')
      const preset = getMotionPreset(presetName)
      const bundle = getMotionPresetBundle(presetName)
      const from = { ...preset.from, ...step.from }
      const to = { ...preset.to, ...step.to }
      const duration = reduced ? 0 : (step.duration ?? Number.parseFloat(bundle.duration) ?? 220)
      const delay = reduced ? 0 : (step.delay ?? cursorMs)

      if (typeof el.animate === 'function') {
        const anim = el.animate([from as Keyframe, to as Keyframe], {
          duration,
          delay,
          easing: step.easing ?? bundle.easing,
          fill: 'forwards',
        })
        animations.add(anim)
      }
      cursorMs = delay + duration
    }
  }

  if (getCurrentScope()) onScopeDispose(kill)
  return { play, kill }
}

// Native IntersectionObserver Scroll Reveal (zero GSAP)
export interface FsusScrollRevealOptions extends Omit<MotionRunOptions, 'name'> {
  name?: MotionPresetName
  threshold?: number
  rootMargin?: string
  once?: boolean
}

export const useFsusScrollReveal = (defaults: FsusScrollRevealOptions = {}) => {
  const observers = new Set<IntersectionObserver>()
  const elements = new Set<HTMLElement>()

  const disconnect = () => {
    for (const obs of observers) obs.disconnect()
    observers.clear()
    for (const el of elements) cancelMotion(el)
    elements.clear()
  }

  const observe = (target: FsusMotionTarget, overrides: FsusScrollRevealOptions = {}) => {
    const el = toHtmlElement(target)
    if (!el) return () => undefined
    const opts = { ...defaults, ...overrides }
    elements.add(el)

    if (typeof IntersectionObserver === 'undefined' || isMotionReducedOrDisabled(opts.disabled)) {
      runMotion(el, { ...opts, name: opts.name ?? 'surface-settle' })
      return () => cancelMotion(el)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          runMotion(el, { ...opts, name: opts.name ?? 'surface-settle' })
          if (opts.once !== false) {
            observer.unobserve(el)
          }
        }
      },
      { threshold: opts.threshold ?? 0.1, rootMargin: opts.rootMargin ?? '0px 0px -8% 0px' },
    )
    observer.observe(el)
    observers.add(observer)

    return () => {
      observer.disconnect()
      observers.delete(observer)
      cancelMotion(el)
      elements.delete(el)
    }
  }

  if (getCurrentScope()) onScopeDispose(disconnect)
  return { observe, disconnect }
}

// Native Scroll-Driven Progress Timeline (replaces GSAP ScrollTrigger scrub)
export interface FsusScrollTimelineSegment {
  target?: FsusMotionTarget
  from: number
  to: number
  recipe?: MotionRecipeName
  onProgress?: (progress: number, el: HTMLElement) => void
}

export interface FsusScrollTimelineOptions {
  target?: FsusMotionTarget
  segments?: FsusScrollTimelineSegment[]
  disabled?: boolean
}

export const useFsusScrollTimeline = (defaults: FsusScrollTimelineOptions = {}) => {
  const progress = ref(0)
  let cleanup: (() => void) | undefined

  const kill = () => {
    cleanup?.()
    cleanup = undefined
  }

  const create = (overrides: FsusScrollTimelineOptions = {}) => {
    kill()
    const opts = { ...defaults, ...overrides }
    const triggerEl = toHtmlElement(opts.target)
    if (!triggerEl || typeof window === 'undefined') return

    const segments = opts.segments ?? []
    const applyProgress = (p: number) => {
      const clamped = Math.min(1, Math.max(0, p))
      progress.value = clamped
      for (const seg of segments) {
        const segEl = toHtmlElement(seg.target ?? opts.target)
        if (!segEl) continue
        const span = Math.max(seg.to - seg.from, 0.001)
        const local = Math.min(1, Math.max(0, (clamped - seg.from) / span))
        seg.onProgress?.(local, segEl)
      }
    }

    if (isMotionReducedOrDisabled(opts.disabled)) {
      applyProgress(1)
      return
    }

    let rafId = 0
    const onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        const rect = triggerEl.getBoundingClientRect()
        const vh = window.innerHeight || 1
        const total = vh + rect.height
        const p = total > 0 ? (vh - rect.top) / total : 1
        applyProgress(p)
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll()

    cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }

  if (getCurrentScope()) onScopeDispose(kill)
  return { progress, create, kill }
}

// Unified Row / Task / Route helpers
export const useFsusTaskFeedback = () => {
  const trigger = (target: FsusMotionTarget, phase: 'pending' | 'settled' | 'error') => {
    const el = toHtmlElement(target)
    if (!el) return
    const recipe: MotionRecipeName =
      phase === 'pending'
        ? 'state-pending'
        : phase === 'error'
          ? 'state-error'
          : 'state-settled'
    runMotionRecipe(el, recipe)
  }
  return { trigger }
}

export const useFsusMotionRouteCleanup = () => {
  const tracked = new Set<HTMLElement>()
  const register = (el: HTMLElement | null | undefined) => {
    if (el) tracked.add(el)
  }
  const cleanup = () => {
    for (const el of tracked) cancelMotion(el)
    tracked.clear()
  }
  if (getCurrentScope()) onScopeDispose(cleanup)
  return { register, cleanup }
}
