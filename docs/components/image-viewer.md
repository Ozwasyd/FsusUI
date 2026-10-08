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

## Modal composition and SSR

ImageViewer owns dialog semantics, focus entry/trapping/return, background inert
state and the shared body scroll lock. `visible` defaults to true for existing
`v-if` consumers; `v-model:visible` also supports reusing a mounted instance.
`initial-index` initializes an uncontrolled viewer only. Use `active-index` (or
`v-model:active-index`) for reactive changes, or the exposed `setActiveItem(index)`
method. `switch` and `update:activeIndex` report a changed index. `previous` and
`next` report the resulting index and preserve navigation intent even in a
circular two-image list. A finite boundary and a single-image list emit no
navigation event. An empty list remains dismissible.

Use `alt-list` aligned with `url-list`, `aria-label` for the dialog name and
`labels` to override close, previous, next, zoomOut, zoomIn, toggleMode,
rotateLeft and rotateRight accessible names. Defaults use the configured locale;
new action translations fall back to English until that locale supplies them.
The optional `caption` slot receives `{ index, url, alt }` and is associated with
the dialog using `aria-describedby`. Long captions scroll with native wheel
input without zooming the image. Original-size mode removes contain limits;
switching back restores viewport fitting, including with `csp-safe`.
The existing default slot remains supported. Standard non-prop attributes are forwarded to the dialog root.
`show-toolbar="false"` disables zoom, rotation, size switching and dragging,
while preserving close and previous/next keyboard and touch navigation.

When `teleported` is true, `append-to` selects the target (default `body`). For an
initially open SSR viewer, provide a dedicated host outside the application
mount root and insert that target's `SSRContext.teleports` output into the host
before hydrating. Vue body Teleport hydration is not supported for a body that
also contains the application. The target must exist on both server and client.
A client-only initially closed viewer may use the default body target.

`csp-safe` omits SSR style attributes, uses a class for inactive images and
applies dynamic z-index/transform values through CSSOM after mount. Use this
under `style-src-attr 'none'`; it does not require weakening the consumer CSP.
The shared modal hooks retain responsibility for cleanup on close/unmount.

| Additional attribute | Type                         | Default                 |
| -------------------- | ---------------------------- | ----------------------- |
| visible              | `boolean`                    | `true`                  |
| active-index         | `number`                     | —                       |
| alt-list             | `string[]`                   | `[]`                    |
| aria-label           | `string`                     | localized preview label |
| labels               | `Partial<ImageViewerLabels>` | localized names         |
| show-toolbar         | `boolean`                    | `true`                  |
| append-to            | `string`                     | `body`                  |
| csp-safe             | `boolean`                    | `false`                 |

| Additional event   | Payload                  |
| ------------------ | ------------------------ |
| update:visible     | `boolean`                |
| update:activeIndex | `number`                 |
| previous / next    | resulting `number` index |
