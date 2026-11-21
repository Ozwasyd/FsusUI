---
"element-plus": patch
---

Make Drawer content inert and hidden from accessibility as soon as closing begins, preventing retained sliding content from receiving pointer or keyboard input. Keep top/bottom Drawer close controls inside the right safe-area inset. Preserve the public size/direction API and existing transition lifecycle.
