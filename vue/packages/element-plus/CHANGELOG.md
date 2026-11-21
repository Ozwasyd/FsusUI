# element-plus

## 1.6.0-preview.1

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.1` (`preview` dist-tag) incorporating the Intellectual Minimalist theme, motion, and cross-platform contract improvements through `main`.
- Include production fixes for `ElDropdown` (#830), `ElDataList` (#831), `ElImageViewer` modal/content/geometry/SSR-CSP contracts (#832–#835), `ElDrawer` safe-area and edge geometry (#827, #1096), `ElPublicShell` mobile navigation and CSP-safe search (#828, #1093, #1094), system-dark theme parity (#1092), `ElTable` compact width and scroll affordances (#1097), and `ElUpload` visual/touch convergence (#300).

## 1.5.0

### Minor Changes

- Add default Markdown feature adapters for Mermaid, KaTeX, and code highlighting.
- Improve Markdown, virtual scrolling, and DOM rendering performance for high-density views.
- Harden GitHub Packages release boundary checks and remove stale repository notes from the release branch.

## 1.4.2

### Patch Changes

- Publish the completed public API surface for theme, icons, WASM, Markdown runtime, PublicShell, MarkdownRenderer, MarkdownEditor, MessageBox, and Result helpers.

## 1.4.1

### Patch Changes

- Harden FsusUI release packaging for Vite consumers, including static WASM asset resolution, theme-mode test helpers, render-pipeline diagnostics, DOM virtualization scheduling, and chunk-budgeted consumer smoke validation.

## 1.4.0

### Minor Changes

- Add the raw HTML Markdown renderer, Result mode, and the Fsus Render Pipeline with GPU/CPU acceleration policy.
- Rework demo-app stress coverage, virtual rendering, motion convergence, and release package hardening.

## 1.3.1

### Patch Changes

- Expand component boundary coverage, demo completeness fixtures, and parallelized quality checks for release validation.

## 1.3.0

### Minor Changes

- 76b47ce: Harden visual stability for mobile layouts and dark mode, expand Playwright coverage across desktop/mobile and light/dark variants, and tighten release-ready project verification.
