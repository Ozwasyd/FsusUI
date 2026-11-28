import type { Directive } from 'vue'
import { cancelMotion, normalizeMotionOptions, runMotion } from './runtime'
import type { MotionDirectiveValue, MotionPresetName } from './types'

export const vFsusMotion: Directive<HTMLElement, MotionDirectiveValue> = {
  mounted(el, binding) {
    const options = normalizeMotionOptions(binding.value)
    if (options.disabled) return
    runMotion(el, options)
  },
  updated(el, binding) {
    if (binding.value === binding.oldValue) return
    const options = normalizeMotionOptions(binding.value)
    if (options.disabled) {
      cancelMotion(el)
      return
    }
    runMotion(el, options)
  },
  beforeUnmount(el) {
    cancelMotion(el)
  },
}

const revealObservers = new WeakMap<HTMLElement, IntersectionObserver>()

export const vFsusScrollReveal: Directive<
  HTMLElement,
  MotionDirectiveValue | { name?: MotionPresetName; threshold?: number; once?: boolean }
> = {
  mounted(el, binding) {
    const raw = binding.value
    const opts = normalizeMotionOptions(raw as MotionDirectiveValue, 'surface-settle')
    if (opts.disabled || typeof IntersectionObserver === 'undefined') {
      if (!opts.disabled) runMotion(el, opts)
      return
    }
    const threshold =
      raw && typeof raw === 'object' && 'threshold' in raw ? (raw.threshold ?? 0.1) : 0.1
    const once = raw && typeof raw === 'object' && 'once' in raw ? raw.once !== false : true
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          runMotion(el, opts)
          if (once) observer.unobserve(el)
        }
      },
      { threshold },
    )
    observer.observe(el)
    revealObservers.set(el, observer)
  },
  beforeUnmount(el) {
    revealObservers.get(el)?.disconnect()
    revealObservers.delete(el)
    cancelMotion(el)
  },
}
