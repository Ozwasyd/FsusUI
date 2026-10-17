---
'element-plus': patch
---

Keep MarkdownEditor command palette Enter available to native IME composition
instead of closing the palette and executing its active command. Ordinary Enter
retains command eligibility checks and runs after composition ends.
