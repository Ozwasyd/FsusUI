---
'element-plus': patch
---

Restore Dialog focus to the activating control when pointer activation does not
focus it, and cancel stale shared focus-trap work on close or reopen. Preserve
nested modal focus ownership and keyboard focus restoration.
