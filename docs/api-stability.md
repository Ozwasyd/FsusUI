# Public API Stability

FsusUI is in public preview. The repository still carries selected Element Plus
compatibility subpaths, so this policy defines which surfaces are public API and
which surfaces are implementation detail.

## Stability Levels

| Level              | Meaning                                                                              | Change policy during public preview                                      |
| ------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Stable public API  | Documented, tested, and intended for broad external use.                             | Breaking changes require a major version or a documented migration path. |
| Preview public API | Documented and intended for external use, but still allowed to change before 1.0 GA. | Breaking changes require release notes and migration guidance.           |
| Experimental API   | Documented for early adopters only. Shape, defaults, and behavior may change.        | Breaking changes can happen in minor releases with explicit notes.       |
| Internal API       | Not supported for external consumers, even if it is exported by package metadata.    | May change or disappear without notice.                                  |
| Deprecated API     | Still present for compatibility, but scheduled for removal or replacement.           | Removal requires release notes and, where practical, an alternative.     |

## Minimum Public Contract

- A surface is public only when it is documented in this repository.
- Unlisted package subpaths are encapsulated by `package.json` exports.
  Compatibility directory exports do not make undocumented symbols stable API.
- `vue/internal/*` workspace packages are build and maintenance utilities, not
  runtime public API.
- Gulp tasks, build scripts, generated metadata, fixture data, and test helpers
  are internal.
- WASM generated files, Emscripten glue code, worker implementations, and SIMD
  tuning details are internal unless a specific wrapper is documented.
- FsusBlog-specific adapters, examples, and migration helpers are product
  integration references, not general-purpose FsusUI API.

## Package Entry Points

The published package name is currently `@ozwasyd/element-plus`.

