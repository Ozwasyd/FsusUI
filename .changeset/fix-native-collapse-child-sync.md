---
'element-plus': patch
---

Fix Avalonia Collapse pointer toggles so child expansion, active classes, content visibility and automation help text follow ActiveNames before ValueChanged is raised, including closing the previous accordion item.

Keep synchronization within each Collapse owner so outer pointer toggles and model changes preserve nested Collapse models, child states and events, including when item keys match.
