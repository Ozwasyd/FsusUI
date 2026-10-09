---
'@ozwasyd/element-plus': patch
---

Keep MarkdownRenderer's canonical projection reuse behind the heavy-feature lazy boundary so initial Markdown hydration does not pay for the cache implementation.
