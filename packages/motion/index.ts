import FsuTransition from './components/FsuTransition.vue'
import { vMotion } from './directives/motion'
import { vScrollReveal } from './directives/scroll-reveal'
import type { App, Plugin } from 'vue'
import type { MotionPluginConfig } from './types'

export const createMotionPlugin = (
  config: MotionPluginConfig = {},
): Plugin => ({
  install(app: App) {
    void config
    app.directive('motion', vMotion)
    app.directive('scroll-reveal', vScrollReveal)
    app.component('FsuTransition', FsuTransition)
  },
})

export const FsuMotion = createMotionPlugin()

export { FsuTransition, vMotion, vScrollReveal }
export * from './composables/use-gsap-context'
export * from './composables/use-motion-route-cleanup'
export * from './composables/use-scroll-reveal'
export * from './composables/use-timeline'
export * from './directives/motion'
export * from './directives/scroll-reveal'
export * from './gsap/register'
export * from './gsap/resolve'
export * from './presets'
export * from './runtime'
export * from './tokens'
export * from './types'

export default FsuMotion
