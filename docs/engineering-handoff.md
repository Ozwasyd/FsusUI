# FsusUI Engineering Handoff

> **Role:** Maintainer handoff and operational reference
> **Applies to:** Local quality gates, CI diagnosis, visual regression, WASM,
> and cross-platform package lanes
> **Authority:** Commands and contracts remain owned by `package.json`, `spec/`,
> workflow files, and the linked domain documents.

This page is the shortest route for a new maintainer. It records commands and
diagnostic boundaries; release policy lives in [`docs/releases/governance.md`](./releases/governance.md),
and visual decisions follow [`docs/workflows/visual-change.md`](./workflows/visual-change.md).

## 1. Environment baseline

- Node.js `22.x` (or newer within the repository requirement)
- pnpm `10.33.0`
- TypeScript `6.0.x`
- Playwright Chromium for desktop/mobile and light/dark visual projects
- Emscripten `5.0.4` for WASM builds

Use this Node/pnpm baseline when diagnosing CI; do not attribute a failure to
the repository before checking an unsupported runtime.

## 2. Standard local gates

Minimal quality loop:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:unit
pnpm build
pnpm build:demo
pnpm verify
```

Expected results are zero lint/typecheck failures, a passing Vitest run, a
successful root build without `TS5103`, a successful production demo build,
and a passing `verify` chain. `pnpm verify` is the safe alias for
`verify:full`.

Coverage, visual, and release evidence are separate:

```bash
pnpm test:coverage
pnpm test:visual:full
pnpm verify:release
```

`test:coverage` must produce `coverage/lcov`; `test:visual:full` runs the
registered visual projects (plain `test:visual` only prints profile help);
`verify:release` adds the candidate and three-profile consumer chain. Release
acceptance still requires explicit coverage and visual-evidence runs.

<a id="wasm"></a>

## 3. WASM and Markdown

The WASM package is `vue/packages/wasm`. Its generated runtime includes:

- `ep_wasm.mjs/.wasm` for general acceleration such as table sorting and
  virtual-list row-height estimation;
- `markdown_basic.js/.wasm` for the scalar Markdown fallback; and
- `markdown_simd.js/.wasm` for SIMD Markdown rendering.

For Markdown changes, run the narrow gates first:

```bash
pnpm run build:wasm
pnpm run check:markdown-wasm
pnpm run check:markdown-wasm-runtime
pnpm run check:markdown-no-js-path
pnpm run check:markdown-extreme
```

The renderer does not ship a complete article layout theme. Public
`markdown-runtime` normalizes heading ids, hash/external links, CSP nonces,
Mermaid/LaTeX placeholders, and code-highlight mount points; consumers attach
business glue through `features-activated` and `placeholders-ready`. WASM must
retain the JavaScript fallback and must not publish debug-only artifacts or
source maps.

## 4. Motion ownership

Motion is implemented in FsusUI and consumed through public APIs:

- [`vue/packages/motion`](../vue/packages/motion) owns `FsuTransition`,
  `v-motion`, `v-scroll-reveal`, tokens, presets, runtime, GSAP context,
  timelines, ScrollTrigger wrappers, and route cleanup.
- [`config-provider/src/motion.ts`](../vue/packages/components/config-provider/src/motion.ts)
  maps `ElConfigProvider.motion` to `system`, `enabled`, `reduced`, and
  `disabled` state, presets, and CSS tokens.
- [`components/motion.ts`](../vue/packages/components/motion.ts) defines the
  component `motion` prop used by Button, Card, Dialog, Drawer, Dropdown,
  Tooltip, Message, Notification, Collapse, and Tabs.

Consumers use `useGsapContext`, `useTimeline`, `useScrollReveal`,
`useMotionRouteCleanup`, and `refreshScrollTriggers()`; they do not import
`gsap` or `ScrollTrigger` directly or create a second animation system. The
full usage and preset contract is [`docs/components/motion.md`](./components/motion.md).

## 5. Quality ownership and CI

Local entrypoints:

- `verify:pr-fast`: affected typecheck/unit, lint, token/icon/design governance,
  and package smoke for PR iteration.
- `verify:full`: complete local quality and demo build.
- `verify:release`: `verify:full` plus dist-tag, candidate, negative-fixture,
  and `npm-latest`/`pnpm-latest`/`npm-peer-floor` consumer checks.
- `test:coverage` and `test:visual:evidence`: required evidence that release
  verification does not replace.

Artifact and capacity rules are shared by local and CI runs:

- `prepare:test-artifacts` uses source hashes to reuse or regenerate
  `vue/packages/icons-vue/dist` and `vue/packages/wasm/dist`; cache hit/miss,
  fingerprint, and reason are logged. Use `FORCE_REBUILD=1 pnpm run
  prepare:test-artifacts` to force all test artifacts.
- `_quality.yml` plans Unit shards from test-file count and effective
  CPU/memory; `unit-artifacts` prepares once, then shards run
  `pnpm run check:test-artifacts-ready` and Vitest with the planned
  `--shard=<n>/<total>` and `FSUS_VITEST_WORKERS`. Inspect the plan with
  `pnpm ci:capacity:plan --dry-run`; validate fixtures with
  `pnpm ci:capacity:check`.
- Replay an individual planned shard with:

  ```bash
  pnpm exec vitest run --config vue/vitest.config.ts --shard=<n>/<total>
  ```

The workflow's executable form is the `vitest run --shard` command with the
configuration and shard arguments supplied by the capacity plan.
- `build-package` emits one `fsusui-npm-candidate` tarball, SHA-256 sidecar,
  and manifest. `consumer-install` and local `verify:release` must consume that
  same digest and the same candidate manifest—the release rule is “同一个 tarball”
  (one immutable tarball); compare any diagnostic rebuild with
  `pnpm package:candidate:compare <A.tgz> <B.tgz>` before use.
- Typecheck lanes use `scripts/run-typecheck.mjs`, write `.tsbuildinfo` under
  `.tmp/typecheck-cache`, and may use `pnpm run typecheck:no-cache` for
  diagnosis. Cache keys include lockfile, `vue/tsconfig*.json`, config, source,
  typings, and the typecheck runner.

The typecheck cache records a cache hit or cache miss and its primary key. The
affected path uses `typecheck:affected`; the full `typecheck` graph remains the
four lanes (`web`, `node`, `vite-config`, and `vitest`). Use
`typecheck:no-cache` when a diagnostic must bypass the cache.

CI entrypoints are `.github/workflows/quality.yml` (dispatch) and
`.github/workflows/_quality.yml` (reusable gates). `pull_request` uses
`verify:pr-fast`; push, scheduled, and release dispatch use the explicit
`main`, `nightly`, and `release` groups. `publish-npm.yml` downloads and
verifies the release candidate; it must not build or prepare a second one.
The profile registry is `spec/ci/readiness-gates.json`; inspect it with
`pnpm ci:profile:plan --group release` and validate it with
`pnpm ci:profile:check`.

## 6. Failure triage

Run the smallest applicable gate, then broaden only as needed:

```bash
pnpm verify:pr-fast
pnpm verify:full
pnpm test:coverage
pnpm test:visual:evidence
pnpm verify:release
pnpm run check:npm-dist-tag
pnpm run build:npm-package
```

Useful owners:

- Vitest setup: `vue/vitest.setup.ts`
- Coverage scope/config: `vue/vitest.config.ts`
- Visual config and tests: `vue/playwright.config.ts` and `vue/tests/visual/`
- Demo fixtures: `vue/packages/demo-app/src/AuditFixtures.vue` and the
  section components under `vue/packages/demo-app/src/sections/`
- npm preparation: `scripts/prepare-npm-package.mjs`
- Type generation: `vue/internal/build/src/tasks/types-definitions.ts`

Vitest owns unit/integration tests and `test:coverage`; Playwright owns
desktop/mobile light/dark visual coverage and is not part of the default
`verify` chain. Prefer behavior assertions to snapshots, use `--update-snapshots`
only for intentional output changes, and never weaken a baseline to hide a
defect.

## 7. Visual fixture rules

The stable demo entry is `vue/packages/demo-app/src/App.vue`; the capture
registry is `vue/tests/visual/capture-all.spec.ts`. Visual routes use
`/?visual=<group>&theme=<light|dark>&compact=<0|1>`.

When adding a case:

- add a focused fixture rather than assertions to a complex page;
- capture a component region rather than a long scrolling page;
- fix viewport, locale, timezone, color scheme, and motion;
- reuse the Playwright project matrix; and
- cover only the key interaction states: open, hover, focus, disabled, loading,
  selected, and empty.

Inspect relevant rendered states, themes, viewports, locales, accessibility,
zoom/overflow, touch, and reduced-motion behavior before claiming acceptance.
Follow [`docs/workflows/visual-change.md`](./workflows/visual-change.md) for
classification and evidence requirements.

## 8. Lint and handoff checklist

One-off migration or local helper scripts are explicit lint exclusions.
Long-lived scripts, generators, package builds, tests, and CI assets remain in
the lint scope; classify new scripts before adding an ignore.

For a new handoff, run:

```bash
pnpm install
pnpm verify
pnpm test:visual:full
pnpm run build:npm-package
pnpm test:consumer-install
```

## 9. Avalonia quality lanes

Platform verification and package validation are separate:

- `dotnet-platform` runs restore, Release build, tests, and demo startup smoke
  on Linux, Windows, and macOS; each runner emits its own platform manifest.
- `dotnet-package` runs once on Ubuntu, creates the canonical NuGet candidate,
  checks metadata/content/packed-consumer/stable contracts, and emits one
  aggregate SHA-256.
- `static-quality` owns icons, tokens, conformance, governance, and a11y; it is
  not part of the OS matrix.

Inspect ownership with `pnpm dotnet:matrix:plan --os linux,windows,macos`.
Run the current-host lanes with `pnpm dotnet:platform:verify` and
`pnpm dotnet:package:verify`; local verification does not emulate other OSes.
`check:dotnet-matrix` rejects package/governance commands in the OS matrix and
checks missing/duplicate/failed platform manifests. Restore caches include OS,
SDK, projects, solution, props/targets, and lock inputs; final package
directories are not trusted cache evidence.

## 10. Capacity-aware demo and coverage

PR checks call `scripts/should-run-demo-build.mjs` after `verify:pr-fast`.
This path-aware demo build runs for demo, component/runtime, theme, public-API,
and build-config changes and invokes `pnpm run build:demo`; docs/metadata-only
changes may skip it. The workflow logs `demo-build-run` and `demo-build-reason`.
Main, nightly, release, and local full verification always keep the full demo gate.

The reusable `static-quality` job is the short quality consolidation: it uses
shared setup/install while retaining separate named contract, lint, token, icon,
conformance, and governance steps, so failure output identifies the affected
quality area.

Coverage planning is offline and resource-aware:

```bash
pnpm coverage:plan --dry-run
pnpm coverage:run
pnpm coverage:merge <blob-dir>
```

Shards emit unique blobs, fragments, and manifests. Merge rejects missing or
duplicate indexes, mixed totals, stale digests, or mismatched commit/config/
selection/toolchain. Every shard and the final merged result must identify the
same commit. Only the complete final merged result applies thresholds once;
per-shard thresholds are not completion evidence. Set
`FSUSUI_COVERAGE_DURATION_BUDGET_SECONDS` only for an environment-specific SLO;
the budget applies to both single and sharded modes.
