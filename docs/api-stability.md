# Public API Stability

FsusUI is in public preview and retains selected Element Plus compatibility
subpaths. This policy distinguishes public API from implementation detail.

## Stability Levels

| Level              | Meaning                                                                              | Change policy during public preview                                      |
| ------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Stable public API  | Documented, tested, and intended for broad external use.                             | Breaking changes require a major version or a documented migration path. |
| Preview public API | Documented and intended for external use, but still allowed to change before 1.0 GA. | Breaking changes require release notes and migration guidance.           |
| Experimental API   | Documented for early adopters only. Shape, defaults, and behavior may change.        | Breaking changes can happen in minor releases with explicit notes.       |
| Internal API       | Not supported for external consumers, even if it is exported by package metadata.    | May change or disappear without notice.                                  |
| Deprecated API     | Still present for compatibility, but scheduled for removal or replacement.           | Removal requires release notes and, where practical, an alternative.     |

## Minimum Public Contract

- A surface is public only when documented in this repository.
- Unlisted package subpaths are encapsulated by `package.json` exports;
  compatibility-directory exports do not make undocumented symbols stable API.
- `vue/internal/*` workspace packages are build/maintenance utilities, not runtime
  public API. Gulp tasks, build scripts, generated metadata, fixture data, and
  test helpers are internal.
- WASM generated files, Emscripten glue, worker implementations, and SIMD tuning
  are internal unless a specific wrapper is documented.
- FsusBlog-specific adapters, examples, and migration helpers are product
  integration references, not general-purpose FsusUI API.

## Package Entry Points

The published package name is currently `@ozwasyd/element-plus`.

| Import path | Level | Notes |
| --- | --- | --- |
| `@ozwasyd/element-plus` | Preview public API | Main Vue plugin, component exports, directives, hooks, constants, installer helpers, `version`, and `dayjs`. |
| `@ozwasyd/element-plus/global` | Preview public API | Type-only global component declarations. |
| `@ozwasyd/element-plus/es` | Preview public API | ESM aggregate entry for bundlers requiring an explicit module path. |
| `@ozwasyd/element-plus/lib` | Preview public API | CommonJS aggregate entry for legacy pipelines. |
| `@ozwasyd/element-plus/icons-vue` | Preview public API | Icon bridge for consumers migrating from `@element-plus/icons-vue`. |
| `@ozwasyd/element-plus/theme` | Preview public API | Theme-mode helpers and documented theme contracts. |
| `@ozwasyd/element-plus/result` | Preview public API | `FsusResult<T>` helpers and documented result-mode utilities. |
| `@ozwasyd/element-plus/render-pipeline` | Experimental API | Render-budget and adapter primitives; use only with repository tests. |
| `@ozwasyd/element-plus/wasm` | Experimental API | Public accelerated-path wrapper; generated internals remain unsupported. |
| `@ozwasyd/element-plus/markdown-runtime` | Experimental API | Markdown runtime primitives. Projection, editor-input, and interaction-trace consumers are documented in `docs/api/markdown-runtime-projection.md`, `docs/api/markdown-editor-input.md`, and `docs/api/markdown-interaction-trace.md`. |
| `@ozwasyd/element-plus/motion` | Preview public API | Motion runtime: `FsuMotion`, `FsuTransition`, `vMotion` / `vScrollReveal`, `runMotion` / `cancelMotion`, `useScrollReveal` / `useMotionRouteCleanup`, preset/recipe lookups, governance validators, and motion types. |
| `@ozwasyd/element-plus/perception-challenge` | Preview public API | Perception challenge components (`ElPerceptionChallenge`, `ElPerceptionCharacterChallenge`, `ElTextTaskChallenge`, `ElLocalizationChallenge`, `ElMicroInteractionChallenge`, and `Fsus*` aliases) plus typed contracts from `perception-challenge/src/instance.ts`. |
| `@ozwasyd/element-plus/dist/fsus.css` | Preview public API | Complete production theme: compatibility CSS followed by product tokens and overrides. |
| `@ozwasyd/element-plus/dist/index.css` | Compatibility API | Element Plus-compatible base CSS; it omits FsusUI product overrides. |
| `@ozwasyd/element-plus/dist/public-shell-critical.css` | Preview public API | Public-shell critical CSS. |
| `@ozwasyd/element-plus/theme-chalk/*` | Preview public API | Built CSS and SCSS assets documented by theme guides. |
| `@ozwasyd/element-plus/es/{components,constants,directives,hooks,locale,motion,utils}/*` | Compatibility API | ESM compatibility paths used by documented components, locale loading, declarations, and migration tooling. Extensionless and native `.mjs` spellings are supported; only documented symbols receive stability guarantees. |
| `@ozwasyd/element-plus/lib/{components,constants,directives,hooks,locale,motion,utils}/*` | Compatibility API | CommonJS counterpart; extensionless and native `.js` spellings are supported. |
| `@ozwasyd/element-plus/es/wasm/*` | Internal, not exported | Generated WASM modules, runtime helpers, and Markdown output gateway. Use `/wasm` or `/markdown-runtime`. |
| `@ozwasyd/element-plus/lib/wasm/*` | Internal, not exported | CommonJS generated WASM internals in the same package boundary. |
| Any other unlisted top-level or deep subpath | Internal, not exported | Use the root package, a named public entry above, documented component/locale compatibility paths, or `theme-chalk/*`. |

