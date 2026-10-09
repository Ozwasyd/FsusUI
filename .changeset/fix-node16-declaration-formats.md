---
'element-plus': major
---

BREAKING: CommonJS and global declaration import attributes require TypeScript
5.3 or newer. Older compiler consumers must upgrade before adopting this format;
see the package entry-point guidance in `docs/api-stability.md`. Native ESM
default imports of CommonJS still represent `module.exports`.

Match ESM entry points to ESM declarations and retain CommonJS declarations for
require entry points. Preserve inferred component contracts, type and value
exports, and explicitly resolve ESM dependency types in CommonJS declarations.
