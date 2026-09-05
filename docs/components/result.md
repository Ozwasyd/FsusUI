# Result

Provides feedback about an operation result or an exceptional visit.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Use `icon` for the result icon and `title` / `sub-title` for the heading and subtitle.

```vue
<el-result icon="success" title="提交成功" sub-title="请等待审核人员处理">
  <template #extra>
    <el-button type="primary">返回</el-button>
  </template>
</el-result>
```

## Custom Content

Customize the icon, heading, subtitle, and footer actions with the named slots.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| title | 标题 | `string` | `''` |
| sub-title | 副标题 | `string` | `''` |
| icon | 图标类型 | `'primary' \| 'success' \| 'warning' \| 'info' \| 'error'` | `info` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| icon | 自定义图标 |
| title | 自定义标题 |
| sub-title | 自定义副标题 |
| extra | 自定义底部操作区 |
