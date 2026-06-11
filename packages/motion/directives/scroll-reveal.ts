import { normalizeMotionOptions } from '../runtime'
import { useScrollReveal } from '../composables/use-scroll-reveal'
import type { Directive, DirectiveBinding } from 'vue'
import type { ScrollRevealOptions } from '../composables/use-scroll-reveal'
import type { MotionDirectiveValue } from '../types'

type ScrollRevealDirectiveElement = HTMLElement & {
  __fsusScrollReveal?: ReturnType<typeof useScrollReveal>
}

const resolveDirectiveOptions = (
  binding: DirectiveBinding<MotionDirectiveValue>,
): ScrollRevealOptions => normalizeMotionOptions(binding.value)

const applyScrollReveal = (
  el: ScrollRevealDirectiveElement,
  binding: DirectiveBinding<MotionDirectiveValue>,
) => {
  el.__fsusScrollReveal?.kill()

  const options = resolveDirectiveOptions(binding)
  el.dataset.fsusScrollRevealPreset = options.name

  const controls = useScrollReveal({
    ...options,
    target: el,
  })
  controls.reveal()
  el.__fsusScrollReveal = controls
}

export const vScrollReveal: Directive<
  ScrollRevealDirectiveElement,
  MotionDirectiveValue
> = {
  mounted(el, binding) {
    applyScrollReveal(el, binding)
  },
  updated(el, binding) {
    if (binding.value === binding.oldValue) return
    applyScrollReveal(el, binding)
  },
  beforeUnmount(el) {
    el.__fsusScrollReveal?.kill()
    delete el.__fsusScrollReveal
  },
}

export default vScrollReveal
