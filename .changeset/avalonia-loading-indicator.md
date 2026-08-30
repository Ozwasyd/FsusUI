---
'element-plus': patch
---

Add a standalone `FsusLoadingIndicator` primitive for Avalonia compact async surfaces such as search fields and command palettes. `IsActive` shows or hides the indicator, `IsIndeterminate` switches between an indeterminate arc and a `Value`-driven determinate stroke, sizing fits 16-24 px placements beside fields or inline with text, and colors resolve through theme tokens. It exposes the progress-bar control type with a stable accessible name and `loading`/`idle` item status instead of announcing animation frames, and honors reduced motion through the `FsusMotionModeCurrent` theme resource or its own `ReducedMotion` flag.
