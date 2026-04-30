# Backtop 回到顶部

回到顶部的操作按钮。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

向下滚动页面，右下角会出现回到顶部按钮。

```vue
<el-backtop :right="40" :bottom="40" />
```

## 自定义内容

默认显示区域为 40×40px，通过默认插槽自定义内容。

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
