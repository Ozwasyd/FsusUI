---
'element-plus': patch
---

Parse Markdown editor syntax from its normalized source so lone carriage returns preserve line boundaries and raw UTF-16 ranges, including supplementary Unicode characters.

Avoid scanning disjoint Markdown syntax nodes against each other when assigning parents, preserving strict containment, smallest-span selection and parser-order ties.
