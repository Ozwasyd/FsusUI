# Real-render performance benchmarks

FsusUI has three deliberately separate kinds of performance evidence:

1. **Budget definitions** in `spec/components/avalonia-stable-performance-budgets.json` set absolute guardrails. They are intentionally broad and only catch obvious runaway behavior.
2. **Static fixtures** in `tests/conformance/performance/avalonia-budget-fixtures.json` exercise schema, budget and generated-artifact governance. `pnpm avalonia:performance:check` validates those maintained numbers; it does **not** run a window, browser, layout, paint or stopwatch benchmark.
3. **Real measurements** are produced by `pnpm perf:render`. These artifacts come from Chromium and an actual Avalonia desktop window and are never silently substituted with fixture values.

## One-command reproduction

From the repository root:

```bash
pnpm perf:render -- --profile quick --output .tmp/performance/current
```

The command starts the demo fixture server, runs Chromium, starts the Avalonia desktop runner, checks absolute runaway limits and writes:

- `web/summary.json` plus one `*.raw.json` per browser scenario;
- `avalonia/summary.json` plus per-scenario raw samples and disposal timings;
- environment identity including OS, CPU, logical cores, runtime/browser/Avalonia versions, DPR, refresh target, window DPI and the resolved Avalonia renderer/window backend.

On headless Linux the command requires `xvfb-run`; otherwise it uses the active desktop session. The quick profile uses one warm-up and five measured samples. The full profile uses three warm-ups and twelve measured samples:

```bash
pnpm perf:render -- --profile full --output .tmp/performance/full
```

Warm-ups are discarded. Every reported timing has p50, p95 and p99. Raw samples remain available for audit instead of being collapsed into a single stopwatch value.

## Web matrix and metrics

The full browser matrix is the Cartesian product of every scenario below with 60/120 Hz, DPR 1/2 and enabled/reduced/disabled motion (180 browser cases). It covers:

- `VirtualList` at 1K, 10K and 100K rows in fixed- and variable-height modes;
- `TableV2`/virtual grid with two-axis scrolling and 10K/100K rows;
- `MarkdownRenderer` at 24 KiB, 256 KiB and 1 MiB, including cold and hot WASM paths;
- `SelectV2` filtering at 2K, 10K and 100K options;
- `Table` sorting, selection and data-view updates;
- 60 Hz and 120 Hz targets, DPR 1 and 2, and enabled/reduced/disabled motion modes.

The runner records frame work and intervals, dropped-frame rate, Long Tasks, input-to-next-frame latency, style/layout/paint/composite trace durations, DOM nodes, Chromium layers and estimated layer area, JS heap, Worker queue/compute/transfer time, and WASM startup/compute/end-to-end time. Refresh targets are analysis budgets; they do not claim that a virtual CI display physically refreshes at 120 Hz.

## Avalonia matrix and metrics

The desktop runner opens a fixed 1180×760 window with fixed font, DPI and theme inputs. It mounts real FsusUI controls into an Avalonia visual tree, performs scrolling, continuous input, tree expansion, table sort/selection/data-window changes, theme switching, mount/unmount and bitmap rendering. It records UI-thread frame, Measure/Arrange, draw, allocation, GC, realized/retained visuals and disposal timing.

The artifact records the resolved renderer type and native window handle descriptor. A result with an unresolved renderer/backend is invalid evidence and must not be described as a desktop measurement.

## CI regression policy

Pull requests run the quick representative matrix. When the base revision contains the runner, CI measures both the base SHA and the proposed SHA sequentially on the same GitHub runner, then rejects a p95 regression above 15%. This avoids comparing unrelated hardware. The first commit that introduces the runner has no prior executable baseline and therefore only produces current evidence; subsequent changes receive relative gating.

`main` runs the quick matrix. Nightly and release workflow groups run the full matrix. All jobs upload raw samples, environment metadata and summaries. Absolute limits in `tests/performance/render-performance-policy.json` only catch obvious loss of control; they are not used to claim cross-machine performance parity.

To compare two same-runner result directories manually:

```bash
pnpm perf:render:compare -- .tmp/performance/baseline .tmp/performance/current 0.15
```

Do not compare absolute values from different machines. When fixture inputs, browser versions, renderer backends or environment metadata differ, collect a new paired baseline.
