# FsusUI Project Overview

> **Role:** Stable repository and package orientation
> **Applies to:** Maintainers, contributors, and consumers evaluating the Vue
> workspace
> **Authority:** Describes the current checkout; public behavior is owned by
> the linked API, theme, UX, and release contracts.

For navigation, start with [`README.md`](../README.md). Use these owners for
deeper questions:

- Element Plus differences and integration: [`docs/element-plus-integration.md`](./element-plus-integration.md)
- Engineering gates and diagnosis: [`docs/engineering-handoff.md`](./engineering-handoff.md)
- Release and Changesets: [`docs/releases/governance.md`](./releases/governance.md)

FsusUI keeps the Element Plus package layout while adding FsusUI theme/motion
tokens, Markdown components, and an optional WASM acceleration layer. The
workspace targets ES2022, Node 22+, pnpm 10, and TypeScript 6.

## 1. Stack and requirements

| Concern | Current repository contract |
| --- | --- |
| Node.js | `>= 22` (`package.json` `engines.node`) |
| pnpm | `>= 10` (`engines.pnpm`); `packageManager` is `pnpm@10.33.0` |
| Vue | `^3.5.0` peer dependency |
| TypeScript | `^6.0.2` |
| Build | `pnpm build` → `vue/internal/build` (Gulp, Rollup 4, esbuild 0.28) |
| Target | `es2022` (`vue/internal/build/src/build-info.ts`) |
| Tests | Vitest with `jsdom` |
| Lint/format | ESLint 10 Flat Config and Prettier 3 |
| Demo | Vite at `5173` (dev) or `4173` (preview) |

## 2. Monorepo layout

The workspace globs in `pnpm-workspace.yaml` are:

```yaml
packages:
  - vue/packages/*
  - vue/internal/*
```

### `vue/packages/*`

| Package | Responsibility |
| --- | --- |
| `element-plus` | Public source entry, aggregate exports, and installer (workspace package name remains `element-plus`) |
| `components` | Component sources organized by component directory |
| `theme-chalk` | SCSS sources and generated theme CSS (`@element-plus/theme-chalk`) |
| `locale` | Locale resources |
| `directives` | Directives |
| `hooks` | Composables |
| `utils`, `constants`, `test-utils` | Internal utilities, shared definitions, and test helpers |
| `icons-svg`, `icons-vue` | SVG sources and generated Vue icons |
| `motion` | Motion runtime, presets, and cleanup APIs |
| `wasm` | Optional WASM acceleration (`@element-plus/wasm`) |
| `demo-app` | Vite source-linked demo |

The workspace package paths for non-public helpers are
`vue/packages/directives`, `vue/packages/hooks`, `vue/packages/utils`,
`vue/packages/constants`, and `vue/packages/test-utils`. Internal tooling lives
under `vue/internal/eslint-config`, `vue/internal/metadata`,
`vue/internal/build-utils`, and `vue/internal/build-constants`; these packages
are not public API.

### `vue/internal/*`

`build`, `build-constants`, `build-utils`, `eslint-config`, and `metadata` are
internal build, lint, and metadata tooling (`@element-plus/eslint-config` is
the lint package name). They are not public API.

## 3. Package entry and distribution

The main source entry is `vue/packages/element-plus/index.ts`:

- the default export is the installer assembled by
  `vue/packages/element-plus/defaults.ts`;
- aggregate exports cover `@element-plus/components`,
  `@element-plus/constants`, `@element-plus/directives`, and
  `@element-plus/hooks`;
- `vue/packages/element-plus/make-installer.ts` uses `INSTALLED_KEY` and
  `app.use` for installation; and
- `vue/packages/element-plus/component.ts`,
  `vue/packages/element-plus/plugin.ts`, and
  `vue/packages/components/index.ts` provide the component/plugin registries;
- `dayjs` is re-exported.

The dependency flow is:

```text
element-plus source → installer → component/plugin collections
                    → theme-chalk and optional @element-plus/wasm
```

`vue/packages/element-plus/package.json` exposes ESM (`es/index.mjs` with
`es/index.d.ts`), CJS (`lib/index.js` with `lib/index.d.ts`), types,
`dist/fsus.css`, and other documented subpaths. Its `sideEffects` list keeps
`dist/*`, `theme-chalk/**/*.css`, `theme-chalk/src/**/*.scss`, and component
style entrypoints from being removed by tree-shaking.

