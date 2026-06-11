import { cancelMotion, normalizeMotionOptions, runMotion } from '../runtime'
import type { Directive, DirectiveBinding } from 'vue'
import type { MotionDirectiveValue, MotionRunOptions } from '../types'

type MotionDirectiveElement = HTMLElement & {
  __fsusMotionValue?: MotionDirectiveValue
}

const readStaggerIndex = (el: HTMLElement) => {
  const explicitIndex = Number(el.dataset.fsusMotionIndex)
  if (Number.isFinite(explicitIndex)) return explicitIndex

  const parent = el.parentElement
  if (!parent) return 0

  return Array.from(parent.children).indexOf(el)
}

const resolveDirectiveOptions = (
  el: HTMLElement,
  binding: DirectiveBinding<MotionDirectiveValue>,
): MotionRunOptions => {
  const options = normalizeMotionOptions(binding.value)
  if (options.name !== 'list-stagger' || options.index !== undefined) {
    return options
  }

  return {
    ...options,
    index: readStaggerIndex(el),
  }
}

const applyDirectiveMotion = (
  el: MotionDirectiveElement,
  binding: DirectiveBinding<MotionDirectiveValue>,
) => {
  const options = resolveDirectiveOptions(el, binding)

  if (options.once && el.dataset.fsusMotionPlayed === 'true') return

  el.dataset.fsusMotionPreset = options.name
  runMotion(el, {
    ...options,
    phase: 'enter',
    onFinish: () => {
      el.dataset.fsusMotionPlayed = 'true'
    },
  })
}

export const vMotion: Directive<MotionDirectiveElement, MotionDirectiveValue> =
  {
    mounted(el, binding) {
      el.__fsusMotionValue = binding.value
      applyDirectiveMotion(el, binding)
    },
    updated(el, binding) {
      if (binding.value === binding.oldValue) return

      el.__fsusMotionValue = binding.value
      applyDirectiveMotion(el, binding)
    },
    beforeUnmount(el) {
      cancelMotion(el)
      delete el.__fsusMotionValue
    },
  }

export default vMotion
