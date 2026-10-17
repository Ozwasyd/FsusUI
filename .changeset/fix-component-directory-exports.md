---
'element-plus': patch
---

Materialize existing component directory export aliases from the built index
entries. Extensionless ESM imports and CommonJS requires resolve their actual
component index files; file subpaths, explicit exclusions and module format
semantics remain intact.
