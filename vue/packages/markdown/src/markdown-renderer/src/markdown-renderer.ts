import { buildProps } from '../../internal/bridge'

import type { ExtractPropTypes, PropType } from 'vue'
import type {
  MarkdownFeatureActivationFeatureOptions,
  MarkdownRenderMode,
  MarkdownSafeHtml,
  MarkdownSafeRenderResult,
} from '@fsusui/wasm'

export type MarkdownTrustedHtml = object
export type MarkdownTrustedHtmlFactory = (
  safeHtml: MarkdownSafeHtml,
) => MarkdownTrustedHtml
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
  loadingText: {
    type: String,
    default: 'Rendering markdown...',
  },
  initialRender: {
    type: Object as PropType<MarkdownSafeRenderResult | null>,
    default: null,
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
} as const)

export type MarkdownRendererProps = ExtractPropTypes<
  typeof markdownRendererProps
>

export interface MarkdownFragmentLocateResult {
  readonly found: boolean
  readonly mounted: boolean
  readonly id: string
  readonly fragment: string
  readonly chunkIndex: number
  readonly chunkKey: string | null
  readonly element: HTMLElement | null
}

export interface MarkdownFragmentRevealOptions {
  readonly behavior?: ScrollBehavior
  readonly block?: ScrollLogicalPosition
}

export interface MarkdownFragmentRevealResult {
  readonly ok: boolean
  readonly id: string
  readonly fragment: string
  readonly chunkIndex: number
  readonly chunkKey: string | null
  readonly element: HTMLElement | null
}
