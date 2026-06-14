# Scrollbar 滚动条

替代浏览器原生滚动条，提供符合 FsusUI 设计风格的自定义滚动条。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `height` 属性设置滚动条高度；若不设置，则自适应父容器高度。

## 横向滚动

当内容宽度超过滚动条宽度时，自动显示横向滚动条。

## 最大高度

通过 `max-height` 设置最大高度，内容超出时才显示滚动条。

## 手动滚动

使用 `setScrollTop` / `setScrollLeft` 方法手动控制滚动位置。

## 无限滚动

通过 `end-reached` 事件监听滚动到底部：

```vue
<template>
  <el-scrollbar height="400px" @end-reached="loadMore">
    <div v-for="item in items" :key="item">{{ item }}</div>
  </el-scrollbar>
</template>
```

## Scroll containment

Scrollbar keeps native touch and trackpad panning enabled by default. Its wrap
uses normal scroll chaining so a page can continue scrolling when a nested
scrollbar reaches a boundary.

Use `overscroll="contain"` only for intentional internal scroll traps such as a
drawer, modal, or fixed-height panel where the surrounding page must not receive
the boundary gesture.

---

## API

### Attributes

| 属性名           | 说明                                           | 类型                                         | 默认值  |
| ---------------- | ---------------------------------------------- | -------------------------------------------- | ------- |
| height           | 滚动条高度                                     | `string \| number`                           | —       |
| max-height       | 滚动条最大高度                                 | `string \| number`                           | —       |
| native           | 是否使用原生滚动条样式                         | `boolean`                                    | `false` |
| wrap-style       | 包裹容器的样式                                 | `string \| CSSProperties \| CSSProperties[]` | —       |
| wrap-class       | 包裹容器的类名                                 | `string`                                     | —       |
| view-style       | 内容区域的样式                                 | `string \| CSSProperties \| CSSProperties[]` | —       |
| view-class       | 内容区域的类名                                 | `string`                                     | —       |
| noresize         | 不响应容器尺寸变化（容器尺寸固定时可优化性能） | `boolean`                                    | `false` |
| tag              | 内容区域的元素标签                             | `string`                                     | `div`   |
| always           | 始终显示滚动条                                 | `boolean`                                    | `false` |
| min-size         | 滚动条最小尺寸（px）                           | `number`                                     | `20`    |
| id               | 内容区域的 id                                  | `string`                                     | —       |
| role             | 内容区域的 role                                | `string`                                     | —       |
| aria-label       | 内容区域的 aria-label                          | `string`                                     | —       |
| aria-orientation | 内容区域的 aria-orientation                    | `'horizontal' \| 'vertical'`                 | —       |
| overscroll       | 滚动链行为；仅在需要内部滚动陷阱时使用 contain | `'auto' \| 'contain'`                        | `auto`  |
| tabindex         | 包裹容器的 tabindex                            | `number \| string`                           | —       |
| distance         | 触发 `end-reached` 事件的距离（px）            | `number`                                     | `0`     |

### Events

| 事件名      | 说明                     | 回调参数                                                      |
| ----------- | ------------------------ | ------------------------------------------------------------- |
| scroll      | 滚动时触发，返回滚动距离 | `({ scrollLeft: number, scrollTop: number }) => void`         |
| end-reached | 滚动到底部时触发         | `(direction: 'top' \| 'bottom' \| 'left' \| 'right') => void` |

### Slots

| 插槽名  | 说明       |
| ------- | ---------- |
| default | 自定义内容 |

### Exposes

| 名称          | 说明               | 类型                                                            |
| ------------- | ------------------ | --------------------------------------------------------------- |
| handleScroll  | 触发滚动事件处理   | `() => void`                                                    |
| scrollTo      | 滚动到指定坐标     | `(options: ScrollToOptions \| number, yCoord?: number) => void` |
| setScrollTop  | 设置竖向滚动距离   | `(scrollTop: number) => void`                                   |
| setScrollLeft | 设置横向滚动距离   | `(scrollLeft: number) => void`                                  |
| update        | 手动更新滚动条状态 | `() => void`                                                    |
| wrapRef       | 滚动包裹容器的 ref | `Ref<HTMLDivElement>`                                           |
