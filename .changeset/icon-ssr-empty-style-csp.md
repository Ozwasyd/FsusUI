---
'element-plus': patch
---

Omit the empty `style` attribute that `ElIcon` used to emit during server-side rendering when neither `size` nor `color` is set, so pages served under a CSP `style-src-attr 'none'` policy no longer report a violation for every default icon (#773).
