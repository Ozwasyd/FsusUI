# ConfigProvider

`ElConfigProvider` provides FsusUI's global context at the application root. The implemented configuration surface is defined by `vue/packages/components/config-provider/src/config-provider-props.ts`.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

```vue
<template>
  <el-config-provider
    :locale="zhCn"
    size="large"
    :theme-mode="themeMode"
    :message="{ max: 3 }"
  >
    <App />
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import zhCn from '@ozwasyd/element-plus/es/locale/lang/zh-cn'

const themeMode = ref<'light' | 'dark' | 'system'>('system')
</script>
```

---

## Theme Mode

`theme-mode` synchronizes theme state to `<html>`, either overriding or following the system preference:

- `system`: follow `prefers-color-scheme`
- `dark`: force dark mode
- `light`: force light mode

Synchronization side effects include:

- `class="dark"` / `class="light"` (explicit modes)
- `data-theme-mode`
- `data-theme-resolved`
- `color-scheme`

To apply the theme before Vue mounts, use [`syncThemeMode`](../guide/dark-mode.md).

---

## Implemented Attributes

| 属性名                | 说明                           | 类型                              | 默认值                             |
| --------------------- | ------------------------------ | --------------------------------- | ---------------------------------- |
| a11y                  | 是否启用可访问性增强           | `boolean`                         | `true`                             |
| locale                | 全局语言对象                   | `Language`                        | —                                  |
| theme-mode            | 文档级主题模式                 | `'light' \| 'dark' \| 'system'`   | —                                  |
| render-pipeline       | 全局渲染管线预算与 Worker 策略 | `RenderPipelineConfigContract`    | `{ mode: 'auto', worker: 'auto' }` |
| size                  | 全局组件尺寸                   | `'large' \| 'default' \| 'small'` | —                                  |
| button                | 按钮全局配置                   | `{ autoInsertSpace?: boolean }`   | —                                  |
| experimental-features | 预留的实验能力配置             | `object`                          | —                                  |
| keyboard-navigation   | 是否启用键盘导航处理           | `boolean`                         | `true`                             |
| message               | Message 全局配置               | `{ max?: number }`                | —                                  |
| z-index               | 全局初始层级                   | `number`                          | —                                  |
| namespace             | 全局类名前缀                   | `string`                          | `el`                               |

---

## Button Configuration

| 属性名          | 说明                             | 类型      | 默认值  |
| --------------- | -------------------------------- | --------- | ------- |
| autoInsertSpace | 两个中文字符之间是否自动插入空格 | `boolean` | `false` |

## Message Configuration

| 属性名 | 说明                 | 类型     | 默认值 |
| ------ | -------------------- | -------- | ------ |
| max    | 同时显示的最大消息数 | `number` | —      |

---

## Render Pipeline Configuration

`render-pipeline` provides shared Worker, chunking, and virtual-mount budgets for heavy content. Components do not hard-code a strategy by name; runtime estimates HTML bytes, DOM nodes, and item count to choose synchronous or chunked rendering.

Strategy selection is hot-swappable: components call the shared resolver instead of embedding strategy branches. Register a resolver with `registerFsusRenderPipelineStrategyResolver()`; it returns `sync`, `chunked-main`, `chunked-worker`, or `disabled`. After unregistering, the default budget strategy resumes.

Component integration is registration-based: full installs, grouped installs, demo contracts, and on-demand `app.use(ElXxx)` register a default `RenderPipelineComponentPolicy` for each installed control. Lightweight controls use `sync-monitored`, scroll containers use `viewport-provider`, chunkable content uses `chunk-adapter`, and existing virtual lists/grids use `virtual-list` / `virtual-grid`. TreeV2, TableV2, and SelectV2 inherit the lower-level virtual budget through `inherited`. New controls only register a policy or adapter; they do not add strategy branches to existing controls.

External heavy components should use the stable `render-pipeline` package subpath for the adapter registry, policy registry, and runtime. The package root keeps compatibility exports, but new application code should use the dedicated entry point; see the [Render Pipeline guide](../guide/render-pipeline.md) for a complete example.

