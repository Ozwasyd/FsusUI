---
'element-plus': patch
---

Harden explicit Paste as Markdown imports by measuring UTF-8 bytes, enforcing
independent table and image budgets, rejecting encoded active URL schemes, and
preserving accurate style and block-formatting loss reports. The acceptance
corpus now covers Word, Google Docs, browser, malformed, 10 MB, malicious,
performance, accessibility, responsive, and mutation scenarios (#395).
