---
'element-plus': patch
---

Provide `FsusDropZone` file drop zone control and accessible states for Avalonia (#655).
Supports drag-over, drag-leave, drop events with strongly typed `FsusFileDropEventArgs`,
`Accepts` and validation predicates, single/multiple mode, disabled, loading, and error states,
optional click and keyboard (Enter / Space) file browse activation without hardcoded IO,
zero layout shift across states, and full screen reader automation support.
