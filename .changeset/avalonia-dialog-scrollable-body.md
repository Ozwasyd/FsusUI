---
'element-plus': patch
---

Provide an optional scrollable body mode with fixed title and action footer in
`FsusDialog` and `FsusModalSurface` for Avalonia desktop applications. When
`IsBodyScrollable` is enabled, dialog height is bounded by viewport constraints
or owner window height (e.g. 480px), scrolling only the body content while
keeping Title and Footer visible and fixed. Supports keyboard navigation
(`PageUp`/`PageDown`) and automatic scroll-into-view on focus (`Tab` navigation)
without losing focus. Unconstrained dialog layout when `IsBodyScrollable` is
disabled remains strictly unchanged.
