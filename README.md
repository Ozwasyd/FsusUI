# FsusUI

FsusUI 2.0 is a standalone, pure-ESM Vue 3.5+ component system and cross-platform
Avalonia/.NET UI library built around **"The Intellectual Minimalist"** design
language ([`docs/design.md`](./docs/design.md)).

Starting in **2.0.0**, FsusUI drops Element Plus compatibility completely in
favor of 100% native `Fsus*` components, `<fsus-*>` tags, `.fsus-*` classes,
`data-*` state attributes, and single-layer `--fsus-*` design tokens.

> FsusUI 2.0 is under active stabilization on the `next` branch. Use documented
> entry points only; internal workspace packages (`@fsusui/*`), build scripts,
> and test fixtures are not public API.

## Architecture Highlights (2.0.0)

- **Native Vue 3.5+ Surface**: `defineProps<T>()` with reactive destructure,
  `defineModel()`, native Floating UI positioning (`@floating-ui/dom` as the
  sole published runtime dependency), and zero legacy `El*` / `--el-*` shims.
- **Pure ESM Output**: `ES2022+` modules only; CommonJS (`lib/`), legacy UMD
  bundles (`dist/index.full.*`), and duplicated type trees are removed.
- **Single-Layer CSS (`@layer`)**: `styles/fsus.css` consumes canonical
  `spec/tokens` `--fsus-*` variables directly; Markdown styles ship separately
  in `styles/markdown.css`.
- **Decoupled Heavy Features**: Markdown rendering/editing ships via
  `@ozwasyd/fsusui/markdown` and `@ozwasyd/fsusui/wasm` with `katex`,
  `mermaid`, and `shiki` as optional `peerDependencies`.
- **Zero-Dep Unified Motion & Dates**: `@ozwasyd/fsusui/motion` combines WAAPI,
  damped spring physics, FLIP layout, and scroll reveals without `gsap` or
  `motion-dom`; date/time pickers run on native `Date` + `Intl.DateTimeFormat`
  without `dayjs`.

## Install

The published package is `@ozwasyd/fsusui` on GitHub Packages
(`https://npm.pkg.github.com/`).

Configure the `@ozwasyd` scope in `.npmrc` (GitHub Packages requires a token
with `read:packages`), then install:

```bash
pnpm install @ozwasyd/fsusui
```

See [Installation](./docs/guide/installation.md) and
[npm registry publishing policy](./docs/releases/policy/npm-registry.md).

## Basic Vue Usage

```ts
import { createApp } from 'vue'
import FsusUI from '@ozwasyd/fsusui'
import '@ozwasyd/fsusui/styles/fsus.css'
import App from './App.vue'

createApp(App).use(FsusUI).mount('#app')
```

On-demand component, icon, motion, and Markdown imports:

```ts
import { FsusButton, FsusTable, FsusSelect } from '@ozwasyd/fsusui'
import { FsusIcon, FsusIconSearch, registerFsusIcon } from '@ozwasyd/fsusui/icons'
import { FsusMotion, runViewTransition } from '@ozwasyd/fsusui/motion'
import { FsusMarkdownRenderer, FsusMarkdownEditor } from '@ozwasyd/fsusui/markdown'
import '@ozwasyd/fsusui/styles/markdown.css'
```

## Runtime Requirements

| Runtime                    | Requirement                                |
| -------------------------- | ------------------------------------------ |
| Vue                        | `^3.5.0`                                   |
| Module format              | Pure ESM (`ES2022+`)                       |
| Browser baseline           | Chromium 106+ or equivalent ES2022 support |
| Repository Node.js         | Node 22+                                   |
| Repository package manager | pnpm 10                                    |
| TypeScript baseline        | TypeScript 6                               |

## Public API & Migration

- [Migrating from FsusUI v1 to v2](./docs/migration/v1-to-v2.md)
- [API stability](./docs/api-stability.md)
- [Component docs](./docs/components/overview.md)
- [Theme customization](./docs/theme/customization.md)
- [Theme token stability](./docs/theme/tokens.md)
- [Motion token stability](./docs/theme/motion.md)
- [Icons](./docs/icons.md)
- [Playground and demo app](./docs/playground.md)

## Development

```bash
pnpm install
pnpm -C vue/packages/demo-app dev
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Governance

- [Documentation center](./docs/index.md)
- [Documentation architecture](./docs/governance/documentation-architecture.md)
- [Design contract](./docs/design.md)
- [Release documentation](./docs/releases/README.md)
- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)
- [Notice and attribution](./NOTICE)
- [License](./LICENSE)

## Avalonia Trimming and AOT Library Boundary

The supported Avalonia packages target trimming- and AOT-compatible library
consumption. Resource reachability (AXAML, themes, icons, and generated
resources) and package metadata are included in the contract; final Native AOT
executables and third-party dynamic plugins remain consumer responsibilities.
