---
'element-plus': patch
---

Emit canonical block anchor `id` attributes for parsed `^anchor-id` targets across WASM article and chunked Markdown rendering, and expose `locateFragment` and `revealFragment` on `ElMarkdownRenderer` so both mounted blocks and unmounted virtual chunks are reachable by canonical fragment.
