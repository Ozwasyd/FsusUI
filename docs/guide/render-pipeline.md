# Render Pipeline

Fsus Render Pipeline is FsusUI's shared render-budget layer: large DOM mounts
become budgeted chunks, scheduling, and virtual mounting while output remains
DOM/Vue. It does not use Canvas, WebGPU, or OffscreenCanvas; WASM/Workers do
only pure parse, chunk, index, measurement-hint, and cache work. Selection uses
content estimates, component policy, adapter capability, and
`ElConfigProvider.render-pipeline`, never a hard-coded component name.

Import the dedicated entry (the repository source alias is
`element-plus/render-pipeline`):

```ts
import {
  registerFsusRenderPipelineAdapter,
  registerFsusRenderPipelineComponentPolicy,
  useFsusRenderPipelineRuntime,
} from '@ozwasyd/element-plus/render-pipeline'
```

## Configuration

```vue
<el-config-provider
  :render-pipeline="{
    mode: 'auto',
    adaptive: 'auto',
    worker: 'auto',
    thresholds: { htmlBytes: 128_000, estimatedNodes: 1500, itemCount: 500 },
    budget: { overscanPx: 800, measureBatch: 32 },
    acceleration: {
      mode: 'auto',
      compositor: 'auto',
      contentVisibility: 'auto',
      layerBudget: 80,
    },
  }"
>
  <App />
</el-config-provider>
```

- `mode: 'auto'` uses thresholds; `enabled` forces budgeting and `disabled`
  disables chunking. `thresholds` never virtualize an unchunkable component.
- `adaptive: 'auto'` samples at most 24 valid 4–40 ms rAF intervals, combines
  the median with a 10%-trimmed mean, and derives the period and main-thread
  budget from that profile; it does not assume fixed 60/90/120/144 Hz buckets.
  A `budget.frameMs` override keeps fixed-budget semantics.
- Visibility changes restart sampling. If Battery Status exists, an uncharged
  battery with `level <= 0.2` marks low power; hidden/low-power states tighten
  the budget. The bounded sampler stops, so idle components retain no rAF loop.
- `worker: 'auto'` uses a Worker when available and adapter-supported, otherwise
  falls back to the main thread (including SSR/unavailable Worker paths).
- `budget` controls per-frame work, virtual-window overscan, and measurement
  batch size. The capability profile tracks motion mode, compositor and
  `content-visibility` support, calibrated main-thread throughput, Worker
  concurrency, memory, visibility, low power, and refresh profile. Compute is
  runtime-calibrated rather than inferred only from `hardwareConcurrency`;
  reduced motion affects motion, not compute/compositor levels.
- `acceleration.compositor` controls `translate3d`, temporary `will-change`,
  and Popper GPU compute styles. `contentVisibility` uses browser capability
  and explicit configuration, not CPU/GPU profiling. GPU means the DOM
  compositor here, not a Canvas/WebGPU rewrite.
- Visibility, low-power, or capability changes tighten background work, resample,
  and invalidate old strategy entries. Samples use EWMA; entries expire after
  60 seconds, preventing one slow request from permanently affecting a
  fingerprint.

## External adapters

Heavy components can register an adapter. Workers receive serializable data;
real DOM, measurement, and anchor preservation remain on the main-thread
runtime.

```ts
import {
  registerFsusRenderPipelineAdapter,
  registerFsusRenderPipelineComponentPolicy,
} from '@ozwasyd/element-plus/render-pipeline'

const unregisterAdapter = registerFsusRenderPipelineAdapter({
  id: 'article-blocks',
  fingerprint: (source: string) => source,
  estimate: (source: string) => ({
    htmlBytes: source.length * 2,
    nodes: Math.ceil(source.length / 180),
  }),
  canUseWorker: () => typeof Worker !== 'undefined',
  prepare: async (source, signal, strategy) => {
    const units = await buildArticleBlocks(source, { signal, strategy })
    return { units }
  },
  worker: {
    createWorker: () =>
      new Worker(new URL('./article-blocks.worker.ts', import.meta.url), {
        name: 'article-blocks',
        type: 'module',
      }),
    idleTerminateMs: 30_000,
    pool: 'shared',
    poolKey: 'article-blocks',
    requestTimeoutMs: 60_000,
  },
  keyOf: (unit) => unit.id,
  estimateSize: (unit) => unit.estimatedHeight,
})

const unregisterPolicy = registerFsusRenderPipelineComponentPolicy({
  componentName: 'ElArticlePreview',
  role: 'chunk-adapter',
  adapterId: 'article-blocks',
  budgeted: true,
})
```

