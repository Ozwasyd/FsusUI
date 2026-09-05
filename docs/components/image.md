# Image

In addition to native image behavior, it supports lazy loading, custom placeholders, load-error content, and image preview.

## Public Preview

This is a preview public component. See [API stability](../api-stability.md#stability-levels)
for the change policy and the shared [theme token contract](../theme/tokens.md).
Provide a meaningful `alt` (or an empty `alt` for decoration), and keep
preview controls keyboard accessible. Lazy loading follows browser or scroll
container behavior; consumers own remote authentication, placeholders, and
retry policy. The standalone [`ImageViewer`](./image-viewer.md) documents the
full-screen preview surface.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Use `fit` to control how the image fills its container, as with CSS `object-fit`.

## Placeholder Content

Customize the pre-load placeholder with the `placeholder` slot.

## Load Failure

Customize load-error content with the `error` slot.

## Lazy Loading

Set `loading="lazy"` or `lazy` for lazy loading; use `scroll-container` to choose the scroll container to observe.

## Image Preview

Set `preview-src-list` to enable preview and `initial-index` for the initial image index.

---

## Image API

### Image Attributes

| 属性名                | 说明                                                 | 类型                                                             | 默认值  |
| --------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- | ------- |
| src                   | 图片地址                                             | `string`                                                         | `''`    |
| fit                   | 图片填充方式（同 `object-fit`）                      | `'' \| 'fill' \| 'contain' \| 'cover' \| 'none' \| 'scale-down'` | `''`    |
| loading               | 原生 loading 属性                                    | `'eager' \| 'lazy'`                                              | —       |
| lazy                  | 是否懒加载                                           | `boolean`                                                        | `false` |
| scroll-container      | 懒加载时监听滚动的容器                               | `string \| HTMLElement`                                          | —       |
| alt                   | 原生 alt 属性                                        | `string`                                                         | —       |
| preview-src-list      | 开启大图预览的 URL 列表                              | `string[]`                                                       | `[]`    |
| initial-index         | 初始预览图片的索引                                   | `number`                                                         | `0`     |
| preview-teleported    | 预览遮罩是否挂载到 body（嵌套有 transform 时需开启） | `boolean`                                                        | `false` |
| hide-on-click-modal   | 预览时点击遮罩是否关闭                               | `boolean`                                                        | `false` |
| close-on-press-escape | 预览时按 ESC 是否关闭                                | `boolean`                                                        | `true`  |
| infinite              | 预览是否循环                                         | `boolean`                                                        | `true`  |
| zoom-rate             | 缩放速率                                             | `number`                                                         | `1.2`   |
| min-scale             | 最小缩放比例                                         | `number`                                                         | `0.2`   |
| max-scale             | 最大缩放比例                                         | `number`                                                         | `7`     |
| show-progress         | 预览时是否显示进度                                   | `boolean`                                                        | `false` |

### Image Events

| 事件名 | 说明               | 回调参数                  |
| ------ | ------------------ | ------------------------- |
| load   | 图片加载成功时触发 | `(e: Event) => void`      |
| error  | 图片加载失败时触发 | `(e: Event) => void`      |
| switch | 预览切换图片时触发 | `(index: number) => void` |
| close  | 关闭预览时触发     | `() => void`              |
| show   | 预览打开时触发     | `() => void`              |

### Image Slots

| 插槽名      | 说明             |
| ----------- | ---------------- |
| placeholder | 加载中的占位内容 |
| error       | 加载失败的内容   |

### Image Exposes

| 名称        | 说明         | 类型         |
| ----------- | ------------ | ------------ |
| showPreview | 手动打开预览 | `() => void` |
