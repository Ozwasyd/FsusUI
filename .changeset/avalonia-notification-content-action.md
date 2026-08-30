---
'element-plus': patch
---

Complete the Avalonia notification surface: `FsusNotification` renders `Title` and `Message` from `FsusNotificationOptions` through its theme template with an accessible dismiss control, and supports one optional action via `ActionLabel` and `ActionCommand` (activation also observable through `ActionActivated`). Action activation stays distinct from dismissal — timeouts, the dismiss control, `CloseOnClick`, and programmatic close never invoke the action. Set `Duration` to opt into auto-close after a span; notifications stay open by default as before. Works in light and dark themes.
