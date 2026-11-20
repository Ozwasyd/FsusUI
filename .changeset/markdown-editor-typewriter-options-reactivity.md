---
'element-plus': patch
'@element-plus/components': patch
---

Fix MarkdownEditor retaining a cached Typewriter option after writing-aid options
change. Synchronize the component's reactive options with the existing controller
document refresh so disabling Typewriter updates its class and scroll guards.
Restore default writing aids when the consumer removes the options prop, while
preserving options during document updates that omit the writing-aid field.
Preserve Focus, anchor selection, composition handling and the existing scroll
state machine.
