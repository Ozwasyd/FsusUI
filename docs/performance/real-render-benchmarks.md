# Real-render performance benchmarks

FsusUI keeps three deliberately separate kinds of performance evidence:

1. **Budget definitions** in `spec/components/avalonia-stable-performance-budgets.json` set broad absolute guardrails and only catch obvious runaway behavior.
2. **Static fixtures** in `tests/conformance/performance/avalonia-budget-fixtures.json` exercise schema, budget, and generated-artifact governance. `pnpm avalonia:performance:check` validates those numbers; it does **not** run a window, browser, layout, paint, or stopwatch benchmark.
3. **Real measurements** come from `pnpm perf:render`, using Chromium and an actual Avalonia desktop window; fixture values are never silently substituted.

## One-command reproduction

From the repository root:

```bash
pnpm perf:render -- --profile quick --output .tmp/performance/current
```

The command starts the demo fixture server and Chromium, starts the Avalonia runner, checks absolute runaway limits, and writes:

- `web/summary.json` plus one `*.raw.json` per browser scenario;
- `avalonia/summary.json` plus per-scenario raw samples and disposal timings;
- environment identity: OS, CPU, logical cores, runtime/browser/Avalonia versions, DPR, refresh target, window DPI, and resolved Avalonia renderer/window backend.

On headless Linux it requires `xvfb-run`; otherwise it uses the active desktop session. Quick uses one warm-up and twenty-one measured samples (a true p95 tail statistic, not the single worst sample); Full uses three warm-ups and twelve measured samples:

```bash
pnpm perf:render -- --profile full --output .tmp/performance/full
```

Warm-ups are discarded. Every reported timing has p50, p95 and p99, and raw samples remain available for audit rather than collapsing into one stopwatch value.

## Web matrix and metrics

The full browser matrix is the Cartesian product of the scenarios below with 60/120 Hz, DPR 1/2, and enabled/reduced/disabled motion (204 browser cases). It covers:

- `VirtualList` at 1K, 10K and 100K rows in fixed- and variable-height modes;
- `TableV2`/virtual grid with two-axis scrolling and 10K/100K rows;
- `MarkdownRenderer` at 24 KiB, 256 KiB and 1 MiB, including cold and hot WASM paths;
- `SelectV2` filtering at 2K, 10K and 100K options;
- `Table` sorting, selection and data-view updates, plus the index/Worker/WASM data pipeline at 5K, 10K and 100K rows;
- paired `render-pipeline-monolithic` and `render-pipeline-cooperative` CPU work, comparing an indivisible callback with the real continuation scheduler;
- 60 Hz and 120 Hz targets, DPR 1 and 2, and enabled/reduced/disabled motion modes.

The runner records frame work/intervals, dropped-frame rate, Long Tasks, input-to-next-frame latency, style/layout/paint/composite trace durations, DOM nodes, Chromium layers and estimated layer area, JS heap, Worker queue/compute/transfer time, and WASM startup/compute/end-to-end time. Markdown adds `markdownPhases.parseMs`, `transferMs`, `commitMs`, `activationMs`, and matching Chromium `paintMs` so 24 KiB, 256 KiB, and 1 MiB paths can be diagnosed phase by phase. `data-pipeline-table` adds p50/p95/p99 for legacy synchronous-sort blocking, Worker submission blocking, and Worker/WASM completion, distinguishing main-thread responsiveness from total completion. Refresh targets are analysis budgets, not a claim that a virtual CI display physically refreshes at 120 Hz.

To collect only the three Markdown sizes while preserving cold/hot scenario semantics:

```bash
pnpm perf:render:web -- --profile full --scenario markdown- --warmups 3 --samples 12 --output .tmp/performance/markdown-renderer
```

To reproduce the real 100K Table data-path measurement without unrelated scenarios:

```bash
pnpm perf:render:web -- --profile quick --scenario data-pipeline-table --warmups 1 --samples 8 --output .tmp/performance/table-data-pipeline
```

On the #189 development machine (8 visible logical cores, Chromium 149), the audited eight-sample 100K Table run measured legacy synchronous-sort blocking p95 at 164.5 ms; cached index extraction plus transferable Worker submission blocked for 18.1 ms p95 (89.0% lower), with Worker/WASM completion at 57.3 ms p95. The same-machine 100K SelectV2 run reduced input-to-next-frame p95 from pre-#189 evidence of 97.3 ms to 41.9 ms (56.9% lower), kept pool queue depth at 1, and completed only the latest generation in every sample. These are local implementation evidence, not portable budgets; raw artifacts remain under `.tmp/performance/issue-189-*`.

The native 100K smoke also compares semantic results, not only timings: stable number indices matched JS exactly (105.33 ms JS / 31.61 ms WASM recorded), and a narrowed hot query reused persistent buffers (9.13 ms cold / 1.60 ms hot). Re-run `pnpm perf:wasm` on the target machine; these are not universal thresholds.

Table data-change dependency tracking has a separate reproducible 100K benchmark so it does not share or perturb Markdown/browser fixtures:

```bash
node scripts/table-data-change-performance.mjs --size 100000 --samples 7 --output .tmp/performance/table-data-change.json
```

