---
'element-plus': minor
'@element-plus/theme-chalk': minor
---

Add the documented opt-in `multiline` mode to ElTag so full labels wrap
within available inline width and grow the root height without clipping
or truncation. Preserve default single-line behavior, semantic tones,
sizes, motion, and existing events. In multiline mode, provide a separate
native, keyboard-accessible close button with a localized name and contextual
label description. Consumers opt in with `multiline` and provide a bounded
containing width and wrapping slot content; no default-mode migration is needed.
