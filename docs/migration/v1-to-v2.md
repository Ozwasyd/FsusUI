# Migrating from FsusUI v1 to v2 (2.0.0)

FsusUI 2.0.0 is a clean-slate breaking release that permanently drops Element Plus
compatibility to deliver a drastically smaller package footprint, pure-ESM
tree shaking, and faster build/runtime performance.

## Breaking Changes Summary

| Area | v1 (`@ozwasyd/element-plus`) | v2 (`@ozwasyd/fsusui`) |
| --- | --- | --- |
| npm package name | `@ozwasyd/element-plus` | `@ozwasyd/fsusui` |
| Module formats | Dual ESM (`es/`) + CJS (`lib/`) + UMD (`dist/index.full.*`) | **Pure ESM** (`dist/*.mjs`, `ES2022+`) |
| Component prefix | `El*` / `<el-*>` (plus `Fsu*` in motion) | Unified `Fsus*` / `<fsus-*>` across all packages |
| CSS classes & states | `.el-*` + `.is-*` | `.fsus-*` + `data-*` attributes inside `@layer fsus.*` |
| CSS variables | Dual `--el-*` + `--fsus-*` bridge | Single-layer canonical `--fsus-*` tokens only |
| Stylesheet imports | `@ozwasyd/element-plus/dist/fsus.css` | `@ozwasyd/fsusui/styles/fsus.css` (+ opt-in `/styles/markdown.css`) |
| Icons | `@ozwasyd/element-plus/icons-vue` (313 `.vue` SFCs) | `@ozwasyd/fsusui/icons` (canonical SVG path table + `registerFsusIcon`) |
| Locales | 68 bundled languages under `es/locale/lang/*` | Built-in `zhCN` & `en` + `defineFsusLocale()` from `@ozwasyd/fsusui/locale` |
| Heavy Markdown deps | Hard runtime dependencies (`mermaid`, `shiki`, `katex`) | Optional `peerDependencies`, isolated on `@ozwasyd/fsusui/markdown` & `/wasm` |
| Motion engines | External `gsap` + `motion-dom` | Unified zero-dependency `@ozwasyd/fsusui/motion` (WAAPI + spring physics) |
| Date / Time engines | External `dayjs` | Zero-dependency native `Date` + `Intl.DateTimeFormat` |
| Runtime dependencies | 18+ packages (`lodash-es`, `@popperjs/core`, `async-validator`, `dayjs`, `gsap`, `motion-dom`, …) | **1 package** (`@floating-ui/dom`) + peer `vue@^3.5.0` |

## Component Consolidations

| Removed v1 component | v2 replacement |
| --- | --- |
| `ElTable` + `ElTableV2` | `FsusTable` (built-in virtualization via `virtual` prop) |
| `ElSelect` + `ElSelectV2` | `FsusSelect` (built-in virtualization via `options` + `virtual`) |
| `ElTree` + `ElTreeV2` | `FsusTree` (built-in virtualization) |
| `ElPopper` + `ElTooltip` + `ElTooltipV2` | `FsusTooltip` / `FsusPopover` (powered by `@floating-ui/dom`) |
| `ElEmpty` + `ElEmptyState` | `FsusEmptyState` |
| `ElPageHeader` + `FsusTaskPageHeader` | `FsusPageHeader` |
| `FsuMotion` / `FsuTransition` / `FsuSharedElement` | `FsusMotion` / `FsusTransition` / `FsusSharedElement` |

## Directives & Services

| v1 | v2 |
| --- | --- |
| `v-loading` / `ElLoading.service` | `v-fsus-loading` (`vFsusLoading`) / `FsusLoadingService` |
| `v-infinite-scroll` | `v-fsus-infinite-scroll` (`vFsusInfiniteScroll`) |
| `ElMessage` | `FsusMessage` |
| `ElNotification` | `FsusNotification` |
| `ElMessageBox` (throw-on-cancel) | `FsusMessageBox` (returns `Promise<FsusResult<...>>`) |

## Step-by-Step Upgrade Checklist

1. Replace `@ozwasyd/element-plus` with `@ozwasyd/fsusui` in `package.json`.
2. Replace stylesheet imports:
   - `@ozwasyd/element-plus/dist/fsus.css` → `@ozwasyd/fsusui/styles/fsus.css`
   - If using Markdown components, also import `@ozwasyd/fsusui/styles/markdown.css`.
3. Update Volar types in `tsconfig.json` to `"types": ["@ozwasyd/fsusui/global"]`.
4. Rename `El*` imports & `<el-*>` tags to `Fsus*` & `<fsus-*>`, and replace consolidated V2 tags (`el-table-v2`, `el-select-v2`, `el-tree-v2`, `el-tooltip-v2`, `el-empty`) with their unified `Fsus*` counterparts.
5. Migrate custom CSS overrides from `--el-*` variables to canonical `--fsus-*` tokens (see [`docs/theme/tokens.md`](../theme/tokens.md)).
6. Move `FsusMarkdownRenderer` / `FsusMarkdownEditor` imports to `@ozwasyd/fsusui/markdown` and install optional peer dependencies (`katex`, `mermaid`, `shiki`) only if those features are enabled.
