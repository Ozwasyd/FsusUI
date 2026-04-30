# Affix 固钉

将元素固定在特定可见区域。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

默认固定在页面顶部，通过 `offset` 设置偏移距离。

```vue
<el-affix :offset="20">
  <el-button type="primary">固定在顶部</el-button>
</el-affix>
```

## 目标容器

通过 `target` 指定 CSS 选择器，将固钉限制在容器内；超出容器范围时自动隐藏。

## 固定位置

通过 `position` 设置固定在顶部（`top`）或底部（`bottom`）。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| offset | 偏移距离（px） | `number` | `0` |
| position | 固定位置 | `'top' \| 'bottom'` | `top` |
| target | 目标容器的 CSS 选择器 | `string` | — |
| z-index | 层级 | `number` | `100` |
| teleported | 是否将固定元素挂载到 `append-to` 指定的元素 | `boolean` | `false` |
| append-to | 固定元素的挂载目标 | `CSSSelector \| HTMLElement` | `body` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 固定状态改变时触发 | `(fixed: boolean) => void` |
| scroll | 滚动时触发 | `(value: { scrollTop: number, fixed: boolean }) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 固钉内容 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| update | 手动更新固钉状态 | `() => void` |
| updateRoot | 更新根元素的矩形信息 | `() => void` |