It uses real Vue `watch`/`ref`/`shallowRef` boundaries with synchronous commits, comparing a nested `deep` mutation with prebuilt identity replacement and an explicit version commit. On the #190 development machine (8 visible logical cores, Node 24.16), the recorded 100K run measured deep setup at 3511.1 ms and update p95 at 3561.8 ms; identity update p95 was 0.227 ms and version update p95 0.136 ms. The script validates semantic callback counts and requires both explicit paths to reduce same-process p95 by at least 50%; these local values are not portable budgets.

The scheduler pair can be reproduced without rerunning the rest of the matrix:

```bash
pnpm perf:render:web -- --profile quick --scenario render-pipeline- --warmups 1 --samples 7 --output .tmp/performance/render-pipeline
```

Both variants use the same browser dimension and CPU workload. On the #185 development machine, input-to-next-frame p95 was 16.4 ms for the monolithic callback and 13.9 ms for cooperative scheduling; action-work p95 fell from 15.9 ms to 1.2 ms. These values are evidence for this implementation only, not portable budgets; the raw artifact remains untracked under `.tmp`.

## Avalonia matrix and metrics

The desktop runner opens a fixed 1180×760 window with fixed font, DPI, and theme inputs. It mounts real FsusUI controls into an Avalonia visual tree and performs scrolling, continuous input, tree expansion, table sort/selection/data-window changes, theme switching, mount/unmount, and bitmap rendering. It records UI-thread frame, Measure/Arrange, draw, allocation, GC, realized/retained visuals, and disposal timing.

The artifact records the resolved renderer type and native window handle descriptor. A result with an unresolved renderer/backend is invalid evidence and must not be described as a desktop measurement.

Virtualization scenarios additionally record actual realized/pooled container
counts, retained measurements, loaded source windows, and visual-tree size for
each sample. After unmount, the runner compares retained visuals with the
pre-mount baseline. A separate long-scroll phase reports the Gen2 collection
delta without forcing a collection inside that phase.

For distinct default/GPU-selected and forced software-renderer evidence on Linux,
run the same profile and sample count twice:

```bash
pnpm perf:render -- --avalonia-only --backend gpu --profile full --output .tmp/performance/avalonia-gpu
pnpm perf:render -- --avalonia-only --backend software --profile full --output .tmp/performance/avalonia-software
```

On Linux, `gpu` allows only GLX/EGL/Vulkan and fails instead of falling back to
software. `Environment.RequestedBackend` records the request and
`Environment.RenderingBackend` the renderer actually created. Do not label
`auto` as GPU unless `Environment.PlatformGraphicsBackend` confirms it. Use
`--scenario virtual-list` or `--scenario table-v2` to repeat one family without
unrelated controls.

## CI regression policy

Pull requests first run the dependency-free ownership planner, before installing
packages, Chromium, or desktop display dependencies:

```bash
pnpm perf:impact:plan --base <ref> --dry-run
```

The maintained registry at `spec/ci/pr-render-performance-ownership.json`
classifies changed paths as `skip`, `web-only`, `avalonia-only`, or `both`.
Narrow component ownership can select one quick scenario family. Rules run from
specific to general; the first match owns a path. Multiple families, shared
runtime/build paths, and unknown files expand to the complete affected quick set;
an unavailable Git base expands to both complete quick sets without blocking an
ordinary local verify.

The resolved changed-file list, platform/scenario selection, quick dimensions,
sample profile, repetition count, mandatory `baseline` → `current` → `current`
→ `baseline` sequence, and `geometric-mean-p95` aggregation form an immutable
SHA-256 plan digest. Every result directory contains the same
`impact-plan.json`; comparison fails before timing inspection if digests differ.
A base runner that cannot consume the plan is `baseline-unavailable` or
`contract-changed`, and its incomparable numbers are not used.

When compatible, CI measures base and proposed SHAs twice on the same GitHub runner in the symmetric order `baseline`, `current`, `current`, `baseline`. It
takes each side's geometric-mean p95 and rejects an order-balanced regression
above 15%. The early/late placement cancels systematic warm-state or runner-load
bias without changing the threshold. Each measurement still collects twenty-one
samples per scenario, so one scheduler or GC spike cannot decide the gate.
Checkouts have independent `node_modules` and process/server lifetimes but share
the runner's pnpm store cache; Chromium is installed once. This preserves
isolation without comparing unrelated hardware or concurrent CPU, GC, renderer,
and I/O noise.

The complete local paired workflow is:

```bash
pnpm perf:render:pr --base <ref>
```

It creates an isolated temporary base worktree, validates compatibility, installs
through the shared pnpm store, resolves Chromium once, runs the order-balanced
four-measurement sequence, and removes only that worktree. No remote performance
database or fixed wall-clock threshold is involved.

`main` runs Quick; nightly and release workflow groups run Full. All jobs upload
raw samples, environment metadata, and summaries. Absolute limits in
`tests/performance/render-performance-policy.json` catch only obvious loss of
control; they do not claim cross-machine performance parity.

To compare two same-runner result directories manually:

```bash
pnpm perf:render:compare -- \
  .tmp/performance/baseline \
  .tmp/performance/current \
  0.15 \
  .tmp/performance/baseline-repeat \
  .tmp/performance/current-repeat
```

Do not compare absolute values from different machines. If fixture inputs, browser
versions, renderer backends, or environment metadata differ, collect a new paired
baseline.
