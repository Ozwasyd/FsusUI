---
"@ozwasyd/fsusui": major
---

BREAKING: FsusUI 2.0.0 permanently retires Element Plus compatibility (`@ozwasyd/element-plus`, `El*`, `.el-*`, `--el-*`, CommonJS `lib/`, and legacy UMD bundles) in favor of 100% native `Fsus*` Vue 3.5+ components, single-layer `--fsus-*` tokens, pure ESM (`ES2022+`) packaging, decoupled `/markdown` and `/wasm` subpaths with optional peer dependencies (`katex`, `mermaid`, `shiki`), zero-dependency unified `@ozwasyd/fsusui/motion`, and native `Date` + `Intl` date/time pickers. See `docs/migration/v1-to-v2.md` for the full migration checklist.
