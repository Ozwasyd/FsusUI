# Render Pipeline

Fsus Render Pipeline 是 FsusUI 的统一渲染预算层，用于把重型内容从“一次性挂载大量 DOM”切换为按预算分块、调度和虚拟挂载。它保持纯 DOM/Vue 输出，不引入 Canvas、WebGPU 或 OffscreenCanvas renderer；WASM/Worker 只做 parse、chunk、索引、测量提示和缓存等纯计算。策略不按组件名硬编码，而是按内容估算、组件 policy、adapter 能力和 `ElConfigProvider.render-pipeline` 配置共同决定。

推荐从专用入口导入：

```ts
import {
  registerFsusRenderPipelineAdapter,
  registerFsusRenderPipelineComponentPolicy,
  useFsusRenderPipelineRuntime,
} from 'element-plus/render-pipeline'
```

如果使用当前 GitHub Packages 主包名，则导入路径为 `@ozwasyd/element-plus/render-pipeline`。

## 配置

应用侧通过 `ElConfigProvider` 统一控制预算：

```vue
<el-config-provider
  :render-pipeline="{
    mode: 'auto',
    adaptive: 'auto',
    worker: 'auto',
    thresholds: { htmlBytes: 128_000, estimatedNodes: 1500, itemCount: 500 },
    budget: { frameMs: 8, overscanPx: 800, measureBatch: 32 },
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
- `adaptive: 'auto'` 会在运行时根据硬件画像、渲染耗时、Worker 队列和帧预算自动收紧或放宽 `budget`；`disabled` 完全使用静态预算。
- `worker: 'auto'` 在 Worker 可用且 adapter 支持时启用；SSR 或 Worker 不可用时自动退回主线程路径。
- `thresholds` 只决定是否进入分块预算，不会把不可分块组件强行虚拟化。
- `budget` 控制主线程单帧提交、虚拟窗口 overscan 和测量批大小。
- `acceleration.mode: 'auto'` 会按 DOM 合成层能力、软件渲染信号、CPU 核数和 reduced-motion 选择 `gpu-compositor` 或 `cpu-threaded`；`gpu` / `cpu` 可手动强制。
- `acceleration.compositor` 控制 `translate3d`、临时 `will-change` 和 Popper GPU compute styles；`contentVisibility` 控制虚拟 chunk 的 `content-visibility: auto`。这里的 GPU 指浏览器 DOM compositor，不包含 WebGPU/Canvas 重写。
- `cpu-threaded` 会使用更紧的默认阈值和预算，并在可用时优先走 Worker 分块；显式 `worker: 'disabled'` 仍然会被遵守。

## 外部 Adapter

重型业务组件可以注册自己的 adapter。Worker 只处理可序列化数据；真实 DOM、测量和锚点保持仍由主线程 runtime 负责。

```ts
import {
  registerFsusRenderPipelineAdapter,
  registerFsusRenderPipelineComponentPolicy,
} from 'element-plus/render-pipeline'

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

Worker 消息协议由统一 executor 托管：请求形状为 `{ id, request }`，响应形状为 `{ id, result }` 或 `{ id, error }`。`result` 应返回与 `prepare()` 一致的 `{ units, html?, metadata? }` 文档对象。runtime 默认在组件实例内复用 Worker；`pool: 'shared'` 会按 `poolKey` 在多个 runtime 之间共享 executor。请求超时、AbortSignal、Worker error 和 dispose 都会以 `FsusResult` 的 `ok: false` 返回，并在 Worker 不可用或失败时回退到 `chunked-main`。

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
- `useFsusRenderScheduler()` 支持 `user-blocking`、`visible`、`background` 三档优先级；支持 AbortSignal 和返回 cancel 函数。
- `useFsusVirtualWindow()` 可用于自定义虚拟挂载，但调用方必须保证稳定 key、估算高度和滚动容器。内部使用 prefix offset index、二分 range 查找和批量测量，避免滚动时反复全量扫描。
- `createFsusWorkerExecutor()` 可用于高级 adapter 的托管 Worker 请求：支持共享实例、idle terminate、request timeout、AbortSignal 清理、失败批量 `FsusResult` 返回和 telemetry 事件。
- `resolveFsusRenderPipelineUnitAttrs()` 统一派生 DOM 性能 attrs，调用方只透传 `data-fsus-*`，不在组件内复制 layer/content-visibility 策略。
- `createFsusRenderPipelineDiagnosticsBuffer()`、`registerFsusRenderPipelineDiagnosticSink()` 和 `getFsusRenderPipelineDiagnosticsSnapshot()` 可用于开发期观测。诊断事件记录策略、阶段、预算、队列、cache hit/miss 和 fallback 原因，不记录完整源文或 HTML。

Internal:

- Markdown WASM chunk 格式、Markdown LRU 缓存和诊断采样实现不作为外部契约。
- `clear*` API 主要用于测试，不建议业务运行时调用。

## 内置接入

- 全量安装、分组安装、demo contract 和按需 `app.use(ElXxx)` 都会注册默认组件 policy。
- `ElMarkdownRenderer` 大文档通过 chunk adapter 接入；小文档保留同步 HTML fast path。
- `VirtualList` / `VirtualGrid` 通过同一 runtime 推导 cache、硬件画像和 compositor attrs；TreeV2、TableV2、SelectV2 继承底层虚拟控件预算。
- Tooltip/Popover/Select/DatePicker 等 Popper 浮层默认读取同一硬件画像决定 GPU compute styles；显式传入 `gpu-acceleration` 的场景仍以显式值为准。
- 普通轻量控件统一归类为 `sync-monitored`，共享 diagnostics 和预算配置，但不会被强行分块。
