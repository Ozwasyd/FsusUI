# Public API Stability (FsusUI 2.0)

FsusUI 2.0 publishes a single pure-ESM package, `@ozwasyd/fsusui`, with 100%
native `Fsus*` surfaces. Legacy Element Plus compatibility entry points
(`@ozwasyd/element-plus`, `es/*`, `lib/*`, `dist/index.full.*`, `El*`, `--el-*`)
have been removed in 2.0.0; see [v1 → v2 Migration](./migration/v1-to-v2.md).

## Stability Levels

| Level              | Meaning                                                                    | Change policy                                                     |
| ------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Stable public API  | Documented, tested, and intended for broad external use.                   | Breaking changes require a major version and migration guide.     |
| Preview public API | Documented and intended for external use while 2.0 stabilizes.             | Breaking changes require release notes and migration guidance.    |
| Experimental API   | Documented for early adopters; shape and defaults may evolve.              | Changes noted in release notes.                                   |
| Internal API       | Workspace packages (`@fsusui/*`), build scripts, fixtures, raw WASM files. | Not exported; may change without notice.                          |

## Package Entry Points (`@ozwasyd/fsusui`)

| Import path | Level | Notes |
| --- | --- | --- |
| `@ozwasyd/fsusui` | Preview public API | Main Vue 3.5 plugin, all `Fsus*` core/form/data/navigation/overlay/primitive components, directives (`vFsusLoading`, `vFsusInfiniteScroll`, `vClickOutside`), services (`FsusMessage`, `FsusNotification`, `FsusMessageBox`, `FsusLoadingService`), core helpers, locales (`zhCN`, `en`), and `version`. Does **not** eagerly bundle Markdown or WASM. |
| `@ozwasyd/fsusui/core` | Preview public API | Zero-dependency utilities, date engine, config provider context, validation (native + Standard Schema v1), floating/focus/scroll primitives, `FsusResult<T>`, and theme-mode helpers. |
| `@ozwasyd/fsusui/icons` | Preview public API | `FsusIcon`, canonical core SVG icon set, `registerFsusIcon`, `registerFsusIcons`, and `createFsusIcon`. |
| `@ozwasyd/fsusui/motion` | Preview public API | Unified zero-dependency motion runtime: WAAPI, damped spring/drag/inertia physics, FLIP/scroll-reveal composables, `runViewTransition`, `useSharedElementMotion`, `FsusMotion` / `FsusTransition` / `FsusSharedElement`, directives (`vFsusMotion`, `vFsusScrollReveal`), tokens, presets, recipes, and governance checks. |
| `@ozwasyd/fsusui/markdown` | Preview public API | Decoupled `FsusMarkdownRenderer`, `FsusMarkdownEditor`, and Markdown editor/projection hooks. Optional peer dependencies (`katex`, `mermaid`, `shiki`) are loaded dynamically only when enabled. |
| `@ozwasyd/fsusui/wasm` | Experimental API | Accelerated data-sorting/filtering and Markdown WASM + JS fallback runtime (`initMarkdownRuntime`, `renderMarkdownResultWithRuntime`, `activateMarkdownFeatures`, projection/coordinate/search/embed engines). |
| `@ozwasyd/fsusui/theme` | Preview public API | `syncThemeMode`, `clearThemeMode`, `normalizeThemeMode`, and document theme-mode helpers. |
| `@ozwasyd/fsusui/locale` | Preview public API | Built-in `zhCN`, `en`, and `defineFsusLocale`. |
| `@ozwasyd/fsusui/result` | Preview public API | `FsusResult<T>`, `fsusOk`, `fsusErr`, `isFsusOk`, `isFsusErr`, and structured error helpers. |
| `@ozwasyd/fsusui/render-pipeline` | Experimental API | Render-budget, virtual-window, and scheduling primitives. |
| `@ozwasyd/fsusui/perception-challenge` | Preview public API | `FsusPerceptionChallenge`, `FsusPerceptionCharacterChallenge`, `FsusTextTaskChallenge`, `FsusLocalizationChallenge`, `FsusMicroInteractionChallenge`. |
| `@ozwasyd/fsusui/styles/fsus.css` | Preview public API | Single-layer (`@layer fsus.tokens, fsus.base, fsus.components, fsus.overrides`) production CSS for core components (~67 KB uncompressed). |
| `@ozwasyd/fsusui/styles/markdown.css` | Preview public API | Opt-in CSS for `FsusMarkdownRenderer`, `FsusMarkdownEditor`, `.fsus-prose`, and `.fsus-markdown-embed` (~14 KB uncompressed). |
| `@ozwasyd/fsusui/styles/*.css` | Preview public API | Granular stylesheets (`tokens.css`, `base.css`, `core.css`, `forms.css`, `overlays.css`, `data-nav.css`). |
| `@ozwasyd/fsusui/global` | Preview public API | Type-only Volar `GlobalComponents` declarations for `Fsus*` components. |

## Theme & Motion Token Stability

- Theme tokens are governed by [`spec/tokens/`](../spec/tokens/README.md) and
  [`docs/theme/tokens.md`](./theme/tokens.md). Only canonical `--fsus-*`
  variables are public.
- Motion tokens and budgets are tracked in [`docs/theme/motion.md`](./theme/motion.md).
- Internal workspace packages (`@fsusui/*`), `vue/internal/*`, and raw WASM
  binaries under `dist/wasm/*` are implementation details and not public API.
