# Text 文本

语义化文本组件。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

使用 `type` 属性定义文本类型。

## 不同尺寸

使用 `size` 属性设置文本尺寸：`large`、`default`、`small`。

## 文本省略

传入 `truncated` 属性，当文本超出容器宽度或 max-width 时自动显示省略号。  
使用 `line-clamp` 属性实现多行省略。

## 自定义标签

使用 `tag` 属性覆盖渲染的 HTML 标签（默认 `span`）。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| type | 文本类型 | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | — |
| size | 文本尺寸 | `'large' \| 'default' \| 'small'` | `default` |
| truncated | 是否超出省略 | `boolean` | `false` |
| line-clamp | 最大行数（多行省略） | `string \| number` | — |
| tag | 自定义元素标签 | `string` | `span` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 文本内容 |
