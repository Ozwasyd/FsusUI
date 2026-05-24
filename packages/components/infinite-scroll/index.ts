import InfiniteScroll from './src'

import type { App } from 'vue'
import {
  registerFsusRenderPipelineComponentPolicyByName,
  type SFCWithInstall,
} from '@element-plus/utils'

const _InfiniteScroll = InfiniteScroll as SFCWithInstall<typeof InfiniteScroll>

_InfiniteScroll.install = (app: App) => {
  registerFsusRenderPipelineComponentPolicyByName('ElInfiniteScroll')
  app.directive('InfiniteScroll', _InfiniteScroll)
}

export default _InfiniteScroll
export const ElInfiniteScroll = _InfiniteScroll
