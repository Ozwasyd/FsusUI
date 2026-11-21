---
'@ozwasyd/element-plus': patch
---

Populate all 36 dark-mode `--el-color-*-{light-3,light-5,light-7,light-8,light-9,dark-2}`
scale custom properties with integer RGB hex rounding, unify `var.scss` and
`fsus-theme.scss` dark/light `color-scheme` and dark-token activation selectors,
and suppress descendant CSS transitions via CSP-safe `data-fsus-theme-switching`
and `data-fsus-view-transition-snapshotting` attributes during `syncThemeMode`
and `runViewTransition` theme switches (#1107, #1106).
