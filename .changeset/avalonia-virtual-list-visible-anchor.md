---
'element-plus': patch
---

Keep the native VirtualList's visible item and position stable when inserting
items or correcting variable row measurements, including measurements outside
the realized window. Preserve keyboard focus independently from the viewport
anchor, cover the viewport with measured row heights, synchronize empty/shrunk
lists with the owned scroll host, and reject pending source results on unload.
