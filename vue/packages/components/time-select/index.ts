import TimeSelect from './src/time-select.vue'

import type { App } from 'vue'
import {
  registerFsusDefaultRenderPipelineComponentPolicies,
  type SFCWithInstall,
} from '@element-plus/utils'

TimeSelect.install = (app: App): void => {
  registerFsusDefaultRenderPipelineComponentPolicies([TimeSelect])
  app.component(TimeSelect.name!, TimeSelect)
}

const _TimeSelect = TimeSelect as SFCWithInstall<typeof TimeSelect>

export default _TimeSelect
export const ElTimeSelect = _TimeSelect
