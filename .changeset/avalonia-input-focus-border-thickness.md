---
'element-plus': patch
---

Fix the Avalonia focus styles so they bind `BorderThickness` to a typed
`FsusThemeFocusBorderThickness` (`Thickness`, 2 in Light/Dark, 3 in
HighContrast) instead of the double-typed `FsusThemeFocusThickness`
resource, which threw `InvalidCastException` when `FsusInput`,
`FsusTextarea`, or `FsusInputNumber` gained focus.
