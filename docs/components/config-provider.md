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
