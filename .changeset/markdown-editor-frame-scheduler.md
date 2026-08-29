---
'element-plus': patch
---

Route the MarkdownEditor surface and its live renderer through one editor-owned frame scheduler: layout reads commit in the measure phase, geometry writes in the mutate phase, and same-frame viewport restores coalesce with stale-task cancellation on document switch. Prevents read-after-write layout thrashing as editor features grow. No public API changes.
