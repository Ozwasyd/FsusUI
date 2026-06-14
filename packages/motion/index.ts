import FsuTransition from './components/FsuTransition.vue'
import FsuMotionRecipe from './components/FsuMotionRecipe.vue'
import FsuScrollTimeline from './components/FsuScrollTimeline.vue'
import FsuSharedElement from './components/FsuSharedElement.vue'
import FsuTaskReceipt from './components/FsuTaskReceipt.vue'
import FsuRowStateMotion from './components/FsuRowStateMotion.vue'
import { vMotion } from './directives/motion'
import { vScrollReveal } from './directives/scroll-reveal'
import { setMotionBudget } from './budget'
import type { App, Plugin } from 'vue'
import type { MotionPluginConfig } from './types'

export const createMotionPlugin = (
  config: MotionPluginConfig = {},
): Plugin => ({
  install(app: App) {
    if (config.budget) setMotionBudget(config.budget)
    app.directive('motion', vMotion)
    app.directive('scroll-reveal', vScrollReveal)
    app.component('FsuMotionRecipe', FsuMotionRecipe)
    app.component('FsuScrollTimeline', FsuScrollTimeline)
    app.component('FsuSharedElement', FsuSharedElement)
    app.component('FsuTaskReceipt', FsuTaskReceipt)
    app.component('FsuRowStateMotion', FsuRowStateMotion)
    app.component('FsuTransition', FsuTransition)
  },
})

export const FsuMotion = createMotionPlugin()

export {
  FsuMotionRecipe,
  FsuRowStateMotion,
  FsuScrollTimeline,
  FsuSharedElement,
  FsuTaskReceipt,
  FsuTransition,
  vMotion,
  vScrollReveal,
}
export * from './budget'
export * from './composables/use-gsap-context'
export * from './composables/use-flip-motion'
export * from './composables/use-motion-route-cleanup'
export * from './composables/use-motion-preference'
export * from './composables/use-row-state-motion'
export * from './composables/use-scroll-reveal'
export * from './composables/use-scroll-timeline'
export * from './composables/use-shared-element-motion'
export * from './composables/use-task-feedback'
export * from './composables/use-timeline'
export * from './directives/motion'
export * from './directives/scroll-reveal'
export * from './gsap/register'
export * from './gsap/resolve'
export * from './presets'
export * from './preference'
export * from './recipes'
export * from './runtime'
export * from './tokens'
export * from './types'

export default FsuMotion
