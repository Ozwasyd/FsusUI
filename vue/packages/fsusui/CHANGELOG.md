# @ozwasyd/fsusui

## 2.0.0-preview.2

### Major Changes

- Retired all remaining V1 Element Plus paths, legacy Playwright 6-owner workflows/configs/orchestrators, legacy `theme-chalk` / `icons-vue` / `gulp` / `rollup` scripts, and V1 consumer/baseline fixtures.
- Unified cross-platform Markdown runtime identity to `@ozwasyd/fsusui/markdown` across Web contracts, Avalonia `FsusMarkdownProjectionProducerContract.CanonicalRuntimeIdentity`, and semantic baselines.
- Modernized CI readiness aggregation (`ci-readiness`, `ci-profile`, `check-readiness-workflow-policy`), dependency governance (`required-checks.json`, `update-surface.json`, `test-deps-*`), boundary tests (`vue/tests/boundary/`), and token traceability paths (`vue/packages/theme/src/generated/`).

### Bug Fixes

- **WASM Packaging (#1143)**: Rewrote emitted `import.meta.url` WASM loader/binary references in `dist/*.mjs`, `dist/chunks/*.mjs`, and `dist/workers/*.mjs` to resolve packaged `dist/wasm/*` assets cleanly in both Node and unmodified Vite builds, enforced by a strict post-build URL-target gate in `prepare-npm-package.mjs`.
- **Markdown Workers & Render Pipeline (#1148)**: Bundled compiled self-contained ESM Markdown renderer and parser workers under `dist/workers/`, propagated Vite-resolved worker and WASM asset URLs across the broker/parser boundary, and updated default render-pipeline component policies from `El*` to canonical `Fsus*` names (`FsusMarkdownRenderer`, `FsusSelect`, `FsusTable`, `FsusTree`, `FsusScrollbar`, `FsusMessage`, etc.).
- **SSR Teleport Safety (#1144)**: Rendered `Teleport` conditionally with array children only when open in `FsusSelect`, `FsusCascader`, and `FsusDropdown` so closed controls render cleanly in Vue SSR without throwing, and updated `docs/guide/ssr.md` for `@ozwasyd/fsusui` 2.0.0.
- **Form Combobox Accessibility (#1145)**: Exposed `labelId`, `errorId`, and `hasLabel` from `FsusFormItem`, wired `id`, `aria-labelledby`, `aria-invalid`, and `aria-describedby` onto `FsusSelect`'s combobox (preserving explicit `aria-label` overrides), focused non-native controls on `<label>` click, and enabled `Space` to open closed comboboxes.
- **Native Input Attribute Forwarding (#1146)**: Set `inheritAttrs: false` on `FsusInput` to keep `class`/`style` on the wrapper while forwarding `id`, `aria-*`, `required`, `inputmode`, and other native attributes directly onto `<input>` and `<textarea>`.
- **Tabs ARIA Linkage (#1149)**: Generated per-instance unique tab and panel IDs via `useFsusId('tabs')` and bound `id` + `aria-controls` on `[role="tab"]` with matching `id` + `aria-labelledby` on `[role="tabpanel"]`.
- **Copyable Detail Clipboard Handling (#1150)**: Checked `navigator.clipboard?.writeText` availability explicitly before reporting success, added `copy`/`copyError` emits, localized labels (`zhCN`/`en` + `copyLabel`/`copiedLabel`/`copyErrorLabel` props), explicit error status state, and an external `role="status"` live region with VoiceOver repeat-announcement handling.
- **Migration Documentation (#1147, #1149)**: Updated `docs/migration/v1-to-v2.md` to document `virtualThreshold` automatic virtualization (`FsusTable`, `FsusSelect`, `FsusTree`) with examples and the `FsusTabs` inactive-pane unmount lifecycle.

## 2.0.0-preview.1

### Major Changes

- **BREAKING**: Permanently retired Element Plus compatibility (`@ozwasyd/element-plus`, `El*`, `.el-*`, `--el-*`, CommonJS `lib/`, and legacy UMD bundles).
- Pure ESM (`ES2022+`) `@ozwasyd/fsusui` package with native Vue 3.5+ `Fsus*` components, single-layer `--fsus-*` theme tokens, lean inline-SVG icon registry (`@ozwasyd/fsusui/icons`), zero-dependency unified motion (`@ozwasyd/fsusui/motion`), decoupled `@ozwasyd/fsusui/markdown` & `@ozwasyd/fsusui/wasm` subpaths with optional peer dependencies (`katex`, `mermaid`, `shiki`), and native `Date` + `Intl` date/time pickers.
- Rewrote visual regression, cross-platform `conformance:v2` Web ↔ Avalonia alignment, and standalone published consumer-contract suites natively for FsusUI 2.0.0.

### Bug Fixes

- Fixed vertical alignment and logical spacing for `.fsus-button__icon`, `.fsus-button__label`, `.fsus-icon`, and `.fsus-icon--left` / `.fsus-icon--right` across prop-based and inline-slot button icons.
- Omitted empty `style` attribute on `FsusIcon` during Vue SSR to preserve strict CSP (`style-src-attr 'none'`) compliance.
