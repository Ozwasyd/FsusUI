---
'element-plus': patch
---

Resolve bundled motion and icon declarations through their actual owners instead
of self-referencing public wrappers, and include the canonical icon declarations
in both package formats.

Generate Vue component declarations through the locked Vue compiler, retain
named install contracts and slots, and include referenced WASM type declarations.
Keep TableV2 class props self-contained with their existing any-valued contract.
