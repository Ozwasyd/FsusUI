# Affix

Pins an element to a specific visible area.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

The element is fixed to the page top by default; set the offset with `offset`.

```vue
<el-affix :offset="20">
  <el-button type="primary">固定在顶部</el-button>
</el-affix>
```

## Target Container

Set a CSS selector with `target` to constrain the pin to a container; it hides
automatically when it leaves that container.

## Fixed Position

Use `position` to pin to the top (`top`) or bottom (`bottom`).

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
