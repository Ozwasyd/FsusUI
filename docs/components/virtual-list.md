# VirtualList 虚拟列表

高性能虚拟滚动列表，用于渲染超大数据集，自动按需渲染可视区域内的条目。

## FsusUI WASM 加速

当列表条目数量 **≥ 2000** 时，FsusUI 自动启用基于 WASM 的行高预估算法（位于 `packages/wasm/`），大幅减少初始布局计算时间。低于阈值时自动降级为纯 JavaScript 实现，无需任何手动配置。

> **注意**：如需从源码重新编译 WASM 模块，需要 Emscripten 5.0.4。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

将大量数据传给 `data`，设置条目固定高度 `item-size`，组件只渲染视口内的条目。

```vue
<template>
  <el-virtual-list :data="bigList" :item-size="40" style="height: 400px">
    <template #default="{ item }">
      <div class="list-item">{{ item.label }}</div>
    </template>
  </el-virtual-list>
</template>
```

## 动态行高

当条目高度不固定时，省略 `item-size`，WASM 行高预估器（条目 ≥ 2000）或 JS 估算器（条目 < 2000）会自动处理。

## 水平滚动

设置 `direction="horizontal"` 实现水平虚拟滚动。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| data | 列表数据数组 | `any[]` | `[]` |
| item-size | 每个条目的高度（px）；不设置时启用动态行高估算 | `number` | — |
| height | 容器高度 | `string \| number` | `400` |
| width | 容器宽度 | `string \| number` | `'100%'` |
| direction | 滚动方向 | `'vertical' \| 'horizontal'` | `'vertical'` |
| cache | 视口外预渲染条目数量（缓冲区） | `number` | `2` |
| estimated-item-size | 动态行高模式下的估算高度 | `number` | `48` |
| key-field | 数据项中用作唯一 key 的字段名 | `string` | `'id'` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| scroll | 列表滚动时触发 | `(event: Event) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 条目内容（可访问 `item`、`index`、`style`） |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| scrollTo | 滚动到指定偏移量 | `(offset: number) => void` |
| scrollToIndex | 滚动到指定索引条目 | `(index: number) => void` |
