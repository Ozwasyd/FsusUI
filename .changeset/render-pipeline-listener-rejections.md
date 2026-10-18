---
'element-plus': patch
---

Observe rejected asynchronous component-policy listener work so it does not leak
global unhandled rejections. Returned thenables still permanently break the
synchronous policy feed and revoke its tickets; cleanup cannot repair the feed.
