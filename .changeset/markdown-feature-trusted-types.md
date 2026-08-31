---
'element-plus': patch
---

Make the internal Mermaid, KaTeX, and Shiki output gateway compatible with
Trusted Types enforcement. Hosts that restrict policy creation must allow the
non-default `fsusui-markdown-feature` policy name.
