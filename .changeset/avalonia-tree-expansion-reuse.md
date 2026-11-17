---
'element-plus': patch
---

Retain unaffected Avalonia tree rows during programmatic expansion and collapse,
updating only changed row contexts and newly visible children. Explicit view
refreshes, filtered trees, and inline editing retain their full refresh behavior.