The shared executor owns the protocol: run `{ type: 'run', id, generation,
key?, lane, request }`, cancel `{ type: 'cancel', id, generation, key? }`, and
respond `{ id, generation?, status?: 'complete', result, timings? }`,
`{ id, generation?, status: 'aborted' }`, or `{ id, generation?, error }`.
Existing adapters can keep `run(request, signal)`; scheduling-aware adapters can
pass `{ signal, lane, key, generation, transfer }`. `requireGenerationEcho` is
off by default; a security-sensitive adapter may require exact generation echo
for success, error, and abort, as the Markdown Worker does.

The executor is a bounded pool sized from
`navigator.hardwareConcurrency - reservedCores` and `deviceMemory`, limited to
1–4 Workers with at least one core reserved for main-thread rendering.
`maxWorkers` and `reservedCores` remain safety-bounded. `pool: 'shared'` reuses
the full pool by `poolKey`; after the last listener releases with no pending
work, its registry entry and Workers are destroyed.

Tasks use `latency`, `throughput`, and `background` lanes. While background
waits, at most four latency and two throughput tasks run before one background
slot is forced; `isInputPending()` or custom `isMainThreadBusy()` defers it.
Lane and total queues have hard limits. A newer generation for the same key
cancels the old task, and a full queue lets only higher-priority work preempt a
lower-priority queued task. Events distinguish queue/start/resolve/cancel/drop/
retry/timeout/crash and record queue wait, compute, transfer, clone bytes, and
pool counts.

`structuredCloneLimitBytes` defaults to 8 MiB. Oversized non-transferable data
is rejected before Worker creation with `FsusResult.ok = false`; transfer
`ArrayBuffer`/`TypedArray` values, which do not count toward clone bytes. A
crash/timeout terminates only its slot and task; `retryOnCrash` retries once on a
healthy replacement. Worker fallback waits for an idle/frame boundary.

The browser runner sends a 12-generation burst for Markdown continuous editing
and Select continuous input, comparing legacy single-Worker FIFO with the shared
pool. `workerPoolBurst.maxQueueDepth`, `latestCompletions`,
`legacyInputMs.p95`, and `poolInputMs.p95` verify bounded queues, latest-only
commit, and input responsiveness.

Components use the same runtime:

```ts
const pipeline = useFsusRenderPipelineRuntime({
  componentName: 'ElArticlePreview',
  source,
  config: renderPipelineConfig,
})
```

## Interface stability

Stable:

- `ElConfigProvider.render-pipeline`;
- configuration, policy, adapter registry, strategy resolver, scheduler,
  virtual-window, and runtime APIs from the `render-pipeline` subpath; and
- compatibility aliases `FsusRenderEstimate` and `FsusRenderDocument`.

Advanced:

- `registerFsusRenderPipelineStrategyResolver()` supports hot-swappable
  `priority` resolvers; unregistering restores the default budget strategy.
- `useFsusRenderScheduler()` supports `user-blocking`, `visible`, and
  `background` priorities, same-key coalescing, `AbortSignal`, and cancellation.
  A long task returns `{ done: false, continuation }`; each chunk re-enters the
  budget queue, background runs at most one chunk per frame, and higher priority
  may preempt a continuation. `scheduler.postTask` uses the same cancellation.
