---
'element-plus': patch
'@element-plus/components': patch
---

fix(markdown-editor): keep noncollapsed Focus selections and search ranges half-open so blocks touching only an excluded endpoint are no longer marked active or exempt. Preserve collapsed caret, document-end fallback, and point-search attribution.
