---
'@ozwasyd/element-plus': patch
---

Make MarkdownEditor command-palette close idempotent and preserve focus transferred
to another control. Restore the saved source selection only for the current
palette's dismissal, cancelling delayed restoration after focus, document,
revision, composition, reopened-palette or editor-lifetime changes.
