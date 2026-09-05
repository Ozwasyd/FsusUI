# Timeline

Visualizes a sequence of events; unlike Steps, it emphasizes timestamps.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

```vue
<el-timeline>
  <el-timeline-item v-for="item in activities" :key="item.id" :timestamp="item.time">
    {{ item.content }}
  </el-timeline-item>
</el-timeline>
```

## Layout Mode

Use `mode` for the timeline/content relationship: `start` (default), `end`, `alternate`, or `alternate-reverse`.

## Custom Nodes

Customize node styling with `type`, `color`, `size`, and `icon`, or replace the node with the `#dot` slot.

## Timestamp Position

Use `placement` to put timestamps above (`top`) or below (`bottom`, default) the content.

## Reverse Order

Set `reverse` to order nodes in reverse.

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
