---
'element-plus': minor
---

Add the public Avalonia `FsusWebViewAdapter` contract for typed editable-content
context menus, spelling and dictionary commands, debug-only developer tools,
and capability-discovered tagged PDF with hierarchical document outlines. The
facade composes with `FsusContextMenu`, keeps backend and DOM types private,
preserves caller stream ownership, and fails closed when a backend cannot prove
a requested option.