## Component Package Groups

Node module resolution uses separate declarations for ESM `import` and CommonJS
`require` entry points. ESM declarations use `.d.mts` with explicit relative
module extensions; CommonJS declarations retain `.d.ts` and explicitly select
ESM dependency types where needed. The runtime entry points are unchanged.
Under native Node ESM interoperability, a default import from CommonJS represents
`module.exports`; it does not automatically unwrap its `default` property.
Bundler interoperability can differ. This distinction is not a new component API.

The generated CommonJS and global declarations use stable `resolution-mode`
import attributes, whose syntax requires TypeScript 5.3 or newer. Consumers on
older compilers must upgrade before adopting this declaration format. The
strict installed-package checks use the repository-pinned TypeScript 6.0.2;
this syntax requirement does not establish validation for other versions.

Preview component APIs include Vue props, emits, slots, and exposed methods
documented under `docs/components/`. Element Plus compatibility is best-effort
unless covered by a local test or explicit FsusUI doc page.

- `components`: preview public when documented under `docs/components/`.
- `directives`: preview public when exported from the main package and covered by component or guide docs.
- `hooks`: preview public only when exported from the main package and used in public guides.
- `constants`: preview public only for documented constants.
- `utils`: internal by default. Treat utility deep imports as unsupported.
- `locale`: preview public for documented locale imports and ConfigProvider usage.
- `theme-chalk`: preview public for documented CSS and SCSS entry points.
- `icons-vue`: preview public for exported icon components and package-level
  imports.

## Theme Token Stability

Theme token stability is tracked in [`docs/theme/tokens.md`](./theme/tokens.md).
Preview tokens include the documented Element Plus-compatible CSS custom
properties and FsusUI semantic aliases listed there.

Unlisted `--fsus-*` and component-private CSS variables are internal. They can
change as component styling is normalized for the public preview.

## Motion Token Stability

Motion token stability is tracked in [`docs/theme/motion.md`](./theme/motion.md).
High-level timing tokens and ConfigProvider `motion` settings are preview public
API; low-level scroll, drag, trail, blur, and spring tokens are experimental
unless promoted there.

## Compatibility Claims

Any Element Plus compatibility claim must have at least one of:

- A local unit, visual, accessibility, or consumer-install test;
- a component doc page naming the supported behavior;
- a migration guide entry naming the expected difference; or
- a release evidence document recording the command and result.

Without one, the behavior should be described as best-effort or implementation detail.
