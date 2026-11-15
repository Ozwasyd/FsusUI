---
'element-plus': patch
---

Immediately abort pending Markdown heavy-feature activation when the shared theme changes, before the debounced rerender, including runtime import and adapter work while retaining unmount cleanup.

Retain shared-theme invalidation during replacement parsing and reject completion events from aborted or superseded renders while preserving resource teardown.
