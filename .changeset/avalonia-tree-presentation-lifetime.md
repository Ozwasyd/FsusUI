---
'element-plus': patch
---

Allow detached Avalonia trees to be collected even when their nodes remain in
use. Preserve presentation updates for live trees while detached and after
reattachment, and ignore queued updates for nodes that have been replaced.
