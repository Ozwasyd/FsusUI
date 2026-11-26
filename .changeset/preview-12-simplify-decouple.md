---
'element-plus': patch
'@element-plus/hooks': patch
'@element-plus/wasm': patch
---

- **Render Pipeline Scoped Context & Modularization (`#1135`)**: Modularize `use-render-pipeline` into 9 domain files and expose tree-shakeable scoped dependency injection (`createFsusRenderPipelineContext`, `provideFsusRenderPipelineContext`, `useFsusRenderPipelineContext`, `FSUS_RENDER_PIPELINE_CONTEXT_KEY`).
- **Markdown Editor, WASM Runtime, Theme & Cross-Platform Decoupling (`#1135`)**: Extract zero-Vue/zero-DOM `EditorKernel`, composables, and sub-surface SFCs from `ElMarkdownEditor`; split `wasm/markdown-runtime.ts` and `fsus-theme.scss` (byte-identical CSS) into focused modules; strip `@element-plus/test-utils` from production dependencies; and prepare public preview `1.6.0-preview.12`.
