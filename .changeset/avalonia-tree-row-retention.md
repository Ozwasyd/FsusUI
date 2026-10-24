---
'element-plus': patch
---

Retain Avalonia Tree rows and default text layouts across expansion and focus
updates, avoiding repeated full visual-tree reconstruction while preserving
custom presentation, inline editing, row ordering, and automation state.

Reuse shaped text for unchanged default labels across synchronous tree remounts
while creating fresh layouts and honoring normal layout invalidation. Release
the cache on removal, content replacement, genuine unload, and window closure;
invalidate it for changed typography, resources, scaling, and theme. Rich text
and nondefault formatting continue through the standard TextBlock path.
