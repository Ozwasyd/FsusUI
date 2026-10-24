---
'element-plus': patch
---

Preserve focus and its original keyboard or pointer navigation origin on an Avalonia document-tab header when drag or programmatic reorder removes and reinserts it, keeping the keyboard focus ring visible and retaining the active document identity and focus indication on other controls.

Retire the outgoing document-body presenter's template before releasing its child during template replacement so removing and restoring a theme can mount the same active document content without a visual-parent conflict, including recycling templates that accept null content. Preserve the document's own Content and ContentTemplate for normal reuse on remount.

Refresh generated Avalonia document-tab header children after reinsertion and before restoring focus, preventing queued layout from measuring retired header text.
