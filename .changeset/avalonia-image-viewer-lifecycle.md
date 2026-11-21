---
'element-plus': patch
---

Fix Avalonia `FsusImageViewer` lifecycle handling so clearing observable sources
cancels pending loads and releases owned content, late results cannot restore a
cleared or disposed viewer, and shrinking a gallery keeps the active index and
accessible image status consistent. Closing during a pending load now allows a
fresh load when reopening the same source; disposal detaches source notifications
and prevents further loading or reopening.
