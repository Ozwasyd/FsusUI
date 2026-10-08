---
"element-plus": patch
---

Restore the documented SelectV2 focus and blur methods through its existing input event path. Expose listbox and option roles, disabled and selection states, and the combobox's controlled listbox and rendered active option, including virtualized option positions.

Cancel pending opening and internal refocus when consumers call blur during selection, clear or tag removal. Preserve outside focus and honor the inherited ElForm disabled state on the native input.
