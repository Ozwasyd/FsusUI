import { Loading } from './src/service'
import { vLoading } from './src/directive'
import { registerFsusRenderPipelineComponentPolicyByName } from '@element-plus/utils'

import type { App } from 'vue'

// installer and everything in all
export const ElLoading = {
  install(app: App) {
    registerFsusRenderPipelineComponentPolicyByName('ElLoading')
    app.directive('loading', vLoading)
    app.provide('elLoadingService', (options = {}) =>
      Loading(options, app._context),
    )
    app.config.globalProperties.$loading = (options = {}) =>
      Loading(options, app._context)
  },
  directive: vLoading,
  service: Loading,
}

export default ElLoading
export { vLoading, vLoading as ElLoadingDirective, Loading as ElLoadingService }

export * from './src/types'