- `useFsusVirtualWindow()` supports custom virtual mounting. Callers provide
  stable unique keys, estimated heights, and a scroll container. Fixed heights
  use arithmetic indexes without a size Map or `ResizeObserver`; variable
  heights use incremental prefix sums, O(log N) updates/lookups, O(1) total
  size, and window-only item objects.
- Variable-height windows share one `ResizeObserver`, collect changes through
  element-to-key weak references, and submit one anchor correction per frame
  under `measureBatch`. `measurementCacheLimit` defaults to 2048 history
  entries; mounted windows may temporarily exceed it, then return to the limit
  on unmount. Without `ResizeObserver`, refs read `offsetHeight`; SSR creates no
  observer.
- Appending/removing units uses incremental indexes; insertion/reordering may
  rebuild the prefix index while reusing stable-key measurements. Duplicate
  keys throw a deterministic error. `onDiagnostic` exposes `index-rebuild`,
  `measurement-batch`, `measurement-cache`, and `scroll-correction`; diagnostics
  contain no business content.
- `createFsusWorkerExecutor()` exposes bounded-pool, three-lane, anti-starvation
  scheduling; generation/cancel, queue/clone backpressure, transferables,
  slot-isolated crash/timeout, idle/hidden cleanup, and structured telemetry.
- `resolveFsusRenderPipelineUnitAttrs()` derives DOM performance attributes;
  callers forward `data-fsus-*` without copying layer or content-visibility
  policy.
- `createFsusRenderPipelineDiagnosticsBuffer()`,
  `registerFsusRenderPipelineDiagnosticSink()`, and
  `getFsusRenderPipelineDiagnosticsSnapshot()` expose development diagnostics
  for strategy, phase, budget, queue, cache, and fallback reasons without full
  source or HTML.
- Runtime metrics separate queue wait, Worker compute/transfer,
  prepare/sanitize, Vue commit, style/layout, next paint, and total. Each stage
  retains EWMA, p50, p95, and sample count; feedback does not use only one total
  latency.

## Real-browser verification

`pnpm perf:render:web --profile quick` runs the #184
`render-pipeline-monolithic`/`render-pipeline-cooperative` comparison in real
Chromium with equal CPU work and records input-to-next-frame, long tasks,
dropped frames, layout/paint, heap, and layers. The first simulates a
non-yielding callback; the second uses scheduler continuations. Use
`--baseline <summary.json>` for comparison; internal function timings do not
replace page measurements.

Issue #187's `virtual-window-index-legacy` and
`virtual-window-index-incremental` scenarios use 100K input. On 2026-07-14,
system Chrome at 60 Hz/DPR 1 with 2 warmups and 12 samples measured single-item
frame-work p95 `19.2 ms` → `0.7 ms` and input-to-next-frame p95 `19.7 ms` →
`16.8 ms`; both frame-interval p95 values were approximately `16.8 ms`. Raw
results remain in `.tmp/performance/issue-187-index-legacy/` and
`.tmp/performance/issue-187-index-incremental/`. Batch correction and Markdown
continuous-scroll tests separately verify anchor stability; algorithm timings
cannot replace that evidence.

Internal:

- Markdown WASM chunk format, Markdown LRU cache, and diagnostic sampling are
  implementation details.
- `clear*` APIs are primarily for tests and are not recommended for app runtime.

## Built-in integration

- Full/grouped installs, the demo contract, and on-demand `app.use(ElXxx)`
  register default component policies.
- Large `ElMarkdownRenderer` documents use a chunk adapter; small documents keep
  the synchronous HTML fast path.
- `VirtualList`/`VirtualGrid` use the runtime for cache, hardware profile, and
  compositor attributes; TreeV2, TableV2, and SelectV2 inherit virtual budgets.
- Tooltip, Popover, Select, and DatePicker Popper surfaces read the shared
  hardware profile for GPU compute styles; explicit `gpu-acceleration` wins.
- Lightweight controls are `sync-monitored`: they share diagnostics and budget
  configuration but are not forcibly chunked.
