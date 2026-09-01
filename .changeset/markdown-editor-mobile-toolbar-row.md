---
'element-plus': patch
---

Fix the framed MarkdownEditor chrome toolbar at viewports ≤48rem: the action row now occupies its own toolbar row below the mode switcher. Previously both shared one grid row and their combined min-content overlapped, clipping the split and preview tabs behind the action buttons and making them unreachable to pointer and touch input.
