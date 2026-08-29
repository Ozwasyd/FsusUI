---
'element-plus': patch
---

Fix `FsusThemeManager` so `{DynamicResource FsusColorActionPrimaryBrush}` in Avalonia refreshes when the theme variant changes. The brush now follows the variant palette: light resolves to `#2A599C` and dark to the documented Scholarly Blue `#4B79CC`, with an explicit `AccentOverride` still taking precedence. Avalonia consumers no longer need an application-local selection brush to keep action-primary surfaces in sync with the dark palette.
