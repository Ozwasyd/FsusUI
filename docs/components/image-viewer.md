# ImageViewer 图片预览

以全屏浮层查看一组图片，支持上一张/下一张、缩放、旋转、关闭和键盘操作。`Image` 组件通过 `preview-src-list` 内置调用该预览器；需要完全自定义触发入口时可直接使用 `ElImageViewer`。

## Public Preview Notes

| 字段                   | 说明                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| purpose                | 为图片列表提供全屏预览、缩放、旋转与键盘导航能力。                                              |
| basic usage            | 传入 `url-list`，通过 `v-if` 或业务状态控制挂载，监听 `close` 后移除预览器。                    |
| props / events / slots | 本页 `ImageViewer API` 覆盖公开 props 和 events；当前没有公开 slots。                           |
| accessibility          | 保留 ESC 关闭能力，确保打开预览时背景内容不可操作；图片应在触发入口处提供上下文文本或替代说明。 |
| theme token notes      | 跟随公开 overlay、文本、主色、阴影和 motion overlay token。                                     |
| known limitations      | 预览器只负责展示已加载 URL，不处理鉴权、下载、图片安全扫描或错误重试。                          |
| stability level        | Preview public component。                                                                      |

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

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
