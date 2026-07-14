# VirtualList 虚拟列表

高性能虚拟滚动列表，用于渲染超大数据集，自动按需渲染可视区域内的条目。

## FsusUI WASM 加速

当列表条目数量 **≥ 2000** 时，FsusUI 自动启用基于 WASM 的行高预估算法（位于 `vue/packages/wasm/`），大幅减少初始布局计算时间。低于阈值时自动降级为纯 JavaScript 实现，无需任何手动配置。

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

## 滚动性能模型

VirtualList 与 VirtualGrid 只提升滚动窗口、单个内部平移容器、滚动条和必要浮层，不会为每个可见行或单元格创建独立合成层。快速滚动期间会暂时关闭行级 transition、glow、阴影和非必要滤镜；`scrollend` 或最后一次滚动事件 120 ms 后恢复静止状态。

样式缓存按 item size、layout、direction 与 Grid 尺寸模型分区，提供真实 `clear()` / `invalidate()` 并限制最多保留 64 个样式 map。滚动停止不会清空仍然有效的尺寸缓存；尺寸模型变化也不会复用旧 map。上述行为不改变 props、slot、键盘或 `scrollTo*` 合同。

#186 的同机真实 Chromium 配对使用 #184 runner、100K fixed/variable list 与大 Grid、60 Hz/DPR1、1 次 warmup + 7 次样本。修改前后 frame interval p95 分别为 `16.8→16.8 ms`、`16.8→16.8 ms`、`50.0→33.4 ms`；峰值 layer 数分别为 `38→13`、`35→13`、`30→13`。原始 JSON 保留在未跟踪 `.tmp/performance/issue-186-baseline-final/` 与 `.tmp/performance/issue-186-current-final2/`，这些本机数值不是跨机器预算。

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
