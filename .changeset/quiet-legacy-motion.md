---
'element-plus': patch
---

Replace legacy Tag, Badge, list, Menu, Dropdown, Popover, and anchored-overlay transition visuals with their single semantic motion recipes. Inline feedback is opacity-only, lists are bounded to 8px without legacy stagger, overlay travel follows placement without overwriting Popper positioning, and reduced or disabled modes retain Vue lifecycle hooks at 1ms while cleaning up transient DOM.
