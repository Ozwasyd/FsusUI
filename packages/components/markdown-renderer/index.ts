import { withInstall } from '@element-plus/utils'

import MarkdownRenderer from './src/markdown-renderer.vue'

export const ElMarkdownRenderer = withInstall(MarkdownRenderer)
export default ElMarkdownRenderer

export * from './src/markdown-renderer'
