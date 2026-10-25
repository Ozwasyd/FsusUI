---
'element-plus': patch
---

Preserve the existing Button keyboard focus ring when hover and focus-visible
coexist on a coarse pointer device. Limit hover ring suppression to buttons
without focus-visible, retaining the existing non-keyboard focus rule.
