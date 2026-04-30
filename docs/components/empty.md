# Empty 空状态

空状态时的占位提示。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

```vue
<el-empty description="暂无数据" />
```

## 自定义图片

通过 `image` 属性设置自定义图片 URL，`image-size` 控制图片宽度（px）。

## 底部内容

通过默认插槽在底部插入操作按钮等内容。

```vue
<el-empty description="暂无内容">
  <el-button type="primary">立即创建</el-button>
</el-empty>
```

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| image | 图片 URL | `string` | `''` |
| image-size | 图片宽度（px） | `number` | — |
| description | 描述文字 | `string` | `''` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 底部操作区域 |
| image | 自定义图片区域 |
| description | 自定义描述文字 |
