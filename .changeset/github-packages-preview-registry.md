---
'element-plus': patch
---

Switch the canonical package registry for `@ozwasyd/element-plus` public-preview
and release artifacts to GitHub Packages (`https://npm.pkg.github.com/`).
Consumers installing `@ozwasyd/element-plus` should configure
`@ozwasyd:registry=https://npm.pkg.github.com/` with a token holding
`read:packages`.