```vue
<el-config-provider
  :render-pipeline="{
    mode: 'auto',
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

| 字段                           | 说明                                                                        | 默认值   |
| ------------------------------ | --------------------------------------------------------------------------- | -------- |
| mode                           | `'auto' \| 'enabled' \| 'disabled'`                                         | `auto`   |
| worker                         | `'auto' \| 'enabled' \| 'disabled'`                                         | `auto`   |
| thresholds.htmlBytes           | 超过后进入分块预算判断                                                      | `128000` |
| thresholds.estimatedNodes      | 超过后进入分块预算判断                                                      | `1500`   |
| thresholds.itemCount           | 超过后进入分块预算判断                                                      | `500`    |
| budget.frameMs                 | 单帧主线程提交预算；省略时按实际 rAF 刷新周期动态校准                       | dynamic  |
| budget.overscanPx              | 虚拟窗口上下预渲染距离                                                      | `800`    |
| budget.measureBatch            | 单帧测量提交数量                                                            | `32`     |
| acceleration.mode              | `'auto' \| 'gpu' \| 'cpu'`，控制硬件画像                                    | `auto`   |
| acceleration.compositor        | `'auto' \| 'enabled' \| 'disabled'`，控制 DOM 合成层/Popper GPU compute     | `auto`   |
| acceleration.contentVisibility | `'auto' \| 'enabled' \| 'disabled'`，控制虚拟 chunk 的 `content-visibility` | `auto`   |
| acceleration.layerBudget       | 临时合成层预算提示                                                          | `80`     |

When SSR or Worker is unavailable, or a component cannot provide a serializable chunk adapter, the runtime falls back to synchronous main-thread rendering. Lightweight components share this configuration but are not forced into virtualization.
GPU mode refers only to the browser DOM compositor path and does not introduce WebGPU. CPU mode tightens default budgets and prefers Worker chunking, but does not override explicit `worker: 'disabled'`.

Current integrations:

- All demo/installer-registered controls have a component policy, resolved through the shared strategy path as `sync`, `chunked-main`, `chunked-worker`, or `disabled`.
- `ElMarkdownRenderer`: small documents use the synchronous HTML fast path; large documents use `chunked-worker` / `chunked-main` with virtual mounting.
- `VirtualList` / `DynamicSizeList` / `FixedSizeList`: derive effective cache from the shared strategy and `budget.overscanPx`; without explicit `render-pipeline`, historical `cache` behavior remains.
- `VirtualGrid` / `DynamicSizeGrid` / `FixedSizeGrid`: likewise derive row and column cache through the shared strategy.
- `TreeV2`, `TableV2`, and `SelectV2`: inherit the shared budget strategy through VirtualList/Grid instead of reimplementing it in each component.

---

## Slots

| 插槽名  | 说明     | 参数         |
| ------- | -------- | ------------ |
| default | 应用内容 | `{ config }` |

## Internal provider input custody

The local source alias exposes `createGlobalConfigSnapshot`,
`getGlobalConfigFeed`, and `releaseGlobalConfig` from the existing
config-provider hook. These are internal integration surfaces, not supported
package imports or a certificate of complete application custody.

Reads and feed lookups do not initialize the publication runtime. The first
provider or snapshot-producer call initializes it synchronously. Selected Refs
created before that point remain readable but have no feed identity; select
again after initialization to obtain a managed feed. The original whole-config
fallback Ref keeps its identity and its subsequent writes are intercepted.

`provideGlobalConfig(config, app?, global?)` continues accepting the existing
object/MaybeRef inputs and inheriting configuration by top-level nullish merge.
Those inputs, including ordinary `ElConfigProvider` props, remain unowned:
their feed cannot issue a ticket. Arbitrary external Ref replacements, props
updates, and nested mutations have no intercepted prewrite boundary. A
synchronous watcher after such a mutation would not establish that boundary.
An arbitrary injected Ref has no feed at all. Wrapping a producer's `config`
Ref, copying a producer handle, or forwarding it through an ordinary computed
input does not transfer custody.

For the explicit controlled path, pass the factory's original handle to
`provideGlobalConfig`. The factory copies and recursively freezes acyclic
plain data; functions, accessors, Vue proxies and class instances are rejected.
Subsequent changes must use `producer.update(next)` with another plain snapshot.
It replaces the complete local snapshot. An injected parent is still inherited
with the same merge rule; a controlled child of an unowned parent stays unowned.
A controlled root without an injected parent owns its complete configuration
and does not inherit the process fallback. This avoids making a root depend on
the fallback that it publishes itself.

For a Ref returned by `provideGlobalConfig`, `useGlobalConfig()`, or
`useGlobalConfig('renderPipeline')`, `getGlobalConfigFeed(ref)` performs only an
identity lookup. Subscribe before requesting a ticket:

```ts
const selected = useGlobalConfig('renderPipeline')
const feed = getGlobalConfigFeed(selected)
const release = feed?.subscribe(cancelPendingConfigWork)
const ticket = feed?.issueTicket()
// Commit only the captured ticket.value while feed.isCurrent(ticket) is true.
// Reacquire explicitly after producer.update(next) returns.
release?.()
```

Tickets capture the frozen value and exact provider `contextIdentity`.
`isCurrent` rejects foreign tickets and checks only private publication,
dependency and subscription state. Reads neither refresh nor republish state.
The selected feed uses the same provider identity; a selected external default
value cannot be certified. Releasing any subscription captured by a ticket
invalidates that ticket; releases are idempotent and subscriptions created in a
Vue scope also release with that scope. Publication release also clears each
feed's retained subscription identities and listener ownership records, even
for subscriptions created outside a Vue scope.

Controlled updates invalidate upstream and inherited/fallback tickets and
synchronously notify revocation subscribers before writing published values.
The notifications must be synchronous. A throwing or thenable callback leaves
the affected feed failed closed; `getFailures()` includes actual local and
retained upstream failures. A failed revocation prevents the pending write;
a failure after publication cannot roll back a value already written.
Same-producer updates during a write are rejected.
Detaching or releasing a context retains the upstream failure records already
observed, with their original ownership. It does not retain the live source
dependency or collect later failures from that detached source.

Failure records retain `cause`, the original listener, subscription identity
where available, and the context identity at invocation. An asynchronous result
still fails the synchronous contract immediately; its actual rejection is
observed separately and recorded with that same ownership even after release.
Native promises use intrinsic await observation without a `.then`/`.catch`
species continuation. Non-native then results have their returned continuation
observed as well. This does not certify arbitrary hostile then/species behavior
that creates independently rejected descendants or prevents installing a
reaction; that requires a separate controllable input contract.

The hook revokes an existing provider owned by the same app/setup instance
before replacing its injected context. It revokes the process fallback before
changing its selection, tracks controlled updates from the selected provider,
and preserves fallback Ref assignment through an intercepted setter. An
external assignment first revokes and detaches the selected producer, then
publishes the external value as unowned. It cannot retain or acquire tickets
by assigning a frozen object. Ordinary MaybeRef fallback publication retains
its existing one-time value behavior.
`releaseGlobalConfig(context)`, producer release, and setup-scope disposal
invalidate tickets and detach retained subscriptions. Existing read views can
retain their last value after release; they no longer certify it, and release
does not automatically select an older fallback provider. An app caller must
release its provided context explicitly. Provider release does not release a
producer shared by other providers.

Remaining integration inputs are the actual producer handle, the exact returned
selected Ref/feed, synchronous cancellation subscribers, and an explicit
reacquisition point. Ordinary `ElConfigProvider` does not create this handle.
Renderer/pipeline consumers still need to retain the real config dependency
and combine its ticket with every other required authority; an unknown or
missing input must continue denying full authority. Direct external
`app.provide`/injection-table writes are outside this hook's publication custody.
These code guards do not change account permissions or access privileges, and
do not provide runtime, resource-census, or complete-custody qualification.
