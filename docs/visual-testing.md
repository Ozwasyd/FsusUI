# Visual test profiles

> **Role:** Verification workflow
> **Applies to:** FsusUI rendered output and evidence generation
> **Authority:** Selects repository visual profiles. Visual acceptance still follows [`docs/workflows/visual-change.md`](./workflows/visual-change.md).

FsusUI exposes four explicit visual profiles. `scripts/run-visual-tests.mjs`
orchestrates all four, using one resource-capacity plan and preparing
`.tmp/visual-runtime` exactly once before browser execution.

The orchestrator owns each Preview and Dev server. An unrelated process already
using a configured port is rejected, not treated as runtime evidence.
`FSUS_VISUAL_REUSE_SERVER=1` is a local-debugging opt-in only; Full, Evidence,
and release verification must leave it unset so the server starts from the
validated runtime manifest.

The boundary owner passes its managed preview URL through
`FSUS_PLAYWRIGHT_EXTERNAL_SERVER`, as the layout and preview runners do.
Before running cells, the boundary owner requires its launched child to acknowledge
the successful bind over IPC, then checks the live child's address and runtime
fingerprint. An arbitrary HTTP 200 does not establish ownership; a startup error
or child exit refuses the run before browser tests.
The boundary config starts its strict standalone server only when that URL is
absent; an unrelated process on the standalone port is still rejected in CI.

## What the profiles prove

A passing profile proves that selected existing fixtures conform to their recorded baselines and contracts. It does not prove an absent state, viewport, locale, content length, platform, or consumer composition.

The person or agent making the change must inspect rendered evidence and confirm that its fixture matrix covers the impact. A zero-diff result, static checker, or generated report is not visual acceptance for an untested state.

| Profile  | Command                     | Contract                                                                                                              |
| -------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Smoke    | `pnpm test:visual:smoke`    | Stable Basic fixtures in desktop/light and compact/dark projects. It uses one worker and keeps only failure evidence. |
| Affected | `pnpm test:visual:affected` | Maps a local Git diff to owned specs, Demo sections, and `FSUS_UI_AUDIT_COMPONENTS`. It keeps only failure evidence.  |
| Full     | `pnpm test:visual:full`     | All Preview specs in desktop-light, mobile-light, desktop-dark, and mobile-dark, plus exactly one Dev suite.          |
| Evidence | `pnpm test:visual:evidence` | The same test selection as Full, with successful screenshots, traces, a manifest, and HTML reports retained.          |

The unqualified `pnpm test:visual` command only prints profile help; it does
not guess a workload or forward unknown arguments.

## Browser-free planning

Append `--dry-run` to any profile to print its capacity and test plan without
preparing the runtime, starting a browser, or accessing the network:

```bash
pnpm test:visual:smoke -- --dry-run
pnpm test:visual:affected -- --dry-run
pnpm test:visual:full -- --dry-run
pnpm test:visual:evidence -- --dry-run
```

Select the affected baseline with `--base=<local-ref>` or
`FSUS_VISUAL_BASE=<local-ref>`; CI also accepts an already fetched
`origin/$GITHUB_BASE_REF`. The planner never fetches a missing ref. If the
checkout is shallow, not a Git worktree, missing its base, or has an empty
comparison, Affected reports why and runs the Smoke selection.
`FSUS_VISUAL_AFFECTED_FILES` accepts a comma/newline-separated fixture list for
deterministic offline tooling and tests.

## Affected ownership registry

`spec/ci/visual-profiles.json` owns component source, theme source, Demo section,
visual spec, and audit-component ownership. Its offline checker fails when a
component package lacks an owner or an owner points at a removed package.

Component and component-theme changes select their Demo section, UI audit spec,
and matching `FSUS_UI_AUDIT_COMPONENTS` subset; Demo section changes select its
owned spec. Tokens, foundation styles, typography, public/global shell sources,
Playwright configuration, Visual infrastructure, and other unsafe global inputs
are `full-required`. Affected still runs the bounded common-contract selection
and prints `pnpm test:visual:full` as a recommendation; it never silently
changes profile.

## Verification and evidence boundaries

`verify`, `verify:full`, and `verify:pr-fast` remain browser-free. Run
`verify:visual:affected` for local or PR visual feedback. `verify:nightly`
selects Full; release/manual visual evidence selects Evidence. Neither Full nor
Evidence runs from install/commit hooks, ordinary builds, or ordinary source
verification.

Full and Evidence accept an explicit `--shard=N/M`. Every shard runs its
Preview portion; shard `1/M` alone runs the single Dev suite, so distributed
execution does not multiply Dev coverage.

Normal profiles retain screenshots and traces only on failure. Evidence also
writes `.tmp/visual-evidence/manifest.json`; result paths are namespaced by
profile, suite, project, and shard, and HTML paths by profile, suite, and shard.
A manifest-write failure fails Evidence and never changes its Full-equivalent
selection. Evidence retains every failure trace, while the authoritative
`screenshot: on` matrix records every successful rendered state. A second trace
for each success is disabled because it competes with the success screenshot
fixture and can block browser-context teardown.

## Safe-area overlay matrix (visual-boundary)

Viewport-safe floating surfaces (Overlay, Dialog, fullscreen Dialog, MessageBox,
Drawer directions, ImageViewer) use geometry assertions in the existing
boundary lane:

```bash
pnpm audit:visual-boundaries
# optional representative subset
FSUS_SAFE_AREA_MATRIX_MODE=smoke pnpm audit:visual-boundaries -- --project=safe-area-chromium
```

Canonical profiles: `scripts/safe-area-profiles.mjs`; projects are
`safe-area-chromium` and `safe-area-webkit`. Assertions check bounding boxes and
reachability over #260 CSS variable overrides. They are not screenshot-only
acceptance or a substitute for real iOS Safari release evidence.

## Avalonia headless evidence outputs

Ordinary `FsusUI.Avalonia.HeadlessTests` runs write production-fixture
screenshots, manifests, and receipts below the ignored deterministic directory
`dotnet/FsusUI.Avalonia.HeadlessTests/TestResults/visual-evidence/`.
Set `FSUS_AVALONIA_VISUAL_EVIDENCE_ROOT` to an absolute path or one relative to
the repository root when review/regeneration needs an explicit root. Each
fixture keeps a stable subdirectory and records resolved output, manifest,
receipt, and capture paths in JSON evidence. This variable changes only the
destination; it does not select tests, update tracked baselines, or weaken
render, pixel, geometry, automation, or composition assertions.
