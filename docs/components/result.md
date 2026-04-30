# Result 结果

用于对用户操作结果或异常访问给出反馈。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

设置 `icon` 展示不同类型的结果图标，设置 `title` 和 `sub-title` 显示标题和副标题。

```vue
<el-result icon="success" title="提交成功" sub-title="请等待审核人员处理">
  <template #extra>
    <el-button type="primary">返回</el-button>
  </template>
</el-result>
```

## 自定义内容

通过各具名插槽自定义图标、标题、副标题和底部操作区域。

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
