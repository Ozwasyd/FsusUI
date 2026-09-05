# FsusUI

FsusUI is a Vue 3 component library derived from Element Plus. Use “FsusUI” in
documentation and adoption guidance; Element Plus remains the upstream
provenance and compatibility context. The workspace includes the preview
package, theme and motion tokens, icons, WASM-capable runtime paths, Markdown
components, and a demo app.

> FsusUI is in public preview. Documented components and theme tokens are
> available for evaluation; internal paths, undocumented compatibility layers,
> build internals, and WASM internals may change before the first stable release.

## Status

| Area              | Status |
| ---               | --- |
| Release stage     | Public Preview |
| Package stability | Preview |
| API stability     | Experimental unless explicitly documented |
| Recommended use   | Evaluation, controlled internal adoption, FsusBlog integration |
| Production SLA    | None |

## Relationship To Element Plus

FsusUI retains much of the Element Plus source layout, component naming, and
package structure. Full Element Plus compatibility is claimed only where local
tests or explicit FsusUI docs cover the behavior.

Public compatibility docs:

- [Element Plus compatibility policy](./docs/element-plus-compatibility.md)
- [Migration from Element Plus](./docs/migration/from-element-plus.md)
- [Element Plus attribution](./docs/legal/element-plus-attribution.md)

## Relationship To FsusBlog

FsusUI is a design-system foundation for FsusBlog but is evaluated as a
standalone library. FsusBlog adapters and examples are integration context, not
public FsusUI API unless an FsusUI document explicitly says so.

## Install

The public-preview package is `@ozwasyd/element-plus` on the npm public
registry (`https://registry.npmjs.org/`). It is FsusUI’s compatibility build,
not the upstream Element Plus package.

Install:

```bash
pnpm install @ozwasyd/element-plus
```

No package-specific `.npmrc` or GitHub package token is required. The npm
registry policy is documented in
[npm registry publishing policy](./docs/releases/policy/npm-registry.md).

## Basic Vue Usage

```ts
import { createApp } from 'vue'
import FsusUI from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/fsus.css'
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

Use only documented imports and docs pages:

- [API stability](./docs/api-stability.md)
- [Component docs](./docs/components/overview.md)
- [Theme customization](./docs/theme/customization.md)
- [Theme token stability](./docs/theme/tokens.md)
- [Motion token stability](./docs/theme/motion.md)
- [Icons](./docs/icons.md)
- [Playground and demo app](./docs/playground.md)

Do not rely on undocumented `es/*`, `lib/*`, wildcard exports,
`vue/packages/*`, `vue/internal/*`, generated WASM files, build scripts, or test
fixtures as public API.

## Demo And Development

Repository setup:

```bash
pnpm install
```

Run the demo app from its workspace path:

```bash
pnpm -C vue/packages/demo-app dev
```

Common checks:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run verify
```

See [playground docs](./docs/playground.md) and [contributing](./CONTRIBUTING.md)
for visual regression and public-sample guidance.

## Release Documentation and Evidence

The release-domain map is maintained in [docs/releases/](./docs/releases/README.md).
Public-preview readiness evidence includes:

- [Public preview release notes](./docs/releases/channels/public-preview.md)
- [Secret and history scan](./docs/releases/evidence/public-preview/secret-history-scan.md)
- [Asset scan](./docs/releases/evidence/public-preview/asset-scan.md)
- [Package content audit](./docs/releases/evidence/npm-public-preview/package-audit.md)
- [Consumer install evidence](./docs/releases/evidence/npm-public-preview/consumer-install.md)
- [Provenance plan and evidence](./docs/releases/evidence/npm-public-preview/provenance.md)

## Governance

- [Documentation center](./docs/index.md)
- [Documentation architecture](./docs/governance/documentation-architecture.md)
- [Design documentation](./docs/design/README.md)
- [Release documentation](./docs/releases/README.md)
- [Consumer integration boundary](./docs/consumers/design-integration.md)
- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)
- [Notice and attribution](./NOTICE)
- [License](./LICENSE)

## Avalonia trimming and AOT library boundary

The supported Avalonia packages target trimming- and AOT-compatible library
consumption. This library contract does not create or validate a final Native
AOT executable, RID-specific binary, or third-party plugin guarantee. Resource
reachability (AXAML, themes, icons, and generated resources) and package
metadata are included in the contract.

It applies only to documented public Avalonia packages and their declared
metadata. Third-party plugin discovery, runtime assembly/type loading, runtime
code generation, and other dynamic extensions are consumer responsibilities.
