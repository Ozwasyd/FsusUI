---
'element-plus': patch
---

Bound MarkdownEditor Code, Mermaid, and LaTeX resource work to one shared active/static/unmounted lifecycle with stale aborts, offscreen teardown, and a versioned immutable render cache. Unchanged remounted nodes reuse output through the existing safe gateway without changing Markdown source or interaction semantics. The heavy feature adapter resource bridge and the isolated render adapter are now fetched only when a Code, Mermaid, or LaTeX node actually activates, so a document with no heavy features no longer downloads or initializes them.
