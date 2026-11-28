import type { App, Component, Plugin } from 'vue'
import {
  installFsusConfig,
  isClient,
  syncThemeMode,
  vClickOutside,
  type FsusConfigContext,
} from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import { FsusMotionPlugin } from '@fsusui/motion'
import {
  fsusComponents,
  installFsusMessage,
  vFsusInfiniteScroll,
  vFsusLoading,
} from '@fsusui/components'
import { version } from './version'

export * from '@fsusui/core'
export * from '@fsusui/icons'
export * from '@fsusui/motion'
export * from '@fsusui/components'
export { FsusResult as FsusResultView } from '@fsusui/components'
export type { FsusResult } from '@fsusui/core'
export { version }

export interface FsusUIPluginOptions extends FsusConfigContext {
  components?: readonly Component[]
}

export const createFsusUI = (defaultOptions: FsusUIPluginOptions = {}): Plugin => ({
  install(app: App, runtimeOptions?: FsusUIPluginOptions) {
    const merged = { ...defaultOptions, ...runtimeOptions }
    const { components = fsusComponents, ...config } = merged

    installFsusConfig(app, config)
    installFsusMessage(app)
    if (config.themeMode && isClient) {
      syncThemeMode(config.themeMode)
    }

    app.directive('fsus-click-outside', vClickOutside)
    app.directive('fsus-loading', vFsusLoading)
    app.directive('fsus-infinite-scroll', vFsusInfiniteScroll)
    app.component('FsusIcon', FsusIcon)
    app.use(FsusMotionPlugin)

    for (const comp of components) {
      const name = (comp as { name?: string }).name
      if (name) app.component(name, comp)
    }
  },
})

export const FsusUI = createFsusUI()
export default FsusUI
