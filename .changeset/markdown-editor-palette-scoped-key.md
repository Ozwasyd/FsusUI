---
'element-plus': patch
---

Keep Ctrl/Cmd+P inside the active MarkdownEditor command palette after teleport,
including repeated keydown, without reopening, resetting search or running a
command. Preserve the public opener, native composition, disabled/unrelated
shortcut behavior, and Escape selection restoration.
