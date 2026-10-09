import type { MarkdownSafeHtml as WasmSafeHtml } from '@ozwasyd/element-plus/wasm'
import type { MarkdownSafeHtml as RuntimeSafeHtml } from '@ozwasyd/element-plus/markdown-runtime'
import type { MarkdownRendererProps } from '@ozwasyd/element-plus'
// @ts-expect-error legacy DOM-mutating feature adapters are removed
import type { MarkdownFeatureAdapter } from '@ozwasyd/element-plus/markdown-runtime'
// @ts-expect-error internal Markdown feature output gateway is blocked by package exports
import type { FeatureRenderOutput } from '@ozwasyd/element-plus/es/wasm/markdown-feature-output-gateway'
declare const wasmSafe: WasmSafeHtml
declare const rendererProps: MarkdownRendererProps
const runtimeSafe: RuntimeSafeHtml = wasmSafe
void runtimeSafe
// @ts-expect-error Mermaid adapter prop is removed
rendererProps.mermaidAdapter
// @ts-expect-error LaTeX adapter prop is removed
rendererProps.latexAdapter
// @ts-expect-error code highlight adapter prop is removed
rendererProps.codeHighlightAdapter
// @ts-expect-error plain strings must never satisfy the published safe HTML brand
const unsafe: RuntimeSafeHtml = '<p>unsafe</p>'
void unsafe
