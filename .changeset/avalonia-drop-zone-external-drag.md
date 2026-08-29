---
'element-plus': patch
---

Add an external drag-over contract to the Avalonia `FsusDropZone`. `SetExternalDragOver(bool)` lets a window-level proxy surface — such as a centered drop overlay with `IsHitTestVisible=false` — drive the same drag-over visual state and automation status as native routed drag events without raising drop or browse events. The external state resets when the zone becomes disabled, enters loading, processes a drop, or detaches from the visual tree.
