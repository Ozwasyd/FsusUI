---
'@ozwasyd/element-plus': patch
---

fix(inbox-primitives): remove unconditional `overscroll-behavior: contain` and triple `scrollbar-gutter: stable` seams on `ElInboxLayout`/`ElSplitPane`/`ElThreadPanel`, delegate detail scroll ownership cleanly to `.el-thread-panel__messages` when `ElThreadPanel` is the sole detail child, and vertically center `.el-thread-panel__header` slots (`#1115`).