The workspace package is `element-plus@1.5.1`; public-preview packaging maps it
to `@ozwasyd/element-plus`. The root package is private, so consumers install
the prepared package rather than the repository root.

Relevant commands:

```bash
pnpm build
pnpm build:npm-package
pnpm check:npm-dist-tag
```

`build` uses `vue/internal/build`; `build:npm-package` runs
`scripts/prepare-npm-package.mjs --strict` to create the npm distribution;
`check:npm-dist-tag` validates tag-to-channel inference.

## 4. Source-linked demo

```bash
pnpm install
pnpm -C vue/packages/demo-app dev       # 5173
pnpm -C vue/packages/demo-app preview   # 4173
```

`vue/packages/demo-app/vite.config.ts` aliases `element-plus` and
`@element-plus/*` to workspace source; its `optimizeDeps.exclude` keeps those
packages out of dependency pre-bundling. `src/main.ts` mounts the full installer and imports
`@element-plus/theme-chalk/src/fsus.scss`. This is a development linkage, not
the external consumer installation path.

## 5. Build, test, and style commands

```bash
pnpm build
pnpm test
pnpm test:coverage
pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format
pnpm build:theme
pnpm build:wasm
pnpm clean
```

`typecheck` runs `vue/tsconfig.web.json`, `vue/tsconfig.node.json`,
`vue/tsconfig.vite-config.json`, and `vue/tsconfig.vitest.json` through the
capacity-aware runner. The Flat Config entry is `vue/eslint.config.mjs`.
`theme-chalk` supports source SCSS for the demo and generated CSS for the
package; its source package metadata is `vue/packages/theme-chalk/package.json`.
`vue/packages/locale/lang` contains modules such as `zh-cn.ts` and `en.ts`.

The theme package can be rebuilt directly with:

```bash
pnpm -C vue/packages/theme-chalk build
```

## 6. WASM integration

`@element-plus/wasm` is implemented in C++23/Emscripten at
`vue/packages/wasm/src/ep_wasm.cpp`, built by `vue/packages/wasm/build.sh`, and
wrapped by `vue/packages/wasm/index.ts` as a Promise-based singleton with sync
and async APIs. The toolchain must be supplied separately; repository scripts
do not install Emscripten.

Current component consumers use measured, dynamic selection rather than a
fixed performance claim:

- `table/src/composables/use-wasm-sort.ts`: stable numeric/ASCII-string row
  indexes, worker/WASM buffers, and a chunked JavaScript fallback;
- `select-v2/src/useSelect.ts`: generation/cancellation-safe option filtering;
- `virtual-list/src/hooks/use-wasm-row-height.ts`: WASM row-height estimation
  is attempted for `items >= 2000`.

WASM changes must retain the JavaScript fallback. See the Markdown-specific
gates in [`docs/engineering-handoff.md`](./engineering-handoff.md).

## 7. Element Plus differences and maintenance boundaries

Read [`docs/element-plus-integration.md`](./element-plus-integration.md) for
visible differences. The repository name and theme use FsusUI, while package
names and source imports remain largely `element-plus`; determine impact from
real exports and built artifacts. The demo’s aliases and source CSS are not a
consumer contract, and compatibility or performance claims require repository
tests or runtime evidence.

## 8. Current checkout snapshot

The following counts were recomputed from this checkout and will drift as code
changes:

| Area | Snapshot |
| --- | ---: |
| `vue/packages/*` workspaces | 14 |
| `vue/internal/*` workspaces | 5 |
| component directories (excluding `__tests__` and `_internal`) | 125 |
| `allComponents` entries in `element-plus/component.ts` | 153 |
| `plugin.ts` Element Plus service/directive entries | 6 (plus `FsuMotion`) |
| module exports in `components/index.ts` | 93 |
| tracked package test files under `vue/packages/**/__tests__/**` | 299 |
| locale modules under `vue/packages/locale/lang` | 58 |
| `element-plus` source package version | `1.5.1` |

Recompute these values before using them as release or compatibility evidence;
they are orientation data, not promises.
