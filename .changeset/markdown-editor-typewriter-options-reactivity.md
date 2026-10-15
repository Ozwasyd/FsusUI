---
'element-plus': patch
'@element-plus/components': patch
---

Fix MarkdownEditor retaining a cached Typewriter option after writing-aid options
change. Synchronize the component's reactive options with the existing controller
document refresh so disabling Typewriter updates its class and scroll guards.
Preserve Focus, anchor selection, composition handling and the existing scroll
state machine.
