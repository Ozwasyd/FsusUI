import { withInstall } from '@element-plus/utils'

import MarkdownEditor from './src/markdown-editor.vue'

export const ElMarkdownEditor = withInstall(MarkdownEditor)
export default ElMarkdownEditor

export * from './src/markdown-editor'

export {
  currentMarkdownAnchors,
  planMarkdownAnchorInsert,
  planMarkdownAnchorEdit,
  planMarkdownAnchorRemove,
} from './src/markdown-editor-anchor-commands'
