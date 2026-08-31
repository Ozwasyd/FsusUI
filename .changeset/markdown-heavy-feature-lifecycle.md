---
'element-plus': patch
---

Bound MarkdownEditor Code, Mermaid, and LaTeX resource work to one shared active/static/unmounted lifecycle with stale aborts, offscreen teardown, and a versioned immutable render cache. Unchanged remounted nodes reuse output through the existing safe gateway without changing Markdown source or interaction semantics.
