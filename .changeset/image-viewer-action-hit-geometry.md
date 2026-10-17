---
'element-plus': patch
---

Give ImageViewer toolbar actions 44px minimum hit areas and explicitly sized
icons. Bound the toolbar horizontally by the safe area, wrap narrow rows, and
allow internal scrolling. Retain the original 30px/safe-inset bottom floor. On
short screens, reserve a full action row by raising navigation and placing the
next control beside the close control. Canonical profile geometry is unchanged.
This does not qualify rectangles with insufficient physical safe space for the
controls.

Allow wheel input to scroll wrapped toolbar rows without zooming the image or
chaining to the background page, while retaining wheel zoom on the image canvas.
