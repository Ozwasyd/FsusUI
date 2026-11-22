---
'element-plus': patch
---

Fix Avalonia Collapse pointer toggles so child expansion, active classes, content visibility and automation help text follow ActiveNames before ValueChanged is raised, including closing the previous accordion item.

Keep synchronization within each Collapse owner so outer pointer toggles and model changes preserve nested Collapse models, child states and events, including when item keys match.

Keep dynamically attached items and observable active-name changes synchronized, prevent content pointer input from toggling its containing item, and expand content to fit nested controls without clipping.

Register the Collapse content minimum as a component token and use it for the Avalonia expanded region; Web Collapse retains its existing natural content sizing.
