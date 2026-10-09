---
'element-plus': patch
---

Preserve focus and its original keyboard or pointer navigation origin on an Avalonia document-tab header when drag or programmatic reorder removes and reinserts it, keeping the keyboard focus ring visible and retaining the active document identity and focus indication on other controls.

Release the outgoing document-body presenter during template replacement so removing and restoring a theme can mount the same active document content without a visual-parent conflict.
