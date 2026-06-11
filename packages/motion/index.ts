import FsuTransition from './components/FsuTransition.vue'
import { vMotion } from './directives/motion'
import type { App, Plugin } from 'vue'
import type { MotionPluginConfig } from './types'

export const createMotionPlugin = (
  config: MotionPluginConfig = {},
): Plugin => ({
  install(app: App) {
    void config
    app.directive('motion', vMotion)
    app.component('FsuTransition', FsuTransition)
  },
})

export const FsuMotion = createMotionPlugin()

export { FsuTransition, vMotion }
export * from './directives/motion'
export * from './presets'
export * from './runtime'
export * from './tokens'
export * from './types'

export default FsuMotion
