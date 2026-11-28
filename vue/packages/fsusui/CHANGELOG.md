# @ozwasyd/fsusui

## 2.0.0-preview.1

### Major Changes

- **BREAKING**: Permanently retired Element Plus compatibility (`@ozwasyd/element-plus`, `El*`, `.el-*`, `--el-*`, CommonJS `lib/`, and legacy UMD bundles).
- Pure ESM (`ES2022+`) `@ozwasyd/fsusui` package with native Vue 3.5+ `Fsus*` components, single-layer `--fsus-*` theme tokens, lean inline-SVG icon registry (`@ozwasyd/fsusui/icons`), zero-dependency unified motion (`@ozwasyd/fsusui/motion`), decoupled `@ozwasyd/fsusui/markdown` & `@ozwasyd/fsusui/wasm` subpaths with optional peer dependencies (`katex`, `mermaid`, `shiki`), and native `Date` + `Intl` date/time pickers.
- Rewrote visual regression, cross-platform `conformance:v2` Web ↔ Avalonia alignment, and standalone published consumer-contract suites natively for FsusUI 2.0.0.

### Bug Fixes

- Fixed vertical alignment and logical spacing for `.fsus-button__icon`, `.fsus-button__label`, `.fsus-icon`, and `.fsus-icon--left` / `.fsus-icon--right` across prop-based and inline-slot button icons.
- Omitted empty `style` attribute on `FsusIcon` during Vue SSR to preserve strict CSP (`style-src-attr 'none'`) compliance.
