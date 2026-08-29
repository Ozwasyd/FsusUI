---
'element-plus': patch
---

Enable `FsusImageViewer` in Avalonia to render `Sources` through an app-provided loader via `ImageLoader`, `IFsusImageLoader`, or `ContentFactory`. Exposes loading (`fsus-loading`), loaded (`fsus-loaded`), and error (`fsus-error`) states and CSS classes, manages asynchronous cancellation of in-flight loads, and disposes replaced content when `IDisposable`. Preserves modal overlay lifecycle, Escape dismiss, Left/Right gallery keyboard navigation, accessibility state, and focus restoration to opener controls.
