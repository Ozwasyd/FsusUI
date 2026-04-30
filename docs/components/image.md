# Image 图片

除了原生特性外，还支持懒加载、自定义占位符、加载失败提示、图片预览等功能。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `fit` 属性控制图片填充容器的方式（同 CSS `object-fit`）。

## 占位内容

通过 `placeholder` 插槽自定义图片加载前的占位内容。

## 加载失败

通过 `error` 插槽自定义加载失败时显示的内容。

## 懒加载

设置 `loading="lazy"` 或 `lazy` 实现懒加载；通过 `scroll-container` 指定监听滚动的容器。

## 图片预览

设置 `preview-src-list` 属性开启大图预览，通过 `initial-index` 设置初始预览索引。

---

## Image API

### Image Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| src | 图片地址 | `string` | `''` |
| fit | 图片填充方式（同 `object-fit`） | `'' \| 'fill' \| 'contain' \| 'cover' \| 'none' \| 'scale-down'` | `''` |
| loading | 原生 loading 属性 | `'eager' \| 'lazy'` | — |
| lazy | 是否懒加载 | `boolean` | `false` |
| scroll-container | 懒加载时监听滚动的容器 | `string \| HTMLElement` | — |
| alt | 原生 alt 属性 | `string` | — |
| preview-src-list | 开启大图预览的 URL 列表 | `string[]` | `[]` |
| initial-index | 初始预览图片的索引 | `number` | `0` |
| preview-teleported | 预览遮罩是否挂载到 body（嵌套有 transform 时需开启） | `boolean` | `false` |
| hide-on-click-modal | 预览时点击遮罩是否关闭 | `boolean` | `false` |
| close-on-press-escape | 预览时按 ESC 是否关闭 | `boolean` | `true` |
| infinite | 预览是否循环 | `boolean` | `true` |
| zoom-rate | 缩放速率 | `number` | `1.2` |
| min-scale | 最小缩放比例 | `number` | `0.2` |
| max-scale | 最大缩放比例 | `number` | `7` |
| show-progress | 预览时是否显示进度 | `boolean` | `false` |

### Image Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| load | 图片加载成功时触发 | `(e: Event) => void` |
| error | 图片加载失败时触发 | `(e: Event) => void` |
| switch | 预览切换图片时触发 | `(index: number) => void` |
| close | 关闭预览时触发 | `() => void` |
| show | 预览打开时触发 | `() => void` |

### Image Slots

| 插槽名 | 说明 |
|--------|------|
| placeholder | 加载中的占位内容 |
| error | 加载失败的内容 |

### Image Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| showPreview | 手动打开预览 | `() => void` |
