---
'element-plus': patch
---

Keep ImageViewer loading tied to the current active image and protect its indexed
image refs from stale keyed callbacks, while retaining localized error alt text.
