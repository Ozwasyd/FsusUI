---
'element-plus': patch
---

Provide an optional scrollable body mode with fixed title and action footer in
`FsusDialog` for Avalonia desktop applications. When `IsBodyScrollable` is
enabled, dialog height is bounded by the owner or overlay viewport and optional
`MaxBodyHeight`, scrolling only the body content while keeping Title and Footer
visible and fixed. Supports keyboard navigation (`PageUp`/`PageDown`) and
automatic scroll-into-view on focus (`Tab` navigation) without losing focus.
The default dialog composition when `IsBodyScrollable` is disabled remains
unchanged.
