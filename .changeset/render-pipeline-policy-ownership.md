---
'element-plus': patch
---

Copy and freeze registered component policies, including nested estimates, so
retrieved values cannot silently mutate registry state. Update policies by
registering replacements. Make unregister handles retire their own registrations
without overwriting newer entries or reviving entries removed by clear. Release
partially acquired batches on failure and add an internal synchronous registry
revocation feed for local source integrations; built-in roles and defaults stay
unchanged.

Unlink released policy registrations and keep rollback history owned by live
unregister handles, so current entries do not retain discarded registration chains.
