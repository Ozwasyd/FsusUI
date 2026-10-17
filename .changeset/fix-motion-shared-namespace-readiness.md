---
'element-plus': major
---

BREAKING: inherited transition mode types reject invalid strings and numbers that
the previous extracted declaration allowed. Use the original Vue modes
`default`, `in-out`, `out-in`, or omit `mode`; see `docs/components/motion.md`.

Resolve concurrent declaration loading through the pinned macro API's formal
patch, retaining partial forward declarations only for recursive dependency
cycles. Stabilize development transition prop metadata without changing the
component or serializing its callers.

Preserve type-based source props at the declaration-only Vue compiler boundary.
Retain default and aliased exports across recursive namespaces, and propagate
dependency failures to every public caller in the cycle.
