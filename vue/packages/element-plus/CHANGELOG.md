# element-plus

## 1.6.0-preview.12

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.12` (`preview` dist-tag on GitHub Packages).
- **Render Pipeline Modularization & Scoped Context (`#1135`)**: Split `use-render-pipeline` into 9 focused modules (`types`, `config`, `diagnostics`, `hardware-profile`, `registry`, `scheduler`, `virtual-window`, `runtime`, `index`) and expose tree-shakeable scoped dependency injection (`createFsusRenderPipelineContext`, `provideFsusRenderPipelineContext`, `useFsusRenderPipelineContext`, `FSUS_RENDER_PIPELINE_CONTEXT_KEY`) while preserving the consumer Markdown hydration bundle budget.
- **Markdown Editor & WASM Runtime Decoupling (`#1135`)**: Extract the zero-Vue/zero-DOM `EditorKernel`, 12 domain composables, and 5 sub-surface SFCs from `markdown-editor.vue` (6,353 -> 2,390 LOC) and decompose `wasm/markdown-runtime.ts` (2,603 -> 551 LOC) into `markdown-result-authority`, `markdown-feature-activation`, and `markdown-wasm-engine` with deterministic export binding and preserved mobile viewport layout restore.
- **Theme, Packaging & Cross-Platform Maintainability (`#1135`)**: Split `fsus-theme.scss` into 8 domain partials with byte-identical compiled CSS (`el-fsus-theme.css`, `el-fsus.css`, `index.css`), remove `@element-plus/test-utils` from production/workspace `dependencies`, eliminate build polling in `gulpfile.ts`, consolidate Playwright configs and contract/governance scripts, and decompose large Avalonia controls into responsibility folders while preserving all 528 public Avalonia types and Native AOT compliance.

## 1.6.0-preview.11

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.11` (`preview` dist-tag on GitHub Packages).
- **Published Declarations & Packaging (`#1129`)**: Switch `.d.ts` emission to `vue-tsc`'s `@vue/language-core` + `@volar/typescript` `proxyCreateProgram` engine in an isolated subprocess so all 1,267 package `.d.ts` files (including `ElSelect`, `ElOption`, `ElCascader`, `ElSlider`, `ElTimeSelect`, `pagination/sizes.vue`, and `date-picker/panel-utils`) emit with zero dropped files, preserve `defineExpose` public instance types (e.g. `ButtonInstance['ref']`) without leaking internal bindings, ship complete `@ozwasyd/element-plus/icons-vue` declarations (`305` files) without self-cycles, and gate dangling/circular `.d.ts` references in `prepare-npm-package`, `npm-candidate`, `build:package-smoke`, and `test:consumer-install`.
- **Wasm LaTeX MathML (`#1130`)**: Fail closed on unrecognized characters/commands in `markdown_latex.cpp` via `token_kind::invalid` so unsupported LaTeX falls back cleanly to KaTeX instead of silently truncating formulas, while natively rendering spacing commands (`\,`, `\:`, `\;`, `\!`, `\ `) and common punctuation (`,`, `:`, `;`, `[`, `]`, `|`).
- **Wasm Mermaid Dark Mode & Marker IDs (`#1131`)**: Theme Wasm Mermaid SVGs via `--el-bg-color-overlay`, `--el-border-color`, `--el-text-color-primary`, and `--el-text-color-secondary` with semantic classes (`mermaid-node`, `mermaid-label`, `mermaid-edge`, `mermaid-arrow`) and collision-free deterministic per-diagram marker IDs (`mermaid-arrow-<hash>-<index>`).
- **ElMarkdownEditor Locale (`#1132`)**: Resolve default `ElMarkdownEditor` UI copy (modes, toolbar commands, actions, overflow, search, command palette, attachments, embeds, contextual surfaces, table actions, and capability announcements) from `ElConfigProvider` via `useLocale()`, ship complete `en` and `zh-cn` `el.markdownEditor` dictionaries with per-key `en` fallback, and retain `localeText` as per-instance override.

## 1.6.0-preview.10

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.10` (`preview` dist-tag on GitHub Packages).
- **MarkdownRenderer (`#1123`)**: Preserve canonical explicit block fragment IDs across Shiki code-highlight element replacement and error fallback so `locateFragment` / `revealFragment` continue to reach highlighted fenced code blocks.
- **ElThreadPanel (`#1125`)**: Switch narrow headers (`<= 559px` container width) to responsive stacked rows so `#back` and `#actions` never crush the thread title into single-character lines.
- **ElCheckbox (`#1126`)**: Allow long checkbox labels to wrap cleanly within narrow viewports (`320px`/`375px`) across enabled, disabled, bordered, and `ElCheckboxGroup` modes without horizontal overflow.
- **Settings & Inbox Primitives (`#1127`)**: Remove non-reactive `computed(slots.*)` caching across `ElResourceListItem` and sibling `settings-primitives` / `inbox-primitives` so conditionally added or removed named slots render immediately.

## 1.6.0-preview.9

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.9` (`preview` dist-tag on GitHub Packages).
- **Web / Vue (`#1117`, `#1118`)**: fix InboxPrimitives scroll-chaining/header alignment/scrollbar gutter (`#1115`), MarkdownRenderer native Worker UTF-8 byte-length validation, MarkdownEditor writing-aid reactivity/Focus half-open boundaries/dimmed span opacity/prose chrome radius, Button coarse-pointer `:focus-visible` ring and danger-link colors, Tabs `aria-label`/`aria-labelledby` forwarding and disabled keyboard guard, SegmentedControl selected contrast and disabled Tab entry, SelectV2 native focus/ARIA/disabled-form/touch-hover lifecycle, Input CSP-safe textarea `resize`, TableV2 portable Vue `HTMLAttributes['class']` types, and opt-in `ElTag` `multiline` mode.
- **Avalonia / .NET & Tokens (`#1119`)**: fix VirtualList visible anchoring & external focus, Tabs collection mutation ordering & preselected additions, Transfer keyboard routing & disabled moves, Collapse pointer child synchronization & nested isolation with cross-platform `component.collapse.content.min-height` token, Stable39 native primitive keyboard routing, DesktopShell document-tab reorder focus & outgoing presenter retirement, and macOS `Command` primary accelerator mapping.

## 1.6.0-preview.8

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.8` (`preview` dist-tag on GitHub Packages).
- Run `package:candidate:verify` directly via Node built-ins (without `with-node-heap.mjs`/`fast-glob`) so zero-`node_modules` `preflight` and `publish` jobs verify the candidate artifact reliably, handle `--json` `E404` on both stdout/stderr in `npm-channel-state.mjs`, and pass `--config vite.config.mjs --ssr src/entry-ssr-server.ts` cleanly in the published consumer contract harness.

## 1.6.0-preview.7

### Preview Changes

- Switch canonical package registry for `@ozwasyd/element-plus` to GitHub Packages (`https://npm.pkg.github.com/`) using workflow-scoped `GITHUB_TOKEN` (`packages: write`), scope `fsusblog-consumer` cross-repo verification to stable `latest` releases, and run post-publish standalone consumer contract verification (`#830`–`#835`) automatically in `publish-npm.yml`.

## 1.6.0-preview.6

### Preview Changes

- Ship public-preview candidate `@ozwasyd/element-plus@1.6.0-preview.6` (`preview` dist-tag).
- Exclude platform/opt-in-only tests at the Playwright project level (`dom-layout`, `view-transitions`, `markdown-editor`) via `testIgnore`/`grepInvert` so every required release Playwright cell executes with `skipped=0` and passes `stable-readiness` and `release-readiness` without dropping any test coverage.

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
