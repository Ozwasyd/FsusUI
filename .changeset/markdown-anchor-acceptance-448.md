---
'element-plus': patch
---

Refine the Markdown block anchor grammar so `^id` text inside fenced code, LaTeX `$$`, `:::` containers, table rows, and registered atomic directives stays literal content, and report `anchor-cross-gap` separately from `anchor-orphan` for exclusive-line anchors separated from their owning block. Visible editor copy now excludes block anchor markers while the exact Markdown copy keeps them (#448).
