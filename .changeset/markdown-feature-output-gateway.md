---
'element-plus': major
---

BREAKING: Remove the public DOM-mutating Markdown feature adapters and the
`mermaidAdapter`, `latexAdapter`, and `codeHighlightAdapter` renderer props.
Mermaid, KaTeX, and Shiki now render immutable source into discriminated feature
outputs that pass through one FsusUI-owned, kind-specific output gateway.
Narrow broad package deep exports to documented compatibility directories and
encapsulate generated WASM/runtime internals. Consumers must use the root
package, `/wasm`, `/markdown-runtime`, documented component or locale paths, or
`theme-chalk/*`.
