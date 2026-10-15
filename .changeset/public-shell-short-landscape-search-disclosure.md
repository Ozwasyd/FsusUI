---
'element-plus': patch
'@element-plus/theme-chalk': patch
---

Place expanded PublicShell mobile trigger search in the existing disclosure surface during short landscape layouts, preserving input state, native navigation, Escape and trigger focus return. Keep explicit inline and bottom navigation choices, and make closed search content inert while its existing transition completes.

When csp-safe is disabled, constrain the mounted disclosure to its actual clipping space with the existing floating-positioning mechanism, including non-sticky embedded headers. Update on scrolling, resizing and layout movement, and release positioning on close or unmount.

Honor csp-safe with the existing static class/token fallback and no inline geometry writes. Release positioning and remove its previous panel styles when the mode is enabled, reject pending updates, and resume positioning when it is disabled.

Keep CSP-safe trigger search in its original DOM scope using a component-owned native manual popover and the shared static viewport-safe host, independent of embedded header position or clipping. Keep a local close control outside the scrollable search content, preserve the existing value/focus/Escape owners and explicit inline/bottom modes, and leave the original native search link available before mounting.

Preserve scoped theme and public-token inheritance without token copying or inline styles. Own native top-layer opening, closing, breakpoint/ref changes and unmount cleanup; retain the original search link when native support is unavailable.
