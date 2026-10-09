---
'element-plus': patch
---

Correct Avalonia native-menu and dock-menu primary accelerators on macOS to
use Command. Apply the same conversion when a native-menu command gesture
changes, while retaining Ctrl on Windows/Linux, host selection for Auto,
platform-neutral serialization, and raw KeyGesture interop.
