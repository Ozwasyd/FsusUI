# Render Pipeline

Fsus Render Pipeline 是 FsusUI 的统一渲染预算层，用于把重型内容从“一次性挂载大量 DOM”切换为按预算分块、调度和虚拟挂载。它保持纯 DOM/Vue 输出，不引入 Canvas、WebGPU 或 OffscreenCanvas renderer；WASM/Worker 只做 parse、chunk、索引、测量提示和缓存等纯计算。策略不按组件名硬编码，而是按内容估算、组件 policy、adapter 能力和 `ElConfigProvider.render-pipeline` 配置共同决定。

推荐从专用入口导入：

```ts
import {
  registerFsusRenderPipelineAdapter,
  registerFsusRenderPipelineComponentPolicy,
  useFsusRenderPipelineRuntime,
} from '@ozwasyd/element-plus/render-pipeline'
```

发布包导入路径为 `@ozwasyd/element-plus/render-pipeline`。源码联调时仓库内部仍可通过 `element-plus/render-pipeline` alias 访问同一入口。

## 配置

应用侧通过 `ElConfigProvider` 统一控制预算：

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

- `mode: 'auto'` 按阈值启用；`enabled` 强制进入预算判断；`disabled` 关闭分块策略。
- `adaptive: 'auto'` 会在挂载时采集一个有界的多帧 rAF 窗口，根据 delta 的中位数与截尾均值估算真实刷新周期，在 60/90/120/144 Hz 下派生不同主线程预算；页面 visibility 变化时重新采样，不会为每个组件永久保留 RAF 循环。显式 `budget.frameMs` 仍按旧配置语义覆盖自动值。
- `worker: 'auto'` 在 Worker 可用且 adapter 支持时启用；SSR 或 Worker 不可用时自动退回主线程路径。
- `thresholds` 只决定是否进入分块预算，不会把不可分块组件强行虚拟化。
- `budget` 控制主线程单帧提交、虚拟窗口 overscan 和测量批大小。
- 内部能力画像分别维护 `motionMode`、compositor、`content-visibility`、主线程校准吞吐/Worker 并发能力、memory 和 refresh profile；compute 等级来自运行时吞吐校准而不是只读 `hardwareConcurrency`，reduced-motion 只控制动效，不再降低 compute/compositor 等级。
- `acceleration.compositor` 控制 `translate3d`、临时 `will-change` 和 Popper GPU compute styles；`contentVisibility` 只按浏览器能力与显式配置启用，不依赖 CPU/GPU 画像。这里的 GPU 指浏览器 DOM compositor，不包含 WebGPU/Canvas 重写。
- 页面隐藏/重新可见、低电量或运行时能力画像变化时会收紧后台预算、重新采样并使旧策略缓存失效；策略样本使用 EWMA，缓存 60 秒过期，避免一次偶发慢请求永久影响同一 fingerprint。

## 外部 Adapter

重型业务组件可以注册自己的 adapter。Worker 只处理可序列化数据；真实 DOM、测量和锚点保持仍由主线程 runtime 负责。

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

Worker 消息协议由统一 executor 托管。run 请求为 `{ type: 'run', id, generation, key?, lane, request }`，取消为 `{ type: 'cancel', id, generation, key? }`；响应为 `{ id, status?: 'complete', result, timings? }`、`{ id, status: 'aborted' }` 或 `{ id, error }`。旧 adapter 继续调用 `run(request, signal)` 即可；需要调度能力时可传入 `{ signal, lane, key, generation, transfer }`。

executor 是真正的有界 Worker pool：默认根据 `navigator.hardwareConcurrency - reservedCores` 和 `deviceMemory` 校准，并限制在 1–4 个 Worker，至少为主线程/渲染保留一个核心。`maxWorkers`、`reservedCores` 可覆盖上限，但仍受安全范围约束。`pool: 'shared'` 按 `poolKey` 在 runtime 间复用整个 pool；最后一个 listener 释放且无 pending 后，registry 条目和 Worker 会一起销毁。

任务分为 `latency`、`throughput`、`background` 三条 lane。latency 优先；当 background 等待时，每轮最多先执行四项 latency 和两项 throughput，再强制让出一个 slot，避免任一 lane 饥饿。background 在 `isInputPending()` 或自定义 `isMainThreadBusy()` 为 true 时延后。每条 lane 和总队列均有硬上限，同 key 的新 generation 会取消旧任务；队列满时只允许高优先级任务抢占更低优先级 queued task。事件会区分 queue、start、resolve、cancel、drop、retry、timeout、crash，并记录 queue wait、compute、transfer、clone bytes、worker/queue 数量。

`structuredCloneLimitBytes` 默认 8 MiB。超过预算的非 transferable 请求会在创建 Worker 前以 `FsusResult.ok = false` 拒绝；ArrayBuffer/TypedArray 应通过 `transfer` 传递，已转移 buffer 不计入 clone 预算。单 Worker crash/timeout 只终止该 slot 上的任务，其他 Worker 不受影响；显式 `retryOnCrash` 最多在健康替代 Worker 上重试一次。Worker fallback 到主线程前会等待 idle/frame 边界，避免在繁忙主线程立即同步执行同一重任务。

真实浏览器 runner 对 Markdown 连续编辑和 Select 连续输入执行 12-generation burst，并同时测量旧单 Worker FIFO 与 shared pool。产物中的 `workerPoolBurst.maxQueueDepth`、`latestCompletions`、`legacyInputMs.p95` 和 `poolInputMs.p95` 用于确认队列有界、只提交最新 generation，并比较输入响应。

组件内部只调用统一 runtime：

