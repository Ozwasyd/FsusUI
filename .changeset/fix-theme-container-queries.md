---
'@element-plus/theme-chalk': patch
---

Preserve CSS `@container` queries in `theme-chalk` build output by replacing `clean-css` with `esbuild` for CSS minification, ensuring responsive container components such as `el-descriptions` remain properly scoped and do not leak stacked projections on desktop.
