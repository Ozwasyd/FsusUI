---
'element-plus': minor
---

Add a strict attachmentRequestDispatch hook that forwards the actual canonical
consumer request once through the original SFC/consumer-owner admission. Preserve
original result/full-settled, observer and cleanup custody and synchronous content
gates. Keep legacy Promise compatibility separate and reject conflicting hooks
before invocation. No business request, complete resources, recovery or eviction
is fabricated; qualification remains held and no package is published.
