---
'element-plus': major
---

BREAKING: Remove the Markdown raw HTML capability and the public sanitizer and
cache escape hatches. `MarkdownRenderer` and `MarkdownEditor` no longer accept
`allowHtml`, the Markdown Wasm ABI no longer accepts `allow_html`, and raw HTML
is always rendered as escaped text.

Replace `initialHtml` and `sanitizeHtml` integrations with a runtime-authorized
`initialRender`. `trustedHtmlFactory` now receives `MarkdownSafeHtml`, and
consumers must rebuild Wasm callers against the new ABI.
