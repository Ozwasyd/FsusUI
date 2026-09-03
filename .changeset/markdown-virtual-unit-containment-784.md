---
'@element-plus/theme-chalk': patch
---

Remove unconditional `contain: layout style paint` from `.markdown-renderer__virtual-unit` so that markdown content can participate in external CSS Grid and Subgrid reading tracks (#784).
