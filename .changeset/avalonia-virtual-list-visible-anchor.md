---
'element-plus': patch
---

Keep the native VirtualList's visible item and position stable when inserting
items or correcting variable row measurements, including measurements outside
the realized window. Preserve keyboard focus independently from the viewport
anchor, cover the viewport with measured row heights, synchronize empty/shrunk
lists with the owned scroll host, and reject pending source results on unload.

Retain surviving item identities across deletion, reordering and source rebuilds.
Restore actual item focus independently from the navigation index, migrate
bounded measurement and loaded windows by key, and reveal surviving focused
items that move beyond the previous viewport.
