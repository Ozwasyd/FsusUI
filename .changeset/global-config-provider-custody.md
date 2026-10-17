---
'element-plus': patch
---

Add an internal opt-in immutable snapshot producer with synchronous provider
revocation feeds. Existing object/MaybeRef inputs remain reactive and cannot
issue custody tickets. Global fallback Ref assignment revokes and detaches the
previous controlled selection before publishing an unowned value. Controlled
fallback values follow their selected producer's updates; released publications
retain readable values without authority.
Detaching a provider or fallback preserves its previously observed upstream
failure records without retaining the live dependency or following later failures.
