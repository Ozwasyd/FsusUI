# VirtualList

A high-performance virtual list for very large data sets that renders visible items on demand.

## FsusUI WASM Acceleration

When the list has **≥ 2000** items, FsusUI automatically enables the WASM row-height estimator in `vue/packages/wasm/`, reducing initial layout work. Below the threshold it falls back to JavaScript automatically, with no manual configuration.

> **Note:** Rebuilding the WASM module from source requires Emscripten 5.0.4.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Pass a large data set through `data` and set the fixed item height with `item-size`; only visible items render.

```vue
<template>
  <el-virtual-list :data="bigList" :item-size="40" style="height: 400px">
    <template #default="{ item }">
      <div class="list-item">{{ item.label }}</div>
    </template>
  </el-virtual-list>
</template>
```

## Dynamic Row Height

When item height varies, omit `item-size`; the WASM estimator (≥ 2000 items) or JS estimator (< 2000 items) handles it automatically.

## Horizontal Scrolling

Set `direction="horizontal"` for horizontal virtual scrolling.

## Scrolling Performance Model

VirtualList and VirtualGrid promote only the scroll window, one internal transform container, the scrollbar, and required overlays; they do not create a compositing layer for every visible row or cell. During rapid scrolling, row-level transitions, glow, shadows, and non-essential filters are temporarily disabled and restored after `scrollend` or 120ms after the last scroll event.

The style cache is partitioned by item size, layout, direction, and Grid size model. It provides real `clear()` / `invalidate()` methods and keeps at most 64 style maps. Stopping scroll does not clear still-valid size caches, and a changed size model does not reuse an old map. These rules do not change props, slots, keyboard behavior, or the `scrollTo*` contract.

#186's same-machine Chromium pairing used the #184 runner, 100K fixed/variable lists and a large Grid, 60Hz/DPR1, one warmup, and seven samples. Before/after frame-interval p95 was `16.8→16.8 ms`, `16.8→16.8 ms`, and `50.0→33.4 ms`; peak layer counts were `38→13`, `35→13`, and `30→13`. Raw JSON remains in the untracked `.tmp/performance/issue-186-baseline-final/` and `.tmp/performance/issue-186-current-final2/`; these local values are not cross-machine budgets.

---

## API

### Attributes

| 属性名              | 说明                                           | 类型                         | 默认值       |
| ------------------- | ---------------------------------------------- | ---------------------------- | ------------ |
| data                | 列表数据数组                                   | `any[]`                      | `[]`         |
| item-size           | 每个条目的高度（px）；不设置时启用动态行高估算 | `number`                     | —            |
| height              | 容器高度                                       | `string \| number`           | `400`        |
| width               | 容器宽度                                       | `string \| number`           | `'100%'`     |
| direction           | 滚动方向                                       | `'vertical' \| 'horizontal'` | `'vertical'` |
| cache               | 视口外预渲染条目数量（缓冲区）                 | `number`                     | `2`          |
| estimated-item-size | 动态行高模式下的估算高度                       | `number`                     | `48`         |
| key-field           | 数据项中用作唯一 key 的字段名                  | `string`                     | `'id'`       |

### Events

| 事件名 | 说明           | 回调参数                 |
| ------ | -------------- | ------------------------ |
| scroll | 列表滚动时触发 | `(event: Event) => void` |

### Slots

| 插槽名  | 说明                                        |
| ------- | ------------------------------------------- |
| default | 条目内容（可访问 `item`、`index`、`style`） |

### Exposes

| 名称          | 说明               | 类型                       |
| ------------- | ------------------ | -------------------------- |
| scrollTo      | 滚动到指定偏移量   | `(offset: number) => void` |
| scrollToIndex | 滚动到指定索引条目 | `(index: number) => void`  |
