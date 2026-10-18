---
'element-plus': patch
---

Connect native Avalonia `FsusTransfer` keyboard input to its existing navigation,
selection, and move commands. Recheck item disabled state and the current filter
before moving selected targets left, matching rightward movement. Reject
selection and movement while the control or an ancestor is disabled.
