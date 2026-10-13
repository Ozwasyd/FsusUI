---
'element-plus': minor
---

Add a setup-bound `config-producer` input to ElConfigProvider for the internal
local-source immutable snapshot producer. Its original handle passes directly
to the existing provider custody hook, and message/theme/motion synchronization
reads its local snapshot. Existing plain props remain reactive and unowned.
Changing the producer binding requires a keyed remount.
