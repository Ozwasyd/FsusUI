# ImageViewer

Shows a group of images in a full-screen overlay with previous/next navigation, zoom, rotation, close, and keyboard controls. `Image` invokes it through `preview-src-list`; use `ElImageViewer` directly when the trigger must be fully customized.

## Public Preview

This is a preview public component. See [API stability](../api-stability.md#stability-levels)
for the change policy. Keep Escape-to-close and make the trigger provide
context or alternative text. The viewer displays already-loaded URLs; it does
not handle authentication, downloads, image scanning, or retries. Wrapper,
mask, and control insets follow the shared [viewport and safe-area contract](../theme/tokens.md#viewport-and-safe-area-contract).

> See the [Playground](../playground.md) for runnable component examples.

---

## Viewport / Safe Area

ImageViewer follows the shared [viewport and safe-area contract](../theme/tokens.md#viewport-and-safe-area-contract):
the wrapper and mask cover the full viewport, while close/previous/next/action
controls use the shared `max(base, safe-area)` helper and remain inside the safe
rectangle in landscape cutout layouts. The `pnpm audit:visual-boundaries` matrix
asserts this with #260 variable overrides; real-device evidence is separate.

## Basic Usage

```vue
<template>
  <el-button @click="visible = true">预览图片</el-button>
  <el-image-viewer
    v-if="visible"
    :url-list="images"
    :initial-index="0"
    @close="visible = false"
  />
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const visible = ref(false)
const images = [
  'https://example.com/preview-a.png',
  'https://example.com/preview-b.png',
]
</script>
```

## ImageViewer API

### ImageViewer Attributes

| 属性名                | 说明                 | 类型       | 默认值  |
| --------------------- | -------------------- | ---------- | ------- |
| url-list              | 预览图片 URL 列表    | `string[]` | `[]`    |
| z-index               | 预览浮层层级         | `number`   | —       |
| initial-index         | 初始预览图片索引     | `number`   | `0`     |
| infinite              | 是否循环预览         | `boolean`  | `true`  |
| hide-on-click-modal   | 点击遮罩是否触发关闭 | `boolean`  | `false` |
| teleported            | 是否挂载到 body      | `boolean`  | `false` |
| close-on-press-escape | 是否允许按 ESC 关闭  | `boolean`  | `true`  |
| zoom-rate             | 缩放速率             | `number`   | `1.2`   |
| min-scale             | 最小缩放比例         | `number`   | `0.2`   |
| max-scale             | 最大缩放比例         | `number`   | `7`     |

### ImageViewer Events

| 事件名 | 说明             | 回调参数                  |
| ------ | ---------------- | ------------------------- |
| close  | 关闭预览器时触发 | `() => void`              |
| switch | 切换图片时触发   | `(index: number) => void` |
| rotate | 旋转图片时触发   | `(deg: number) => void`   |
