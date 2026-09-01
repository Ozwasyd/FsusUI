---
'element-plus': patch
---

Fix Avalonia native menus so a command that starts disabled renders disabled from the first build. The `FsusNativeMenuBuilder` and `FsusDockMenuContract` generated item commands now reflect `FsusPlatformCommand.IsEnabled` and nested command state instead of hard-returning enabled, raise `CanExecuteChanged` on state changes, and keep the existing execute guard so disabled items never activate. Accessibility state of initially disabled menu items is no longer reported as enabled.
