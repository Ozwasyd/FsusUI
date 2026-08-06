---
'element-plus': patch
'@element-plus/theme-chalk': patch
---

Stop fading the whole ReplyComposerShell when disabled; keep root opacity full so titles, helpers, and permission-reason copy stay readable while slotted controls use their own disabled tokens.
