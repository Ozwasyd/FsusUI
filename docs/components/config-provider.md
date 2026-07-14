# ConfigProvider 全局配置

`ElConfigProvider` 用于在应用根部提供 FsusUI 的全局上下文。当前仓库已实现的配置面以 `vue/packages/components/config-provider/src/config-provider-props.ts` 为准。

> 运行示例：`pnpm dev` 后访问 demo-app，可直接看到全局尺寸、主题模式等配置的联动效果。

---

## 基础用法

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

## 主题模式

`theme-mode` 会把主题状态同步到 `<html>`，用于稳定地压过系统偏好或跟随系统偏好：

- `system`：跟随 `prefers-color-scheme`
- `dark`：强制暗色
- `light`：强制亮色

同步副作用包括：

- `class="dark"` / `class="light"`（显式模式）
- `data-theme-mode`
- `data-theme-resolved`
- `color-scheme`

如果你需要在 Vue 挂载前就先应用主题，配合 [`syncThemeMode`](../guide/dark-mode.md) 使用更合适。

---

## 已实现属性

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

## Button 配置

| 属性名          | 说明                             | 类型      | 默认值  |
| --------------- | -------------------------------- | --------- | ------- |
| autoInsertSpace | 两个中文字符之间是否自动插入空格 | `boolean` | `false` |

## Message 配置

| 属性名 | 说明                 | 类型     | 默认值 |
| ------ | -------------------- | -------- | ------ |
| max    | 同时显示的最大消息数 | `number` | —      |

---

## Render Pipeline 配置

`render-pipeline` 为重型内容提供统一的 Worker/分块/虚拟挂载预算。组件不会按名称写死启用策略；运行时会根据内容估算的 HTML 字节数、DOM 节点数和 item 数决定走同步渲染还是分块渲染。

策略选择是热拔插的：组件只调用统一 resolver，不直接写死策略分支。内部可以通过 `registerFsusRenderPipelineStrategyResolver()` 注册新的策略解析器，返回 `sync`、`chunked-main`、`chunked-worker` 或 `disabled`；注销函数执行后会回到默认预算策略。

组件接入也是注册制：全量安装、分组安装、demo contract 和按需 `app.use(ElXxx)` 都会为已安装控件注册默认 `RenderPipelineComponentPolicy`。轻量控件统一归类为 `sync-monitored`，滚动容器归类为 `viewport-provider`，可分块内容归类为 `chunk-adapter`，已有虚拟列表/网格归类为 `virtual-list` / `virtual-grid`，TreeV2、TableV2、SelectV2 通过 `inherited` 策略继承底层虚拟化预算。后续新增控件只需要注册 policy 或 adapter，不需要在现有控件里新增策略分支。

外部重型组件应从主包的稳定子路径 `render-pipeline` 接入 adapter registry、policy registry 和 runtime。主包根入口保留兼容导出，但新增业务代码优先使用专用入口；完整示例见 [Render Pipeline 指南](../guide/render-pipeline.md)。

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

SSR、Worker 不可用或组件无法提供可序列化分块 adapter 时会自动降级为主线程同步路径；轻量组件共享该配置但不会被强行虚拟化。
GPU 模式仅指浏览器 DOM compositor 路径，不引入 WebGPU；CPU 模式会收紧默认预算并优先使用 Worker 分块，但不会覆盖显式 `worker: 'disabled'`。

当前接入层：

- 全部 demo/安装器注册控件：都有组件级 policy，并通过统一策略路径解析为 `sync`、`chunked-main`、`chunked-worker` 或 `disabled`。
- `ElMarkdownRenderer`：小文档走同步 HTML fast path，大文档走 `chunked-worker` / `chunked-main` 与虚拟挂载。
- `VirtualList` / `DynamicSizeList` / `FixedSizeList`：通过统一策略与 `budget.overscanPx` 推导有效 cache；未显式提供 `render-pipeline` 时保持历史 `cache` 行为。
- `VirtualGrid` / `DynamicSizeGrid` / `FixedSizeGrid`：同样通过统一策略推导行列 cache。
- `TreeV2`、`TableV2`、`SelectV2`：通过上面的 VirtualList/Grid 继承统一预算策略，不在组件内部重复实现。

---

## Slots

| 插槽名  | 说明     | 参数         |
| ------- | -------- | ------------ |
| default | 应用内容 | `{ config }` |
