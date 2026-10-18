---
'element-plus': patch
---

Validate native Markdown Worker source lengths as UTF-8 byte counts so valid CJK and astral text can render without a false safe-text fallback. Preserve identity, version and chunk validation, and keep public editor projection ranges in UTF-16 code units.
