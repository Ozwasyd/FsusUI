# Popconfirm

Opens a lightweight confirmation after an element is clicked, suited to quick confirmations instead of MessageBox.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Only `title` displays prompt text; `content` has no effect. Put the trigger in the `reference` slot.

```vue
<el-popconfirm title="确认删除？" @confirm="handleDelete">
  <template #reference>
    <el-button type="danger">删除</el-button>
  </template>
</el-popconfirm>
```

## Custom Content

Customize button labels, types, icon colors, and related options through props; replace the footer actions with `#actions`.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| title | 提示文字 | `string` | — |
| confirm-button-text | 确认按钮文字 | `string` | — |
| cancel-button-text | 取消按钮文字 | `string` | — |
| confirm-button-type | 确认按钮类型 | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'text'` | `primary` |
| cancel-button-type | 取消按钮类型 | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'text'` | `text` |
| icon | 图标组件 | `string \| Component` | `QuestionFilled` |
| icon-color | 图标颜色 | `string` | `#f90` |
| hide-icon | 是否隐藏图标 | `boolean` | `false` |
| hide-after | 延迟隐藏（ms） | `number` | `200` |
| effect | 主题 | `'dark' \| 'light'` | `light` |
| width | 宽度（最小 150px） | `string \| number` | `150` |
| teleported | 是否挂载到 body | `boolean` | `true` |
| persistent | 非激活时是否保留 DOM | `boolean` | `false` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| confirm | 点击确认按钮时触发 | `(e: MouseEvent) => void` |
| cancel | 点击取消按钮时触发 | `(e: MouseEvent) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| reference | 触发气泡框的元素 |
| actions | 自定义底部操作区（可访问 confirm/cancel 方法） |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| hide | 隐藏气泡框 | `() => void` |
