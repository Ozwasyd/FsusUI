---
'element-plus': patch
---

Reuse unchanged plain Tree label measurement and arrangement sizes across
remounts while retaining TextBlock rendering, inherited typography and
accessibility. Changed constraints or text styling invalidate the cached sizes;
custom presenters and complex inline content continue through stock layout.
