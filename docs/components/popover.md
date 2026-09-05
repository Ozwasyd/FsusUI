# Popover

Similar to Tooltip, but supports richer content such as tables and action buttons.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Set the trigger with `trigger`, content with `content` (or replace it with the default slot), and the trigger element with the `reference` slot.

## Nested Content

Put any component, such as a table or form, in the default slot.

## Controlled Mode

Use `v-model:visible` for manual visibility control.

## Virtual Triggering

Use `virtual-triggering` and `virtual-ref` to decouple the trigger from the popover content.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| trigger | 触发方式 | `'click' \| 'focus' \| 'hover' \| 'contextmenu'` | `hover` |
| title | 气泡标题 | `string` | — |
| content | 气泡内容（可被默认插槽覆盖） | `string` | `''` |
| width | 宽度 | `string \| number` | `150` |
| placement | 弹出位置 | `string` | `bottom` |
| disabled | 是否禁用 | `boolean` | `false` |
| visible / v-model:visible | 是否显示 | `boolean \| null` | `null` |
| offset | 偏移量（Popover 默认 undefined，Tooltip 默认 12） | `number` | `undefined` |
| show-arrow | 是否显示箭头 | `boolean` | `true` |
| show-after | 延迟显示（ms） | `number` | `0` |
| hide-after | 延迟隐藏（ms） | `number` | `200` |
| popper-class | 自定义 class | `string` | — |
| effect | 主题 | `'dark' \| 'light'` | `light` |
| teleported | 是否挂载到 body | `boolean` | `true` |
| append-to | 挂载目标元素 | `CSSSelector \| HTMLElement` | `body` |
| persistent | 非激活时是否保留 DOM | `boolean` | `true` |
| virtual-triggering | 是否启用虚拟触发 | `boolean` | — |
| virtual-ref | 虚拟触发的参考元素 | `HTMLElement` | — |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| show | 显示时触发 | `() => void` |
| hide | 隐藏时触发 | `() => void` |
| before-enter | 进入动画开始前触发 | `() => void` |
| after-enter | 进入动画结束后触发 | `() => void` |
| before-leave | 离开动画开始前触发 | `() => void` |
| after-leave | 离开动画结束后触发 | `() => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 气泡内容（可访问 `hide` 方法来关闭气泡） |
| reference | 触发气泡的元素（只能有一个根元素） |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| hide | 隐藏气泡 | `() => void` |
