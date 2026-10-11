---
'element-plus': patch
---

Keep terminal attachment jobs terminal when late progress or completion arrives,
and release embed request abort listeners without cancelling replacement requests.
Retain unresolved embed preparation work in the internal resource census after
cancellation; this does not enable editor session eviction.
