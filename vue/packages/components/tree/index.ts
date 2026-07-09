import Tree from './src/tree.vue'

import type { App } from 'vue'
import {
  registerFsusDefaultRenderPipelineComponentPolicies,
  type SFCWithInstall,
} from '@element-plus/utils'

Tree.install = (app: App): void => {
  registerFsusDefaultRenderPipelineComponentPolicies([Tree])
  app.component(Tree.name!, Tree)
}

const _Tree = Tree as SFCWithInstall<typeof Tree>

export default _Tree
export const ElTree = _Tree
export type { TreeNodeData } from './src/tree.type'
