---
'element-plus': minor
---

Add a single revisioned transaction, selection, bounded history, and composition
contract to MarkdownEditor. Existing `insertMarkdownAtCursor()` boolean and
direction-optional selections remain compatible; revision-aware asynchronous
replacements use the new `dispatchTransaction()` result and
`expectedRevision`.
