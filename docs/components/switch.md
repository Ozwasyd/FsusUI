# Switch

Represents a choice between two opposing states, commonly “on” and “off”.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Bind a Boolean with `v-model`. Customize colors with `--el-switch-on-color` / `--el-switch-off-color`.

## Text Description

Use `active-text` / `inactive-text` for state labels; set `inline-prompt` to place them inside the control.

## Custom Icons

Set state icons with `active-icon` / `inactive-icon`.

## Extended Value Types

Use `active-value` / `inactive-value` to support string or numeric values.

## Disabled

Set `disabled` to disable the switch.

## Loading State

Set `loading` to show a loading state.

## Prevent Switching

If `before-change` returns `false` or a rejected Promise, the switch does not change.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值（应与 active-value 或 inactive-value 等价） | `boolean \| string \| number` | `false` |
| disabled | 是否禁用 | `boolean` | `false` |
| loading | 是否加载中 | `boolean` | `false` |
| size | 尺寸 | `'' \| 'large' \| 'default' \| 'small'` | `''` |
| width | 开关宽度 | `number \| string` | `''` |
| inline-prompt | 图标或文字是否内嵌在圆点内 | `boolean` | `false` |
| active-icon | 开启状态的图标 | `string \| Component` | — |
| inactive-icon | 关闭状态的图标 | `string \| Component` | — |
| active-action-icon | 开启状态的动作图标 | `string \| Component` | — |
| inactive-action-icon | 关闭状态的动作图标 | `string \| Component` | — |
| active-text | 开启状态文字 | `string` | `''` |
| inactive-text | 关闭状态文字 | `string` | `''` |
| active-value | 开启时的值 | `boolean \| string \| number` | `true` |
| inactive-value | 关闭时的值 | `boolean \| string \| number` | `false` |
| name | 原生 `name` 属性 | `string` | `''` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| before-change | 切换前钩子，返回 `false` 或 rejected Promise 时阻止切换 | `() => Promise<boolean> \| boolean` | — |
| id | 输入框 id | `string` | — |
| tabindex | 输入框 tabindex | `string \| number` | — |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 值改变时触发 | `(val: boolean \| string \| number) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| active-action | 自定义开启状态动作内容 |
| inactive-action | 自定义关闭状态动作内容 |
| active | 自定义开启状态内容 |
| inactive | 自定义关闭状态内容 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| focus | 手动聚焦开关 | `() => void` |
