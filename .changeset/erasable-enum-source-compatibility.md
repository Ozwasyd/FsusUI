---
'element-plus': patch
---

Allow strict source consumers to use TableV2, TooltipV2, TreeV2 and vnode
constants with erasableSyntaxOnly enabled, preserving nominal enum member
types, constant values and numeric PatchFlags reverse mappings.
Use real JavaScript enum modules with matching nominal declarations, and retain
the const-enum member contract in a declaration companion. Carry the declarations
into both generated package formats so inferred consumer declarations remain valid.
