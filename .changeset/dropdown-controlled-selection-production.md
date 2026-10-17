---
'element-plus': minor
---

Add consumer-controlled DropdownItem radio semantics and checked-item keyboard
entry, including Escape focus return while preserving consumer-owned pending
selection with `hide-on-click="false"`.

Keep checked and disabled item registrations current when consumer state changes
during entry, without moving focus after the user has begun navigating.

Add opt-in multiline content with description and suffix slots, viewport-bounded
Dropdown geometry, and forced-colors popup surfaces and inset focus indicators.

Cancel delayed opening on Escape, fence close-time focus restoration against
newer focus/input sessions, and update viewport bounds on visual viewport resize
with paired listener cleanup.

Keep an owned Escape return directed to the Dropdown trigger when the focus
trap would otherwise return to a previously focused input; newer user input
and external focus continue to revoke that return. Bind release handling to
the menu's actual injected trap across keyed remounts and retain exact target
isolation from nested traps.
