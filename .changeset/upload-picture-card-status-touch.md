---
"@ozwasyd/element-plus": patch
---

Fix Upload `picture-card` status indicators so only `success` renders a
checkmark, `fail` renders a distinct non-color failure icon and danger border
(`.is-fail`), and `uploading`/`ready` never show success; retain `picture-card`
status visibility on hover and keyboard focus; bump `picture-card` action
buttons to 44px on coarse pointers; retire legacy `.el-upload-cover__interact`
dark hover-only overlay CSS; and update Upload documentation and visual checks.
