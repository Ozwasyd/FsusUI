import { getCurrentScope, onScopeDispose } from 'vue'
import { getGsap } from '../gsap/register'
import {
  getGsapPresetVars,
  resolveMotionTarget,
  sanitizeGsapVars,
} from '../gsap/resolve'
import { isMotionReducedOrDisabled } from '../runtime'
import type { MotionTarget } from '../gsap/resolve'
import type { MotionPresetName } from '../types'

export type MotionTimelineStep = {
  target: MotionTarget
  preset?: MotionPresetName
  duration?: string | number
  position?: gsap.Position
  from?: gsap.TweenVars
  to?: gsap.TweenVars
  vars?: gsap.TweenVars
}

export type UseTimelineOptions = {
  disabled?: boolean
  paused?: boolean
  timeline?: gsap.TimelineVars
}

const defaultTimelinePreset: MotionPresetName = 'fade-up'

export const useTimeline = (options: UseTimelineOptions = {}) => {
  const gsap = getGsap()
  const timeline = gsap.timeline({
    paused: options.paused ?? true,
    ...options.timeline,
  })

  const add = (step: MotionTimelineStep) => {
    const target = resolveMotionTarget(step.target)
    if (!target) return controls

    const preset = getGsapPresetVars(
      step.preset || defaultTimelinePreset,
      step.duration,
    )
    const fromVars = {
      ...sanitizeGsapVars(preset.from),
      ...step.from,
    }
    const toVars = {
      ...sanitizeGsapVars(preset.to),
      duration: preset.duration,
      ease: preset.ease,
      ...step.vars,
      ...step.to,
    }

    if (isMotionReducedOrDisabled(options.disabled)) {
      gsap.set(target, {
        ...sanitizeGsapVars(preset.to),
        ...step.to,
      })
      return controls
    }

    timeline.fromTo(target, fromVars, toVars, step.position)
    return controls
  }

  const kill = () => {
    timeline.kill()
  }

  const controls = {
    timeline,
    add,
    play: () => timeline.play(),
    pause: () => timeline.pause(),
    reverse: () => timeline.reverse(),
    restart: () => timeline.restart(),
    clear: () => {
      timeline.clear()
      return controls
    },
    kill,
  }

  if (getCurrentScope()) {
    onScopeDispose(kill)
  }

  return controls
}

export default useTimeline
