import type { App } from 'vue'
import { vFsusMotion, vFsusScrollReveal } from './directives'
import {
  FsusBottomActionBar,
  FsusBottomTabBar,
  FsusMobileDock,
  FsusMotionRecipe,
  FsusOverlayTransition,
  FsusSharedElement,
  FsusSheetTransition,
  FsusTaskReceipt,
  FsusToastReceipt,
  FsusTransition,
} from './components'

export * from './types'
export * from './tokens'
export * from './presets'
export * from './recipes'
export * from './budget'
export * from './preference'
export * from './governance'
export * from './runtime'
export * from './view-transition'
export * from './physics'
export * from './composables'
export * from './directives'
export * from './components'

export const FsusMotionPlugin = {
  install(app: App) {
    app.directive('fsus-motion', vFsusMotion)
    app.directive('fsus-scroll-reveal', vFsusScrollReveal)
    for (const comp of [
      FsusTransition,
      FsusOverlayTransition,
      FsusSheetTransition,
      FsusMotionRecipe,
      FsusSharedElement,
      FsusTaskReceipt,
      FsusToastReceipt,
      FsusBottomActionBar,
      FsusBottomTabBar,
      FsusMobileDock,
    ]) {
      if (comp.name) app.component(comp.name, comp)
    }
  },
}
