---
'element-plus': patch
---

Preserve bare empty ATX headings in the canonical Markdown parser and outline, emit stable-node-bound empty-heading diagnostics, and use parser-owned outline content ranges.

Keep zero-to-three-space ATX indentation distinct from four-space/tab code, preserve blockquote-relative indentation and nesting, and retain empty-heading diagnostics for legally indented headings.
