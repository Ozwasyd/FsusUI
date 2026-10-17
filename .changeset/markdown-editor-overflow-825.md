---
'element-plus': patch
---

Keep the MarkdownEditor overflow trigger outside the horizontal command scroller so it remains reachable without an offscreen sticky control during page scrolling. Bound long overflow labels to preserve usable primary-command space in narrow layouts. Preserve command/action counts, full accessible labels, and existing toolbar profile semantics.
