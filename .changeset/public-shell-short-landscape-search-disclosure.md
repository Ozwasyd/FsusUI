---
'element-plus': patch
'@element-plus/theme-chalk': patch
---

Place expanded PublicShell mobile trigger search in the existing disclosure surface during short landscape layouts, preserving input state, native navigation, Escape and trigger focus return. Keep explicit inline and bottom navigation choices, and make closed search content inert while its existing transition completes.

Constrain the mounted disclosure to its actual clipping space with the existing floating-positioning mechanism, including non-sticky embedded headers. Update on scrolling, resizing and layout movement, and release positioning on close or unmount.
