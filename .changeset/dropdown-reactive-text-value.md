---
'element-plus': patch
---

Refresh DropdownItem typeahead text-value registrations when props change on an
existing item. Removed or empty values use the current label without moving
focus, while disabled items remain excluded from matching.
