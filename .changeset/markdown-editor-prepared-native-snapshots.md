---
'element-plus': minor
---

Expose real prepareSnapshot, commitPreparedSnapshot and discardPreparedSnapshot
on the same MarkdownEditor getSession owner. A single pending native candidate
pins original live history without publication; allocation and current-owner
checks precede atomic retained-token/native-ref replacement. Failure or cancellation
keeps prior native snapshot custody, and copied/foreign/stale candidates refuse.
CaptureSnapshot uses this actual protocol. Candidates expose no source/history
entries and disposal can discard only their genuine private custody. Full host
refsets, cross-identity/revision restoration, resource pause/disposal/eviction
remain unavailable; no package publication or runtime qualification is included.
