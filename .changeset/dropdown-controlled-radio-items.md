---
'element-plus': minor
---

Add consumer-controlled `checked` state to DropdownItem, rendering coherent menuitemradio and aria-checked semantics while preserving ordinary command items. Prefer the checked item on keyboard entry and support ArrowUp on the trigger. Document public URL/command adapters and asynchronous pending/error/retry composition without storing consumer selection or preferences.

Add explicit multiline DropdownItem content with description/suffix slots and
opt-in viewport-bounded Dropdown geometry, including body-teleported root CSS
zoom coordinate normalization through the existing Popper modifiers. Default
single-line rows remain unchanged.
