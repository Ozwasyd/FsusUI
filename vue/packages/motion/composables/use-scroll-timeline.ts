import { getCurrentScope, onScopeDispose } from 'vue'
import {
  getGsap,
  refreshScrollTriggers,
  registerScrollTrigger,
} from '../gsap/register'
import {
  getGsapPresetVars,
  resolveMotionTarget,
  sanitizeGsapVars,
  toGsapScrubSeconds,
} from '../gsap/resolve'
import { normalizeMotionRecipeOptions } from '../recipes'
import { isMotionReducedOrDisabled } from '../runtime'
import type { MotionTarget } from '../gsap/resolve'
import type { MotionRecipeName } from '../types'

export type ScrollTimelineSegment = {
  target?: MotionTarget
  from: number
  to: number
  recipe?: MotionRecipeName
  duration?: string | number
  vars?: gsap.TweenVars
  fromVars?: gsap.TweenVars
  toVars?: gsap.TweenVars
}

export type UseScrollTimelineOptions = {
  target?: MotionTarget
  segments?: ScrollTimelineSegment[]
  disabled?: boolean
  once?: boolean
  start?: string
  end?: string
  // Scrub smoothing: boolean for on/off, number/string for smoothing in
  // seconds. Strings may carry an 'ms'/'s' suffix and are normalized via
  // toGsapScrubSeconds.
  scrub?: boolean | number | string
  scroller?: Element | Window | string
  markers?: boolean
  mode?: 'natural'
  reducedFallback?: 'terminal'
  // Caller-supplied ScrollTrigger overrides. `pin` and `snap` are passed
  // through to gsap verbatim when provided; the safe defaults (pin: false,
  // snap: undefined) only apply when the caller omits them.
  scrollTrigger?: ScrollTrigger.StaticVars
}

const clampProgress = (value: number) => Math.min(Math.max(value, 0), 1)

export const useScrollTimeline = (defaults: UseScrollTimelineOptions = {}) => {
  const gsap = getGsap()
  const timelines = new Set<gsap.core.Timeline>()

  const create = (overrides: UseScrollTimelineOptions = {}) => {
    const options = {
      ...defaults,
      ...overrides,
      segments: overrides.segments ?? defaults.segments ?? [],
    }
    const trigger = resolveMotionTarget(options.target)
    if (!trigger) return undefined

    const resolvedSegments = options.segments
      .map((segment) => ({
        ...segment,
        from: clampProgress(segment.from),
        to: clampProgress(segment.to),
      }))
      .filter((segment) => segment.to >= segment.from)

    if (resolvedSegments.length === 0) return undefined

    if (isMotionReducedOrDisabled(options.disabled)) {
      for (const segment of resolvedSegments) {
        const target = resolveMotionTarget(segment.target ?? options.target)
        if (!target) continue
        const recipeOptions = normalizeMotionRecipeOptions(
          segment.recipe ?? 'content-enter',
        )
        const preset = getGsapPresetVars(
          recipeOptions.name,
          segment.duration ?? recipeOptions.duration,
        )
        gsap.set(target as gsap.TweenTarget, {
          ...sanitizeGsapVars(preset.to),
          ...segment.toVars,
          ...segment.vars,
        })
      }
      return undefined
    }

    registerScrollTrigger()

    // Respect caller-supplied pin/snap. The safe defaults only kick in
    // when the caller omits them; explicit values pass through.
    const callerScrollTrigger = options.scrollTrigger ?? {}
    const rest: ScrollTrigger.StaticVars = { ...callerScrollTrigger }
    delete rest.pin
    delete rest.snap
    const pin = callerScrollTrigger.pin ?? false
    const snap = callerScrollTrigger.snap

    const timeline = gsap.timeline({
      paused: false,
      scrollTrigger: {
        trigger,
        start: options.start || 'top 90%',
        end: options.end || 'bottom 10%',
        scrub: toGsapScrubSeconds(options.scrub ?? true),
        once: options.once,
        scroller: options.scroller,
        markers: options.markers,
        ...rest,
        pin,
        snap,
      },
    })

    for (const segment of resolvedSegments) {
      const target = resolveMotionTarget(segment.target ?? options.target)
      if (!target) continue

      const recipeOptions = normalizeMotionRecipeOptions(
        segment.recipe ?? 'content-enter',
      )
      const preset = getGsapPresetVars(
        recipeOptions.name,
        segment.duration ?? recipeOptions.duration,
      )

      timeline.fromTo(
        target as gsap.TweenTarget,
        {
          ...sanitizeGsapVars(preset.from),
          ...segment.fromVars,
        },
        {
          ...sanitizeGsapVars(preset.to),
          duration: Math.max(segment.to - segment.from, 0.001),
          ease: preset.ease,
          ...segment.vars,
          ...segment.toVars,
        },
        segment.from,
      )
    }

    timelines.add(timeline)
    return timeline
  }

  const kill = () => {
    for (const timeline of timelines) {
      timeline.scrollTrigger?.kill()
      timeline.kill()
    }
    timelines.clear()
  }

  const controls = {
    create,
    kill,
    refresh: refreshScrollTriggers,
    timelines,
  }

  if (getCurrentScope()) {
    onScopeDispose(kill)
  }

  return controls
}

export default useScrollTimeline
