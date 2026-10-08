---
'element-plus': patch
---

Suspend ImageViewer background isolation when the canonical focus layer pauses, so an appended Dialog remains interactive. Resume isolation before returning focus to the viewer and restore owned inert attributes when the layer releases.
