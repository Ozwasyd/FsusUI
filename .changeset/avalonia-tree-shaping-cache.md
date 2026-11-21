---
'element-plus': patch
---

Retain per-label shaped text runs across identical Tree remounts to avoid
reshaping every unchanged default label during compositor updates. Stock
TextBlock layout/rendering and complex-content fallbacks remain intact, and
shaped buffers are released after a label actually leaves the visual tree.
