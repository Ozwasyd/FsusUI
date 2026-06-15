import { getCurrentScope, onScopeDispose } from 'vue'
import {
  getGsap,
  killScrollTriggersFor,
  refreshScrollTriggers,
  registerScrollTrigger,
} from '../gsap/register'
import {
  getGsapPresetVars,
  resolveMotionTarget,
  sanitizeGsapVars,
} from '../gsap/resolve'
import { isMotionReducedOrDisabled } from '../runtime'
import type { MotionTarget } from '../gsap/resolve'
import type { MotionPresetInput, MotionPresetName } from '../types'

export type ScrollRevealOptions = {
  target?: MotionTarget
  name?: MotionPresetInput
  duration?: string | number
  disabled?: boolean
  once?: boolean
  start?: string
  end?: string
  markers?: boolean
  scrub?: boolean | number
  scroller?: Element | Window | string
  vars?: gsap.TweenVars
  scrollTrigger?: ScrollTrigger.StaticVars
}

export type ScrollRevealRunOptions = Omit<ScrollRevealOptions, 'target'>

const defaultScrollRevealPreset: MotionPresetName = 'paper-settle'

const applyReducedState = (
  target: ReturnType<typeof resolveMotionTarget>,
  vars: gsap.TweenVars,
  fallback: (target: gsap.TweenTarget, vars: gsap.TweenVars) => void,
) => {
  if (target instanceof Element && 'style' in target) {
    const element = target as HTMLElement | SVGElement
    if (vars.opacity !== undefined) element.style.opacity = String(vars.opacity)
    if (typeof vars.transform === 'string')
      element.style.transform = vars.transform
    if (typeof vars.filter === 'string') element.style.filter = vars.filter
    return
  }

  fallback(target as gsap.TweenTarget, vars)
}

export const useScrollReveal = (defaults: ScrollRevealOptions = {}) => {
  const gsap = getGsap()
  const tweens = new Set<gsap.core.Tween>()

  const reveal = (
    target: MotionTarget = defaults.target,
    overrides: ScrollRevealRunOptions = {},
  ) => {
    const options = {
      ...defaults,
      ...overrides,
    }
    const resolvedTarget = resolveMotionTarget(target)
    if (!resolvedTarget) return undefined

    const preset = getGsapPresetVars(
      options.name || defaultScrollRevealPreset,
      options.duration,
    )
    const finalVars = {
      ...sanitizeGsapVars(preset.to),
      ...options.vars,
    }

    if (isMotionReducedOrDisabled(options.disabled)) {
      applyReducedState(resolvedTarget, finalVars, gsap.set)
      return undefined
    }

    registerScrollTrigger()

    const trigger = options.scrollTrigger?.trigger || resolvedTarget
    const tween = gsap.fromTo(resolvedTarget, sanitizeGsapVars(preset.from), {
      ...finalVars,
      duration: preset.duration,
      ease: preset.ease,
      scrollTrigger: {
        trigger,
        start: options.start || 'top 85%',
        end: options.end,
        once: options.once ?? true,
        markers: options.markers,
        scrub: options.scrub,
        scroller: options.scroller,
        toggleActions:
          (options.once ?? true)
            ? 'play none none none'
            : 'play reverse play reverse',
        ...options.scrollTrigger,
      },
    })

    tweens.add(tween)
    return tween
  }

  const kill = () => {
    for (const tween of tweens) {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
    tweens.clear()

    const target = resolveMotionTarget(defaults.target)
    if (target instanceof Element) {
      killScrollTriggersFor(target)
    }
  }

  const controls = {
    reveal,
    kill,
    refresh: refreshScrollTriggers,
    tweens,
  }

  if (getCurrentScope()) {
    onScopeDispose(kill)
  }

  return controls
}

export default useScrollReveal
