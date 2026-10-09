import Cascader from './src/cascader.vue'
import type { App } from 'vue'
import {
  registerFsusDefaultRenderPipelineComponentPolicies,
  type SFCWithInstall,
} from '@element-plus/utils'

Cascader.install = (app: App): void => {
  registerFsusDefaultRenderPipelineComponentPolicies([Cascader])
  app.component(Cascader.name!, Cascader)
}

const _Cascader = Cascader as SFCWithInstall<typeof Cascader>

export default _Cascader
export const ElCascader: SFCWithInstall<typeof Cascader> = _Cascader

export * from './src/cascader'
export * from './src/instances'
