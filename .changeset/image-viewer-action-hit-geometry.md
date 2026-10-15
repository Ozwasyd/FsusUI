---
'element-plus': patch
---

Give ImageViewer toolbar actions 44px minimum hit areas and explicitly sized
icons. Bound the toolbar horizontally by the safe area, wrap narrow rows, and
allow internal scrolling. On short screens, compress the preferred bottom gap
before reducing the space for a full action row, preserving actual safe insets.
This does not resolve rectangles with insufficient physical safe space for one
full row or existing close/navigation overlaps.
