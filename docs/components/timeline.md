# Timeline 时间线

可视化地呈现时间流信息，与 Steps 的区别在于强调时间戳。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

```vue
<el-timeline>
  <el-timeline-item v-for="item in activities" :key="item.id" :timestamp="item.time">
    {{ item.content }}
  </el-timeline-item>
</el-timeline>
```

## 排列模式

通过 `mode` 控制时间线与内容的相对位置：`start`（默认）、`end`、`alternate`、`alternate-reverse`。

## 自定义节点

通过 `type`、`color`、`size`、`icon` 属性自定义节点样式，或通过 `#dot` 插槽完全自定义节点。

## 时间戳位置

通过 `placement` 将时间戳放置在内容上方（`top`）或下方（`bottom`，默认）。

## 反向排列

设置 `reverse` 使节点按倒序排列。

---

## Timeline API

### Timeline Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| reverse | 是否倒序 | `boolean` | `false` |
| mode | 时间线与内容的相对位置 | `'start' \| 'alternate' \| 'alternate-reverse' \| 'end'` | `start` |

### Timeline Slots

| 插槽名 | 说明 | 子组件 |
|--------|------|--------|
| default | 时间线内容 | `Timeline-Item` |

---

## Timeline-Item API

### Timeline-Item Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| timestamp | 时间戳 | `string` | `''` |
| hide-timestamp | 是否隐藏时间戳 | `boolean` | `false` |
| center | 是否垂直居中 | `boolean` | `false` |
| placement | 时间戳位置 | `'top' \| 'bottom'` | `bottom` |
| type | 节点类型（控制颜色） | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | `''` |
| color | 节点背景色 | `string` | `''` |
| size | 节点大小 | `'normal' \| 'large'` | `normal` |
| icon | 节点图标 | `string \| Component` | — |
| hollow | 图标是否为空心 | `boolean` | `false` |

### Timeline-Item Slots

| 插槽名 | 说明 |
|--------|------|
| default | 时间线项目内容 |
| dot | 自定义节点 |
