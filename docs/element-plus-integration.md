# Integrating FsusUI where Element Plus differs

This guide lists only differences directly demonstrated by repository code or
configuration and their integration impact. It does not claim complete
compatibility or zero code changes.

Audience:

- product teams migrating from Element Plus to the published FsusUI build; and
- repository contributors using the demo, source aliases, and source theme.

Start with [Project overview](./project-overview.md), the repository document at
`docs/project-overview.md`.

## A. Product integration and migration

### A1. Runtime and compatibility boundary

- The build target is `es2022` (`vue/internal/build/src/build-info.ts`), so the
  runtime needs equivalent ES2022 support.
- Older targets require the product's own transpilation and polyfills; this
  repository does not promise down-level output.
- Repository development requires `node >= 22` and `pnpm >= 10` from the root
  `package.json`; those are not product runtime requirements.

### A2. Published and source names

The npm public package is `@ozwasyd/element-plus`. Source remains under
`vue/packages/element-plus`, whose package name is `element-plus`; do not mix
the two surfaces.

| Product import | Use |
| --- | --- |
| `@ozwasyd/element-plus` | Full package |
| `@ozwasyd/element-plus/global` | Global component types |
| `@ozwasyd/element-plus/es/locale/lang/*` | Locale packages |

Products normally need no separate theme or WASM workspace package; consume
the main package artifacts.

### A3. Styles

Prefer the published stylesheet, `@ozwasyd/element-plus/dist/fsus.css`.

Do not copy the repository source entry
`@ozwasyd/element-plus/theme-chalk/src/fsus.scss` into a product unless its
SCSS toolchain, path resolution, variables, and side effects are intentionally
matched.

### A3.1. Dark mode

The theme CSS already follows `prefers-color-scheme`. For a persisted choice,
pass `themeMode` at install time or set it on the root `ConfigProvider`:

```ts
app.use(ElementPlus, {
  themeMode: 'system',
})
```

```vue
<el-config-provider :theme-mode="themeMode">
  <App />
</el-config-provider>
```

`dark` writes `html.dark`; `light` writes `html.light`; `system` leaves both
classes off, follows the media query, and updates `data-theme-resolved`. Match
both explicit and resolved dark roots in custom CSS:

```css
html.dark,
html[data-theme-resolved='dark'] {
  /* your overrides */
}
```

See [Dark mode](./guide/dark-mode.md) for first-paint, SSR, storage, and test
helper details.

### A4. WASM acceleration

`@element-plus/wasm` is the internal workspace source package. Product code
uses the public wrapper `@ozwasyd/element-plus/wasm`. The repository has three
component integration points:

- `vue/packages/components/table/src/composables/use-wasm-sort.ts`: number and
  ASCII-string sorting returns stable row indexes; measured end-to-end history
  chooses Worker/WASM or chunked JS instead of a fixed row threshold.
- `vue/packages/components/select-v2/src/useSelect.ts`: option, label, or case
  changes rebuild the persistent filter index; queries use generation; cold
  WASM or unavailable Workers retain and asynchronously update JS results.
- `vue/packages/components/virtual-list/src/hooks/use-wasm-row-height.ts`:
  `items >= 2000` tries the WASM batch estimator; smaller lists return `null`
  for the caller's fallback estimate.

Built artifacts are in `vue/packages/wasm/dist/`; the bundler/deployment chain
must handle `.wasm` resources and their loading. Zero-configuration success is
not guaranteed: static asset copying, cross-origin/COOP/COEP settings, and a
WASM bundler plugin depend on the product environment.

### A5. Observable differences

These differences do not by themselves change the published component API, but
they affect repository integration and build strategy:

- `vue/packages/element-plus/index.ts` re-exports `dayjs` via
  `export { default as dayjs } from 'dayjs'`.
- `@element-plus/icons-svg` is the repository's source SVG; generated
  `@element-plus/icons-vue` is consumed by component code. This keeps source
  and demo integration aligned; it does not assert a separate visual system.
- The optional `@element-plus/wasm` workspace layer is folded into the demo's
  `fsus-ui` chunk for full installation and split into `fsus-wasm` for on-demand
  consumer builds.

## B. Repository development

### B1. Demo and ports

```bash
pnpm install
pnpm -C vue/packages/demo-app dev
```

The dev server uses `5173` (`vue/packages/demo-app/vite.config.ts`); preview
uses `4173`.

### B2. Source aliases and dependency optimization

`vue/packages/demo-app/vite.config.ts` aliases workspace source and uses
`optimizeDeps.exclude` to keep it out of dependency pre-bundling:

- `element-plus` → `vue/packages/element-plus/index.ts`;
- `@element-plus/components`, `constants`, `directives`, `hooks`, `locale`,
  `utils`, and `wasm` → their corresponding `vue/packages/*` paths.

This keeps local source integration out of Vite's ordinary dependency
pre-bundling.

### B3. Source theme

The demo entry `vue/packages/demo-app/src/main.ts` imports
`@element-plus/theme-chalk/src/fsus.scss`. This is a repository convenience,
not a product recommendation.

### B4. Build and debug WASM

The script is `vue/packages/wasm/build.sh`; run it from the repository root:

```bash
pnpm build:wasm
```

It requires the Emscripten `emsdk` toolchain and may locate or activate it from
the environment. Full demo builds fold WASM into `fsus-ui`; on-demand consumer
builds split it into `fsus-wasm` (see `scripts/vite-manual-chunks.mjs`).
