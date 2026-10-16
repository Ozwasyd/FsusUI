---
'element-plus': patch
---

Use explicit template expressions for existing Breadcrumb, Carousel, DatePicker,
Input and Radio DOM refs so strict unused-local checks recognize their use.
Preserve the original Ref objects, named `$refs`, cleanup, focus and measurement
bindings without adding component exposes.
