---
'element-plus': patch
---

Fix the published package root entry for clean consumer installs: the bundled
`@element-plus/icons-vue` workspace dependency was stripped from
`dependencies` but its imports were never rewritten to the artifact's own
icons-vue module tree, so `import('@ozwasyd/element-plus')` failed with
`Cannot find package '@element-plus/icons-vue'` after a clean install. The
prepare step now rewrites those self-references (102 files) to the bundled
`es/icons-vue/src/index.mjs` / `lib/icons-vue/src/index.js` entries and the
consumer performance baseline records the corresponding byte ratchet.
