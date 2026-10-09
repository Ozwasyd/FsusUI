---
'element-plus': patch
---

Defer ordinary Table resize-driven layout and scrollbar updates until the next animation frame to avoid native ResizeObserver undelivered notifications. Keep measured container width separate from overflowing column content width and release Table resize observers on unmount.
