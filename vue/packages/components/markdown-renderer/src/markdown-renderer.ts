import { buildProps } from '@element-plus/utils'

import type { ExtractPropTypes, PropType } from 'vue'
import type {
  MarkdownFeatureAdapter,
  MarkdownFeatureActivationFeatureOptions,
  MarkdownRenderMode,
} from '@element-plus/wasm'

export type MarkdownTrustedHtmlFactory = (sanitizedHtml: string) => unknown
export type MarkdownTrustedScriptUrlFactory = (moduleUrl: URL) => unknown

export const resolveMarkdownWorkerScriptUrl = (
  moduleUrl: URL,
  trustedScriptUrlFactory?: MarkdownTrustedScriptUrlFactory,
) => trustedScriptUrlFactory?.(moduleUrl) ?? moduleUrl

export const markdownRendererProps = buildProps({
  content: {
    type: String,
    default: '',
  },
  contentVersion: {
    type: [String, Number] as PropType<string | number | null>,
    default: null,
  },
  initialHtml: {
    type: String,
    default: '',
  },
  allowHtml: {
    type: Boolean,
    default: false,
  },
  sanitizeHtml: {
    type: Boolean,
    default: true,
  },
  trustedHtmlFactory: {
    type: Function as PropType<MarkdownTrustedHtmlFactory>,
    default: undefined,
  },
  trustedScriptUrlFactory: {
    type: Function as PropType<MarkdownTrustedScriptUrlFactory>,
    default: undefined,
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
  cspNonce: {
    type: String as PropType<string | null>,
    default: null,
  },
  features: {
    type: Object as PropType<MarkdownFeatureActivationFeatureOptions>,
    default: undefined,
  },
  mermaidAdapter: {
    type: Function as unknown as PropType<MarkdownFeatureAdapter | null>,
    default: undefined,
  },
  latexAdapter: {
    type: Function as unknown as PropType<MarkdownFeatureAdapter | null>,
    default: undefined,
  },
  codeHighlightAdapter: {
    type: Function as unknown as PropType<MarkdownFeatureAdapter | null>,
    default: undefined,
  },
} as const)

export type MarkdownRendererProps = ExtractPropTypes<
  typeof markdownRendererProps
>
