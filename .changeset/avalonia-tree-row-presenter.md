---
'element-plus': minor
---

Add a consumer-owned Avalonia tree row presentation boundary for `FsusTree` and
`FsusTreeV2`. Nodes now carry optional application payloads, custom presenters
receive stable row state, mutable metadata can invalidate one visible row, and
optional row geometry overrides support compact workspace composition while the
existing text presenter remains the default.
