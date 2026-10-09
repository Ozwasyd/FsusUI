# Motion prop generation: shared loader handoff

This is a reproduction, not an implemented component repair. The source remains
exactly `f4a094f300384185918fc6d4be86e88d9ab9f097`; the branch starts at its
README-only successor `dc3030f4e5ec410c5f09969cc664f9f4caab1a07`.

The immutable original observations are under
[public-declaration-four-component-f4a094](https://github.com/Ozwasyd/FsusUI/tree/736b981fba100a0c2e956e74b61ddef62ff4d508/docs/releases/evidence/public-declaration-four-component-f4a094).
No original comparator, fixture, dependency, compiler configuration, or generated
Motion artifact is modified by this branch.

## Reproduce

Use the original frozen lockfile, Node 24.19.0 and pnpm 10.33.0. The original
lock resolves better-define 1.11.4, macro API 0.13.4 and Vue 3.5.32.

```sh
pnpm install --frozen-lockfile
node --test tests/motion-transition-prop-determinism.test.mjs
node tests/fixtures/motion-transition-prop-determinism/observe.mjs "$PWD" cold
node tests/fixtures/motion-transition-prop-determinism/observe.mjs "$PWD" serial-namespaces
node tests/fixtures/motion-transition-prop-determinism/observe.mjs "$PWD" concurrent-namespaces
node tests/fixtures/motion-transition-prop-determinism/observe.mjs "$PWD" concurrent-components
node tests/fixtures/motion-transition-prop-determinism/observe.mjs "$PWD" namespace-readiness
```

For two actual package outputs extracted with their runtime dependencies
available, run the original nine module controls and a raw reflection assertion:

```sh
node tests/fixtures/motion-transition-prop-determinism/runtime-controls.mjs \
  "$PWD" /absolute/before/lib/motion/components/FsuTransition.vue2.js \
  /absolute/after/lib/motion/components/FsuTransition.vue2.js \
  /absolute/motion-runtime-controls.json
```

The JSON is written before asserting metadata parity. A metadata failure remains
an exit-code failure even when all nine behavior controls pass.

Each observation uses a fresh process and the original supported compiler APIs.
The component warm-up preserves all errors; it does not silently discard failed
transforms. The reduced reproduction loads the same three real declarations and
changes only serial versus concurrent namespace resolution.

Observed test result: **3 PASS, 2 FAIL**, with no skipped or cancelled tests.
The failures deliberately retain the required determinism and readiness
invariants. They must become green through the shared loader repair, rather than
by accepting either observed metadata shape.

| Context                    | Development mode metadata         | Production mode metadata |
| -------------------------- | --------------------------------- | ------------------------ |
| Cold                       | `{ required: false }`             | `null`                   |
| Serial real namespaces     | `{ required: false }`             | `null`                   |
| Concurrent real namespaces | `{ type: null, required: false }` | `null`                   |

Matched repetitions within each reduced context are identical. Production code
is identical across these contexts and the original concurrent component load.
Development and production are intentionally compared separately.

The unchanged component SHA-256 is
`8d48b29954bc0fc0bb0127aec62632336f4c7bccbaddb1a70673ed4370ce5364`.
The complete development transform SHA-256 values are respectively
`d56af313688bfc77ffce9a19d2d02b16f227484ba9d2d0e487dd3a27af1359df`
and `e5384487b7fcdec04bae6ea41a7d876171b6478b61f2f472773efbbd04639078`.
The matched production value is
`2847e7b576386adb24285fb27c11464d5c9778f7b5316467cd0e4f77a2c20535`.

## Original producer and actual package observations

The diagnostic preload establishes the same serial namespace context before the
original Gulp producer. It must not be installed as a production workaround:

```sh
NPM_CONFIG_CACHE=/tmp/motion-npm-cache pnpm run package:candidate:build -- --output /absolute/default-output
MOTION_REPRO_ROOT="$PWD" \
NODE_OPTIONS="--import=$PWD/tests/fixtures/motion-transition-prop-determinism/preload-serial.mjs" \
NPM_CONFIG_CACHE=/tmp/motion-npm-cache \
pnpm run package:candidate:build -- --output /absolute/serial-output
```

The original canonical producer reported zero declaration diagnostics in both
contexts. The default-context producer and a repeated original `buildModules`
task emitted identical pre-package Motion modules. Their SHA-256 values are
`8076c6ef5650826f8dcbc9d80fc9429094675b62144ba47d6799eb2f3432db73`
(CJS) and
`e17eee4aee3720e5a81acbc6d7684edc605ef1d6a8c3cf712f6528ae3cf29c2a`
(ESM). Compare stages consistently: package preparation rewrites emitted imports.

Actual packed runtime comparison retains **FAIL**, with 4,432 JavaScript/MJS
files on each side, no added or removed files, and three differing files:

- `es/motion/components/FsuTransition.vue2.mjs`: mode metadata;
- `lib/motion/components/FsuTransition.vue2.js`: mode metadata;
- `dist/index.full.mjs`: order of the `readonly`/`shallowRef` Vue imports only.

The UMD and minified aggregates are byte-identical. All 2,523 declaration files
are byte-identical. The aggregate import-order difference is retained separately;
it is not attributed to the Motion metadata defect or removed from comparison.
Serial/default tarball SHA-256 values are respectively
`85d682a5524cb338e5fb6950e5d871038104eb8af08667eea2928a534c977fff`
and `28e6b13c4688ce7e74d9ca1e9317576e8b841d750de1459ccd80e9f4122faa91`.
Both manifests identify source `dc3030f4e5ec410c5f09969cc664f9f4caab1a07`,
Node 24.19.0 and pnpm 10.33.0; the component is identical to `f4a094`.

The original nine actual CJS mode value/casting/validation/render controls pass;
the separate own-property assertion fails. The existing Motion suite passes
38/38. The original six date-picker/date-time-picker/slider/cascader/select/options
files were preflighted with the unchanged Vitest configuration, setup hook and
cleanup hooks: exactly 206 listed tests, followed by 206/206 passing in the focused
run. A mistaken wrapper invocation started a broader run; it was interrupted
and its failing Markdown-renderer result retained outside this branch. It is not
used as focused verification, and no held source was modified.

The installed original strict Bundler observer passes the aggregate, four
positive owner fixtures and all 48 expected negative diagnostics, with zero
external diagnostics. Its original Node16 rows remain FAIL with 68 external
diagnostics and are separately owned. The focused public mode-type limitation
below remains FAIL. None of these failures is waived by the successful controls.

Initial cache/path-related build and pack failures were retained. The repository's
existing fingerprint checks accepted copied, unchanged WASM/icon prerequisite
artifacts from the original checkout; no generated Motion output was patched.
The successful default package producer uses a writable uppercase
`NPM_CONFIG_CACHE`; the original pack helper removes lowercase `npm_config_*`.

## Exact implicated source and hunk for original827

The upstream source is **@vue-macros/api 0.13.4,
`src/ts/namespace.ts`, `resolveTSNamespace`**. Its published CJS implementation
is `dist/index.cjs:565`, SHA-256
`a14c91231a06c36e7f2c4860a7e83eeb4370c6599d0258f1b86e5cc4f5e5276d`.
The ESM implementation is `dist/index.js:521`, SHA-256
`0d1df48cc906df742fe794f271a8a3471269caf01b25cc093874094b8473d6ee`.

The relevant existing code is:

```js
async function resolveTSNamespace(scope) {
  if (scope.exports) return
  const exports = { [namespaceSymbol]: true }
  scope.exports = exports
  // ... declarations are initialized before awaited resolution ...
  // ExportAllDeclaration:
  await resolveTSNamespace(sourceScope)
  Object.assign(exports, sourceScope.exports)
  // ImportDeclaration:
  await resolveTSNamespace(importScope)
  const exports2 = importScope.exports
  // ... declarations[local] = imported ...
}
```

`scope.exports` means "started" here, but the early return also treats it as
"completed". A concurrent caller can return before `TransitionProps` exists.
Concurrent resolution of the three actual Vue namespaces leaves runtime-dom's
`declarations.BaseTransitionProps` undefined, despite runtime-core's completed
`exports.BaseTransitionProps` being present. The missing declaration persists
after all three promises settle. Serial resolution retains both declarations.
The real component's inherited indexed access then produces the differing raw
metadata. This is not caused by a component source difference.

The caller boundary owned by original827 is the VueMacros plugin construction in
`vue/internal/build/src/tasks/modules.ts:38` and
`vue/internal/build/src/tasks/full-bundle.ts:49`. The emitted module task uses
Vue `isProduction: false`; the full bundle task uses `true`. The better-define
plugin also has its own production option. Preserve these distinctions when
repairing the loader or coordinating a shared integration hunk.

A loader repair must distinguish in-flight resolution from completed exports
and retain recursive declaration/cycle handling. Simply awaiting a cached
promise for every recursive import is not a reviewed fix and can deadlock on
cycles. No dependency patch, plugin serialization workaround, upgrade, or
component metadata override is included here.

## Additional inherited declaration limitation

The packed public component also fails the focused strict mode-type controls in
`mode-positive.ts` and `mode-negative.ts`. Copy these unchanged into an installed
consumer before compiling each with TypeScript 6.0.2, strict mode, Bundler
resolution and `skipLibCheck: false`. The positive identity assertion must have
zero diagnostics; the two negative assignments must have exactly two diagnostics.

Observed on the unchanged-source serial-context package: the positive assertion
has one TS2344 diagnostic and the negative assignments have zero diagnostics.
The canonical producer emits `mode: { type: null; required: false }`, which loses
the source's `TransitionProps['mode']` typing in the public extracted props.
This limitation was not covered by the original aggregate Motion probe. It is
separate from the runtime load-order defect and is not introduced by this branch.
The relevant shared producer hunk is
`vue/internal/build/src/tasks/types-definitions.ts:241`, which uses the original
Vue `compileScript` result for ts-morph declaration emission. That producer is
read-only in this task; preserve its original diagnostics and configuration.

Changeset not needed: this branch adds internal reproduction tests and fixtures
only. No consumer-visible implementation change or visual acceptance is claimed.
Node16 boundary failures remain owned by original827. PR, comment, label,
readiness and merge actions remain on hold.
