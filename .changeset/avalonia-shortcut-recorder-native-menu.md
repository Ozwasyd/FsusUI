---
'element-plus': patch
---

feat(avalonia): provide shortcut recorder and native menu abstractions (#648, #649)

- `FsusShortcutRecorder`: Avalonia control for shortcut recording with cross-platform normalization, accessible conflict status, escape cancellation, and backspace/delete clear behavior (#648).
- `FsusShortcutGesture`: strongly typed gesture representation with stable serialization format and platform-specific display formatting (`Ctrl`/`Alt` on Windows/Linux, `Command`/`Option` on macOS).
- `FsusNativeMenuBuilder` & `FsusPlatformCommand`: unified command model shared across Avalonia native menus, command palette, and macOS Dock menus (#649).
- macOS platform roles (`About`, `Preferences`, `Services`, `Hide`, `HideOthers`, `ShowAll`, `Quit`, Window roles) with safe degradation and platform-standard `File`/`Edit`/`View`/`Window`/`Help` ordering on Windows and Linux.
- macOS Dock menu contract with recent items and windowless launching routing.
