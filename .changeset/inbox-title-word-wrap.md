---
'element-plus': patch
---

Wrap inbox conversation-list-item titles with `word-break: break-word` / `overflow-wrap: break-word` instead of `overflow-wrap: anywhere` so English words stay intact and titles no longer hyphenate mid-word in narrow panels.
