# element-plus

## 1.6.0-preview.5

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.5` (`preview` dist-tag).
- Stabilize the TimePicker spinner scroll DOM layout check to wait for initial `bindScrollEvent` and `adjustSpinners` programmatic-scroll cooldown before dispatching synthetic scroll input.

## 1.6.0-preview.4

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.4` (`preview` dist-tag).
- Run dark scale token and atomic theme-switch View Transition checks across Chromium, Firefox, and WebKit without Chromium-only skips so release readiness passes across all browsers.

## 1.6.0-preview.3

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.3` (`preview` dist-tag).
- Populate all 36 derived `--el-color-*` dark scale tokens, align `:root` `color-scheme: light dark` / `html.light`, and unify dark-token activation selectors across `var.scss` and `fsus-theme.scss` (#1107).
- Suppress descendant CSS color transitions during `syncThemeMode` / `writeThemeMode` and `runViewTransition` snapshot capture so controls switch themes atomically without opposite-theme flashing (#1106).
- Add the visible Live Preview visual projection layer and syntax-reveal highlighting for `ElMarkdownEditor` `live` mode (#1104), and move non-fitting toolbar commands into the overflow tray on narrow viewports so commands are never clipped beside the overflow trigger (#1103).
- Constrain non-fullscreen `ElDialog` mobile `min-width` to `100%` of its container, harden Playwright runtime fingerprint determinism across multi-browser owner runs, and pin `interactionProfile=keyboard` on the multi-mode Markdown table matrix test.

## 1.6.0-preview.2

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.2` (`preview` dist-tag).
- Hide detached fixed-column shadow pseudo-elements on un-pinned `ElTable` columns in compact responsive mode so the body scroll container stays aligned with the header without phantom horizontal overflow.
- Fix release-tag Playwright checkout and prepared-preview boundary fixture serving (`?audit=drawer-safe-area`).

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
