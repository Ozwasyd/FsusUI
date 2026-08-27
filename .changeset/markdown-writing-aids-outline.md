---
'element-plus': minor
'@element-plus/components': minor
---

feat(markdown-editor): implement outline reveal, focus mode and typewriter scrolling (#438, #439, #440)
- Implement `revealHeading` and `revealSourceRange` with virtual target mounting, accessibility checks, and tree navigation helper (#438).
- Implement Focus mode current-block presentation, WCAG contrast preservation, and accessibility rules (#439).
- Implement 7-state upper-third Typewriter scroll state machine, viewport calculation, and async height stability (#440).
