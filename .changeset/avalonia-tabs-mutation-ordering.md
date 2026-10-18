---
'element-plus': patch
---

Defer Avalonia `FsusTabs` pane selection synchronization until its `ItemsSource`
has processed collection changes, preventing an out-of-range selection-model
reentry when removing or reordering a selected desktop document tab.

Preserve the active pane and its actual header focus when a preselected pane is
added to a mounted strip or replaces an inactive pane, while keeping subsequent
explicit and native selection changes authoritative.
