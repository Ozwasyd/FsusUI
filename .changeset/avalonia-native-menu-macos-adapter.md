---
'element-plus': patch
---

Bind Avalonia macOS native-menu roles through a library-owned adapter. `FsusNativeMenuBuilder` now marks the Services submenu for Avalonia's native exporter and routes Hide, Hide Others, Show All, Minimize, Zoom, Bring All to Front, and Quit through the native responder chain, while retaining consumer-command fallback and unchanged Windows/Linux degradation. No AppKit types are added to the public API.
