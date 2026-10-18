---
'element-plus': patch
---

Defer Avalonia `FsusTabs` pane selection synchronization until its `ItemsSource`
has processed collection changes, preventing an out-of-range selection-model
reentry when removing or reordering a selected desktop document tab.
