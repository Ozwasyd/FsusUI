# Tooltip

Shows a tooltip when the pointer hovers.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Set the content with `content` and the position with `placement` (12 directions are available).

## Themes

Use `effect` to choose `dark` (default), `light`, or a custom theme name.

## Additional Content

Use the named `content` slot instead of the `content` prop for multi-line rich content.

## HTML Content

Set `raw-content` to `true` to parse `content` as an HTML string.

> Treat HTML as trusted input only; see the [Security Policy](../../SECURITY.md)
> for security handling and reporting.

## Controlled Mode

Use `v-model:visible` for controlled visibility; controlled mode does not close automatically on outside clicks.

## Virtual Triggering

Use `virtual-triggering` and `virtual-ref` to decouple the trigger from the content.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| content | 显示内容（可被 `#content` 插槽覆盖） | `string` | `''` |
| raw-content | 是否将 content 解析为 HTML | `boolean` | `false` |
| placement | 弹出位置 | `'top' \| 'top-start' \| 'top-end' \| 'bottom' \| 'bottom-start' \| 'bottom-end' \| 'left' \| 'left-start' \| 'left-end' \| 'right' \| 'right-start' \| 'right-end'` | `bottom` |
| visible / v-model:visible | 是否显示 | `boolean` | — |
| disabled | 是否禁用 | `boolean` | — |
| offset | 偏移量 | `number` | `12` |
| trigger | 触发方式 | `'hover' \| 'click' \| 'focus' \| 'contextmenu'` | `hover` |
| show-after | 延迟显示（ms） | `number` | `0` |
| hide-after | 延迟隐藏（ms） | `number` | `200` |
| auto-close | 自动关闭延迟（ms），0 表示不自动关闭 | `number` | `0` |
| show-arrow | 是否显示箭头 | `boolean` | `true` |
| effect | 主题 | `'dark' \| 'light'` | `dark` |
| enterable | 鼠标是否可进入 tooltip | `boolean` | `true` |
| teleported | 是否将 tooltip 挂载到 `append-to` 指定的元素 | `boolean` | `true` |
| append-to | tooltip 挂载的目标元素 | `CSSSelector \| HTMLElement` | — |
| popper-class | 自定义 class | `string` | — |
| persistent | 非激活时是否保留 DOM | `boolean` | — |
| virtual-triggering | 是否启用虚拟触发 | `boolean` | — |
| virtual-ref | 虚拟触发的参考元素 | `HTMLElement` | — |
| transition | 动画名称 | `string` | — |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| before-show | 显示前触发 | `(event?: Event) => void` |
| show | 显示后触发 | `(event?: Event) => void` |
| before-hide | 隐藏前触发 | `(event?: Event) => void` |
| hide | 隐藏后触发 | `(event?: Event) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 触发 tooltip 的元素（只能有一个根元素） |
| content | 自定义 tooltip 内容 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| updatePopper | 更新 popper 实例 | `() => void` |
| onOpen | 控制显示 | `(event?: Event) => void` |
| onClose | 控制隐藏 | `(event?: Event) => void` |
| hide | 隐藏 | `(event?: Event) => void` |

---

## Frequently Asked Questions

**Why can't an input nested in a tooltip receive spaces?**

Set `:trigger-keys="[]"` so the space key is not intercepted:

```vue
<el-tooltip content="提示" placement="top" :trigger-keys="[]">
  <el-input v-model="value" />
</el-tooltip>
```
