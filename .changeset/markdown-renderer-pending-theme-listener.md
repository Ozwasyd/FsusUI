---
'element-plus': patch
---

Register the shared theme listener before MarkdownRenderer first awaits heavy-feature activation so theme changes during pending activation reach the existing synchronous render watcher. Recheck renderer disposal, pause state, and cancellation after listener registration.