| Import path                                                                               | Level                  | Notes                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ozwasyd/element-plus`                                                                   | Preview public API     | Main Vue plugin, component exports, directives, hooks, constants, installer helpers, `version`, and `dayjs`.                                                                                                                                                                                  |
| `@ozwasyd/element-plus/global`                                                            | Preview public API     | Type-only global component declarations.                                                                                                                                                                                                                                                      |
| `@ozwasyd/element-plus/es`                                                                | Preview public API     | ESM aggregate entry for bundlers that need an explicit module path.                                                                                                                                                                                                                           |
| `@ozwasyd/element-plus/lib`                                                               | Preview public API     | CommonJS aggregate entry for legacy build pipelines.                                                                                                                                                                                                                                          |
| `@ozwasyd/element-plus/icons-vue`                                                         | Preview public API     | Icon package bridge for consumers migrating from `@element-plus/icons-vue`.                                                                                                                                                                                                                   |
| `@ozwasyd/element-plus/theme`                                                             | Preview public API     | Theme mode helpers and documented theme contracts.                                                                                                                                                                                                                                            |
| `@ozwasyd/element-plus/result`                                                            | Preview public API     | `FsusResult<T>` helpers and documented result-mode utilities.                                                                                                                                                                                                                                 |
| `@ozwasyd/element-plus/render-pipeline`                                                   | Experimental API       | Render budget and adapter primitives. Use only when the integration has tests against this repository.                                                                                                                                                                                        |
| `@ozwasyd/element-plus/wasm`                                                              | Experimental API       | Public wrapper for accelerated paths. Generated internals remain unsupported.                                                                                                                                                                                                                 |
| `@ozwasyd/element-plus/markdown-runtime`                                                  | Experimental API       | Runtime primitives used by Markdown components. Projection consumers are documented in `docs/api/markdown-runtime-projection.md`. Editor input planners are documented in `docs/api/markdown-editor-input.md`. Interaction traces are documented in `docs/api/markdown-interaction-trace.md`. |
| `@ozwasyd/element-plus/motion`                                                            | Preview public API     | Motion runtime: `FsuMotion` plugin, `FsuTransition`, `vMotion` / `vScrollReveal` directives, `runMotion` / `cancelMotion`, `useScrollReveal` / `useMotionRouteCleanup`, preset + recipe lookups, governance validators, and all motion types.                                                 |
| `@ozwasyd/element-plus/perception-challenge`                                              | Preview public API     | Perception challenge components (`ElPerceptionChallenge`, `ElPerceptionCharacterChallenge`, `ElTextTaskChallenge`, `ElLocalizationChallenge`, `ElMicroInteractionChallenge` and `Fsus*` aliases) plus the typed contracts from `perception-challenge/src/instance.ts`.                        |
| `@ozwasyd/element-plus/dist/fsus.css`                                                     | Preview public API     | Complete FsusUI production theme: compatibility component CSS followed by product tokens and overrides.                                                                                                                                                                                       |
| `@ozwasyd/element-plus/dist/index.css`                                                    | Compatibility API      | Element Plus-compatible base component CSS; it intentionally omits FsusUI product overrides.                                                                                                                                                                                                  |
| `@ozwasyd/element-plus/dist/public-shell-critical.css`                                    | Preview public API     | Critical CSS for the public shell component.                                                                                                                                                                                                                                                  |
| `@ozwasyd/element-plus/theme-chalk/*`                                                     | Preview public API     | Built CSS and SCSS theme assets documented by the theme guides.                                                                                                                                                                                                                               |
| `@ozwasyd/element-plus/es/{components,constants,directives,hooks,locale,motion,utils}/*`  | Compatibility API      | ESM compatibility paths required by documented components, locale loading, generated declarations, and supported migration tooling. Extensionless and native `.mjs` spellings are supported. Only documented symbols receive stability guarantees.                                            |
| `@ozwasyd/element-plus/lib/{components,constants,directives,hooks,locale,motion,utils}/*` | Compatibility API      | CommonJS counterpart of the curated ESM compatibility directories; extensionless and native `.js` spellings are supported.                                                                                                                                                                    |
| `@ozwasyd/element-plus/es/wasm/*`                                                         | Internal, not exported | Generated WASM modules, runtime helpers, and the Markdown output gateway are package internals. Use `/wasm` or `/markdown-runtime`.                                                                                                                                                           |
| `@ozwasyd/element-plus/lib/wasm/*`                                                        | Internal, not exported | CommonJS generated WASM internals are encapsulated by the same package boundary.                                                                                                                                                                                                              |
| Any other unlisted top-level or deep subpath                                              | Internal, not exported | Use the root package, a named public entry above, documented component or locale compatibility paths, or `theme-chalk/*`.                                                                                                                                                                     |

## Component Package Groups

Public preview component APIs include the Vue component props, emits, slots, and
exposed methods documented under `docs/components/`. Compatibility with Element
Plus is best-effort unless the behavior has a local test or an explicit FsusUI
doc page.

- `components`: preview public when documented under `docs/components/`.
- `directives`: preview public when exported from the main package and covered
  by component or guide docs.
- `hooks`: preview public only for hooks exported by the main package and used
  in public guides.
- `constants`: preview public only for documented constants.
- `utils`: internal by default. Treat utility deep imports as unsupported.
- `locale`: preview public for documented locale imports and ConfigProvider
  usage.
- `theme-chalk`: preview public for documented CSS and SCSS entry points.
- `icons-vue`: preview public for exported icon components and package-level
  imports.

## Theme Token Stability

Theme token stability is tracked separately in
[`docs/theme/tokens.md`](./theme/tokens.md). Public preview tokens include the
documented Element Plus-compatible CSS custom properties and the FsusUI semantic
aliases listed there.

Unlisted `--fsus-*` and component-private CSS variables are internal. They can
change as component styling is normalized for the public preview.

## Motion Token Stability

Motion token stability is tracked in
[`docs/theme/motion.md`](./theme/motion.md). The high-level timing tokens and
ConfigProvider `motion` settings are preview public API. Low-level scroll,
drag, trail, blur, and spring tokens are experimental unless they are promoted
in that document.

## Compatibility Claims

Any compatibility claim against Element Plus must be backed by at least one of
the following:

- A local unit, visual, accessibility, or consumer-install test.
- A component doc page that names the supported behavior.
- A migration guide entry that names the expected difference.
- A release evidence document that records the command and result.

When none of those exists, the behavior should be described as best-effort or
implementation detail.
