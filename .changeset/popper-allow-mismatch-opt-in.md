---
'element-plus': minor
---

Add an opt-in `allowMismatch` prop to `ElPopperContent`. Popper content no longer emits the Vue hydration-mismatch suppression marker `data-allow-mismatch="style"` by default, so consumer bundles that treat it as a retired suppression token (FsusBlog's public-bootstrap zero-residue gate) build cleanly; consumers that want the hydration-mismatch suppression can pass `allow-mismatch` explicitly (#771).
