---
'element-plus': patch
---

Validate Markdown Worker source metadata in UTF-8 bytes so CJK and astral text
can commit safely. Observe shared theme changes throughout heavy initialization
and rerendering, and release the listener when the renderer unmounts.

Abort obsolete activation synchronously and suppress its late completion,
profile and error events after a shared-theme change.
