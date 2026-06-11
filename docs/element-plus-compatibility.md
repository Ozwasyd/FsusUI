# Element Plus Compatibility Policy

FsusUI is derived from the Element Plus package structure, but it is not a
drop-in compatibility guarantee for every Element Plus runtime, build, and deep
import behavior. Compatibility is best-effort unless a behavior is documented
or covered by local tests.

## Compatibility Baseline

| Area              | FsusUI policy                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Package name      | External consumers install `@ozwasyd/element-plus`. Internal source packages may still use `element-plus` names. |
| Vue runtime       | Vue 3.5+ is the supported peer dependency.                                                                       |
| JavaScript target | ES2022 output is expected. Consumers must use modern browsers or transpile in their app.                         |
| Node and pnpm     | Repository development uses Node 22 and pnpm 10.                                                                 |
| TypeScript        | The workspace is maintained against the TypeScript version pinned in the root lockfile.                          |
| Theme system      | Element Plus CSS variables remain the compatibility base, with FsusUI semantic aliases layered on top.           |
| Motion system     | FsusUI adds ConfigProvider motion modes and `--fsus-motion-*` tokens. Element Plus does not define these.        |
| WASM acceleration | WASM-backed code paths are FsusUI additions and are experimental unless documented by a public wrapper.          |
| Markdown runtime  | Markdown renderer/editor APIs are FsusUI additions and are experimental during public preview.                   |
| Render pipeline   | Render budget and adapter APIs are FsusUI additions and are experimental.                                        |

## Supported Surface

The following surfaces are part of the public preview when used through
documented imports:

- Components documented under [`docs/components/`](./components/).
- The main package import from `@ozwasyd/element-plus`.
- Built stylesheet imports such as `@ozwasyd/element-plus/dist/index.css`.
- Documented theme assets under `theme-chalk`.
- Locale usage through documented ConfigProvider and locale import flows.
- Icon imports through `@ozwasyd/element-plus/icons-vue`.
- Documented subpaths in [`docs/api-stability.md`](./api-stability.md).

## Unsupported Surface

The following surfaces are internal or unsupported for external consumers:

- `internal/*` workspace packages.
- Undocumented `packages/*` source imports.
- Deep imports from `es/*`, `lib/*`, or wildcard package paths unless a doc page
  names the import.
- Build scripts, gulp tasks, generated metadata, and package fixture data.
- WASM generated modules, worker internals, and Emscripten glue files.
- FsusBlog-specific adapters and examples outside their documented integration
  purpose.

## Known Differences From Element Plus

| Topic             | Difference                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Browser support   | FsusUI targets ES2022 and does not claim Element Plus' older browser baseline.                                   |
| Package registry  | Public preview publishing uses the npm public registry. Dist-tag and provenance rules are documented separately. |
| Theme defaults    | FsusUI uses an academic-blue visual direction and additional semantic tokens.                                    |
| Motion behavior   | Components can receive reduced or disabled motion settings through ConfigProvider.                               |
| Markdown features | Markdown rendering, code highlighting, math, Mermaid, and related runtime helpers are FsusUI-specific.           |
| Render budgets    | The render-pipeline API is specific to FsusUI public-shell and integration work.                                 |
| Result mode       | `FsusResult<T>` is a FsusUI contract for recoverable failures.                                                   |

## Testing Standard

A compatibility claim should be treated as supported only after one of these is
true:

- A unit or integration test covers the behavior.
- A visual or accessibility test covers the interaction or rendering behavior.
- A consumer-install smoke test verifies the import from the packaged artifact.
- A component or migration doc page explicitly names the behavior and its known
  limits.

## Migration Guidance

Use [`docs/migration/from-element-plus.md`](./migration/from-element-plus.md)
for package rename, CSS import, icon import, and runtime-target changes.
