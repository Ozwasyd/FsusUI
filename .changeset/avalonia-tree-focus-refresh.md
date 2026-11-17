---
'element-plus': patch
---

Avoid rebuilding every Avalonia tree row when programmatic focus stays on the
same node or moves between two existing rows. Preserve row identity, selection,
scroll position, and active inline editor content during focus changes.
