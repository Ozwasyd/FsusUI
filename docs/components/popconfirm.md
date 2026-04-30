# Popconfirm 气泡确认框

点击元素后弹出确认框，比 MessageBox 更轻量，适合快捷确认操作。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

仅支持 `title` 属性显示提示文字，`content` 属性无效。通过 `reference` 插槽放置触发元素。

```vue
<el-popconfirm title="确认删除？" @confirm="handleDelete">
  <template #reference>
    <el-button type="danger">删除</el-button>
  </template>
</el-popconfirm>
```

## 自定义

通过属性自定义按钮文字、类型、图标颜色等；通过 `#actions` 插槽完全自定义底部操作区。

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
