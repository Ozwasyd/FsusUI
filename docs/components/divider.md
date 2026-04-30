# Divider 分割线

区隔内容的分割线。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

默认方向为水平，会从父容器中获取宽度。

```vue
<template>
  <span>First item</span>
  <el-divider />
  <span>Second item</span>
</template>
```

## 自定义内容

在分割线上显示文字，配合 `content-position` 设置内容位置（`left`、`center`、`right`）。

## 垂直分割线

通过 `direction="vertical"` 使用垂直分割线（适用于行内元素）。

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