```ts
const pipeline = useFsusRenderPipelineRuntime({
  componentName: 'ElArticlePreview',
  source,
  config: renderPipelineConfig,
})
```

## 接口稳定性

Stable:

- `ElConfigProvider.render-pipeline`
- 主包 `render-pipeline` 子路径的配置、policy、adapter registry、strategy resolver、scheduler、virtual window 和 runtime API。
- 兼容别名 `FsusRenderEstimate` / `FsusRenderDocument`。

Advanced:

- `registerFsusRenderPipelineStrategyResolver()` 可热拔插策略，支持 `priority`；注销函数执行后恢复默认预算策略。
- `useFsusRenderScheduler()` 支持 `user-blocking`、`visible`、`background` 三档优先级、同 key coalescing、AbortSignal 和返回 cancel 函数。长任务返回 `{ done: false, continuation }` 后每个 chunk 都会重新进入预算队列；background 每帧最多执行一个 chunk，高优先级可以在 continuation 之前抢占。浏览器 `scheduler.postTask` 路径使用同一个 AbortSignal 取消模型。
- `useFsusVirtualWindow()` 可用于自定义虚拟挂载，但调用方必须保证稳定且唯一的 key、估算高度和滚动容器。固定高度调用方传入 `itemSize` 后只使用算术索引，不创建尺寸 Map 或 `ResizeObserver`；可变高度路径使用增量前缀和索引，单项高度更新、index → offset 与 offset → index 为 O(log N)，total size 为 O(1)，可见范围只创建窗口内 item 对象。
- 可变高度窗口共享一个 `ResizeObserver`，通过 element → key 弱引用收集变化，并按 `measureBatch` 在一帧内提交一次锚点修正。`measurementCacheLimit` 默认限制历史测量为 2048 项；当前已挂载窗口可以临时占用额外槽位，卸载后立即回到上限。无 `ResizeObserver` 时仍读取 ref 元素的 `offsetHeight`，SSR 不创建观察器。
- units 尾部追加与删除使用增量索引；插入或重排允许重建前缀索引，但稳定 key 的测量缓存继续复用。重复 key 会立即抛出确定性错误。可通过 `onDiagnostic` 观察 `index-rebuild`、`measurement-batch`、`measurement-cache` 和 `scroll-correction`，诊断不包含业务内容。
- `createFsusWorkerExecutor()` 可用于高级 adapter 的托管 Worker 请求：支持动态 pool、三 lane、防饥饿、generation/cancel、队列与 clone 背压、transferable、slot 级 crash/timeout 隔离、idle/hidden 清理和结构化 telemetry。
- `resolveFsusRenderPipelineUnitAttrs()` 统一派生 DOM 性能 attrs，调用方只透传 `data-fsus-*`，不在组件内复制 layer/content-visibility 策略。
- `createFsusRenderPipelineDiagnosticsBuffer()`、`registerFsusRenderPipelineDiagnosticSink()` 和 `getFsusRenderPipelineDiagnosticsSnapshot()` 可用于开发期观测。诊断事件记录策略、阶段、预算、队列、cache hit/miss 和 fallback 原因，不记录完整源文或 HTML。
- runtime 分别记录 queue wait、Worker compute、Worker transfer、prepare/sanitize、Vue commit、style/layout、next paint 和 total；每阶段保留 EWMA、p50、p95 与样本数，策略反馈不会只读取一次 total latency。

## 真实浏览器验证

`pnpm perf:render:web --profile quick` 的 #184 runner 包含 `render-pipeline-monolithic` 与 `render-pipeline-cooperative` 对照场景。两者在真实 Chromium 中执行相同 CPU 工作量，runner 记录 input-to-next-frame、long task、掉帧、layout/paint、heap 和 layer；前者模拟不可让出的旧 callback，后者通过真实 scheduler continuation 执行。需要回归对比时传入 `--baseline <summary.json>`，而不是使用内部函数计时替代页面测量。

#187 增加 `virtual-window-index-legacy` 与 `virtual-window-index-incremental` 两个 100K 同输入场景。2026-07-14 在本机 system Chrome、60 Hz、DPR 1、2 次 warmup + 12 次样本下，单项测量更新的 frame work p95 从 `19.2 ms` 降至 `0.7 ms`，input-to-next-frame p95 从 `19.7 ms` 降至 `16.8 ms`；frame interval p95 均为刷新率下限附近的 `16.8 ms`。原始结果保存在未跟踪目录 `.tmp/performance/issue-187-index-legacy/` 与 `.tmp/performance/issue-187-index-incremental/`。锚点稳定性另由批次修正和 Markdown 连续滚动测试验证，不能由算法计时替代。

Internal:

- Markdown WASM chunk 格式、Markdown LRU 缓存和诊断采样实现不作为外部契约。
- `clear*` API 主要用于测试，不建议业务运行时调用。

## 内置接入

- 全量安装、分组安装、demo contract 和按需 `app.use(ElXxx)` 都会注册默认组件 policy。
- `ElMarkdownRenderer` 大文档通过 chunk adapter 接入；小文档保留同步 HTML fast path。
- `VirtualList` / `VirtualGrid` 通过同一 runtime 推导 cache、硬件画像和 compositor attrs；TreeV2、TableV2、SelectV2 继承底层虚拟控件预算。
- Tooltip/Popover/Select/DatePicker 等 Popper 浮层默认读取同一硬件画像决定 GPU compute styles；显式传入 `gpu-acceleration` 的场景仍以显式值为准。
- 普通轻量控件统一归类为 `sync-monitored`，共享 diagnostics 和预算配置，但不会被强行分块。
