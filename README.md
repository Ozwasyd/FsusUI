# FsusUI

FsusUI is a public-preview Vue 3 component-library workspace derived from the
Element Plus ecosystem. It provides a preview package, FsusUI theme and motion
tokens, icon assets, WASM-capable runtime paths, Markdown components, and a demo
app for evaluation.

> FsusUI is currently in public preview. Documented components and theme tokens
> are available for evaluation, but internal package paths, undocumented
> Element Plus compatibility layers, build internals, and WASM internals may
> change before the first stable release.

## Status

| Area              | Status                                                         |
| ----------------- | -------------------------------------------------------------- |
| Release stage     | Public Preview                                                 |
| Package stability | Preview                                                        |
| API stability     | Experimental unless explicitly documented                      |
| Recommended use   | Evaluation, controlled internal adoption, FsusBlog integration |
| Production SLA    | None                                                           |

## Relationship To Element Plus

FsusUI is derived from Element Plus and keeps much of the Element Plus source
layout, component naming, and package structure. It does not claim full Element
Plus compatibility unless behavior is covered by local tests or explicit FsusUI
docs.

Public compatibility docs:

- [Element Plus compatibility policy](./docs/element-plus-compatibility.md)
- [Migration from Element Plus](./docs/migration/from-element-plus.md)
- [Element Plus attribution](./docs/legal/element-plus-attribution.md)

## Relationship To FsusBlog

FsusUI is a design-system foundation for FsusBlog, but the package is evaluated
as a standalone component library. FsusBlog-specific adapters and examples are
integration context, not public FsusUI API unless a public FsusUI document
explicitly says so.

## Install

Current public-preview distribution uses GitHub Packages.

Configure `.npmrc`:

```ini
@ozwasyd:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Install:

```bash
pnpm install @ozwasyd/element-plus
```

`GITHUB_TOKEN` needs `read:packages` permission for GitHub Packages installs.
The public npm registry policy is documented in
[npm registry publishing policy](./docs/release/npm-registry-policy.md).

## Basic Vue Usage

```ts
import { createApp } from 'vue'
import FsusUI from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/index.css'
import App from './App.vue'

createApp(App).use(FsusUI).mount('#app')
```

Icon imports:

```ts
import { Search } from '@ozwasyd/element-plus/icons-vue'
```

## Runtime Requirements

| Runtime                    | Requirement                                |
| -------------------------- | ------------------------------------------ |
| Vue                        | `^3.5.0`                                   |
| JavaScript target          | ES2022                                     |
| Browser baseline           | Chromium 106+ or equivalent ES2022 support |
| Repository Node.js         | Node 22+                                   |
| Repository package manager | pnpm 10                                    |
| TypeScript baseline        | TypeScript 6                               |

Consumers that target older browsers must transpile in their app build or stay
on Element Plus for the affected surface.

## Public API Boundaries

Use documented imports and docs pages:

- [API stability](./docs/api-stability.md)
- [Component docs](./docs/components/overview.md)
- [Theme customization](./docs/theme/customization.md)
- [Theme token stability](./docs/theme/tokens.md)
- [Motion token stability](./docs/theme/motion.md)
- [Icons](./docs/icons.md)
- [Playground and demo app](./docs/playground.md)

Do not rely on undocumented `es/*`, `lib/*`, wildcard exports, `packages/*`,
`internal/*`, generated WASM files, build scripts, or test fixtures as public
API.

## Demo And Development

Repository setup:

```bash
pnpm install
```

Run the demo app:

```bash
pnpm -C packages/demo-app dev
```

Common checks:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run verify
```

Visual regression and public sample guidance are documented in
[playground docs](./docs/playground.md) and
[contributing docs](./CONTRIBUTING.md).

## Release Evidence

Public-preview readiness evidence:

- [Public preview release notes](./docs/releases/public-preview.md)
- [Secret and history scan](./release-evidence/public-preview/secret-history-scan.md)
- [Asset scan](./release-evidence/public-preview/asset-scan.md)
- [Package content audit](./release-evidence/npm-public-preview/package-audit.md)
- [Consumer install evidence](./release-evidence/npm-public-preview/consumer-install.md)
- [Provenance policy](./release-evidence/npm-public-preview/provenance.md)

## Governance

- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)
- [Notice and attribution](./NOTICE)
- [License](./LICENSE)
