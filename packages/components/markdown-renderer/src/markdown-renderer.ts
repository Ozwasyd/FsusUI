import { buildProps } from '@element-plus/utils'

import type { ExtractPropTypes, PropType } from 'vue'
import type { MarkdownRenderMode } from '@element-plus/wasm'

export const markdownRendererProps = buildProps({
  content: {
    type: String,
    default: '',
  },
  initialHtml: {
    type: String,
    default: '',
  },
  allowHtml: {
    type: Boolean,
    default: false,
  },
  allowLatex: {
    type: Boolean,
    default: true,
  },
  allowMermaid: {
    type: Boolean,
    default: true,
  },
  mode: {
    type: String as PropType<MarkdownRenderMode>,
    values: ['article', 'about', 'preview', 'editor'],
    default: 'article',
  },
  baseUrl: {
    type: String as PropType<string | null>,
    default: null,
  },
} as const)

export type MarkdownRendererProps = ExtractPropTypes<
  typeof markdownRendererProps
>
