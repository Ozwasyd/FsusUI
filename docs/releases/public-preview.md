# Public Preview Release Notes

FsusUI public preview is intended for evaluation, controlled internal adoption,
and FsusBlog integration. It is not a stable production SLA release.

## Release Status

```text
Status: Public Preview
API stability: Experimental unless explicitly documented
Package stability: Preview
Recommended use: Evaluation, controlled internal adoption, FsusBlog integration
Production SLA: None
```

Documented components, package entry points, theme tokens, and motion tokens are
classified in [`docs/api-stability.md`](../api-stability.md),
[`docs/theme/tokens.md`](../theme/tokens.md), and
[`docs/theme/motion.md`](../theme/motion.md).

## Available Packages

| Package or path                          | Status                 | Notes                                                     |
| ---------------------------------------- | ---------------------- | --------------------------------------------------------- |
| `@ozwasyd/element-plus`                  | Preview public package | Main install package for public preview.                  |
| `@ozwasyd/element-plus/icons-vue`        | Preview public path    | Icon component bridge for consumers.                      |
| `@ozwasyd/element-plus/theme-chalk/*`    | Preview public assets  | Documented CSS and SCSS theme assets.                     |
| `@ozwasyd/element-plus/render-pipeline`  | Experimental path      | Render budget and adapter primitives.                     |
| `@ozwasyd/element-plus/wasm`             | Experimental path      | Public WASM wrapper; generated internals are unsupported. |
| `@ozwasyd/element-plus/markdown-runtime` | Experimental path      | Runtime helpers for Markdown components.                  |

Internal workspace packages under `vue/internal/*` are not public API.

## Installation

Current public-preview distribution uses npm public registry:
`https://registry.npmjs.org/`.

```bash
pnpm install @ozwasyd/element-plus
```

Consumer usage:

```ts
import { createApp } from 'vue'
import FsusUI from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/index.css'
import App from './App.vue'

createApp(App).use(FsusUI).mount('#app')
```

The npm registry publishing policy is documented in
[`docs/release/npm-registry-policy.md`](../release/npm-registry-policy.md).

## Known Limitations

- FsusUI is derived from Element Plus but does not claim full Element Plus
  compatibility.
- Minimum runtime target differs from Element Plus; FsusUI expects ES2022 and
  Vue 3.5+.
- Undocumented `es/*`, `lib/*`, wildcard paths, build internals, generated
  WASM files, and `vue/internal/*` packages are unsupported.
- Markdown rendering, WASM acceleration, and render pipeline APIs are
  experimental during public preview.
- Visual regression coverage exists for demo/audit states, but full a11y matrix
  and online docs site are future work.

## Compatibility Status

Compatibility is best-effort unless covered by local tests or explicit docs.
See [`docs/element-plus-compatibility.md`](../element-plus-compatibility.md)
and [`docs/migration/from-element-plus.md`](../migration/from-element-plus.md).

## Release Verification Evidence

| Evidence                | Status                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| Secret and history scan | Recorded in `release-evidence/public-preview/secret-history-scan.md`.  |
| Asset scan              | Recorded in `release-evidence/public-preview/asset-scan.md`.           |
| Package dry-run audit   | Recorded in `release-evidence/npm-public-preview/package-audit.md`.    |
| Consumer install test   | Recorded in `release-evidence/npm-public-preview/consumer-install.md`. |
| Provenance policy       | Recorded in `release-evidence/npm-public-preview/provenance.md`.       |

Version tags determine dist-tags: stable `X.Y.Z` releases publish to `latest`,
`preview` prereleases publish to `preview`, and `alpha` / `beta` / `rc` /
`next` prereleases publish to `next`.
