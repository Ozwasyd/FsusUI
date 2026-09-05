# Backtop

An action button that returns to the top.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Scroll down the page to reveal the return-to-top button in the lower-right corner.

```vue
<el-backtop :right="40" :bottom="40" />
```

## Custom Content

The default area is 40×40px; customize its content with the default slot.

```vue
<el-backtop>
  <el-icon><top /></el-icon>
</el-backtop>
```

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| target | 触发滚动的目标元素（CSS 选择器） | `string` | — |
| visibility-height | 滚动高度超过该值时才显示按钮 | `number` | `200` |
| right | 按钮距右侧的距离（px） | `number` | `40` |
| bottom | 按钮距底部的距离（px） | `number` | `40` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| click | 点击时触发 | `(evt: MouseEvent) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义按钮内容 |
