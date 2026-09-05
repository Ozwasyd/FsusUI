# Divider

A divider that separates content.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

The default direction is horizontal and takes its width from the parent container.

```vue
<template>
  <span>First item</span>
  <el-divider />
  <span>Second item</span>
</template>
```

## Custom Content

Display text on the divider and use `content-position` to place it at `left`, `center`, or `right`.

## Vertical Divider

Set `direction="vertical"` for a vertical divider (for inline elements).

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| direction | 分割线方向 | `'horizontal' \| 'vertical'` | `horizontal` |
| border-style | 分割线样式（同 CSS border-style） | `string` | `solid` |
| content-position | 内容位置（仅水平分割线有效） | `'left' \| 'center' \| 'right'` | `center` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 分割线内容 |
