---
'element-plus': patch
---

Avoid repeatedly rebuilding the same stable syntax projection while activating mounted Markdown chunks. Reuse only the last exact source, document and epoch; preserve feature activation identity checks and invalidate the projection on edits or document changes.
