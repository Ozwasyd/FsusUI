# Checkbox

Select multiple values from a set of alternatives.

> **Deprecated:** using `label` as `value` is deprecated. Use the `value` prop
> instead (requires 2.6.0+).

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Use a checkbox alone with a Boolean `v-model`.

## Disabled State

Set `disabled` to disable a checkbox.

## Checkbox Group

Group checkboxes with `el-checkbox-group` and bind an array with `v-model`.

## Select All (Indeterminate State)

Use `indeterminate` for a select-all intermediate state.

## Minimum/Maximum Selection

Use `min` and `max` on `el-checkbox-group` to limit the selection count.

## Button Style

Replace `el-checkbox` with `el-checkbox-button` for a button style.

## With Border

Set `border` to add a border.

---

## Checkbox API

### Checkbox Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string \| number \| boolean` | — |
| value | 在 checkbox-group 中使用时的值 | `string \| number \| boolean \| object` | — |
| label | 标签文本（无 value 时作为 value 使用） | `string \| number \| boolean \| object` | — |
| true-value | 勾选时的值 | `string \| number` | — |
| false-value | 未勾选时的值 | `string \| number` | — |
| disabled | 是否禁用 | `boolean` | `false` |
| border | 是否显示边框 | `boolean` | `false` |
| size | 尺寸 | `'large' \| 'default' \| 'small'` | — |
| name | 原生 `name` 属性 | `string` | — |
| checked | 是否被勾选 | `boolean` | `false` |
| indeterminate | 设置中间状态（仅控制样式） | `boolean` | `false` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| tabindex | 输入框 tabindex | `string \| number` | — |

### Checkbox Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 绑定值变化时触发 | `(value: string \| number \| boolean) => void` |

### Checkbox Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义内容 |

---

## CheckboxGroup API

### CheckboxGroup Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string[] \| number[]` | `[]` |
| size | 尺寸 | `'large' \| 'default' \| 'small'` | — |
| disabled | 是否禁用所有子多选框 | `boolean` | `false` |
| min | 最少勾选数量 | `number` | — |
| max | 最多勾选数量 | `number` | — |
| text-color | 按钮激活时的文字颜色 | `string` | `#ffffff` |
| fill | 按钮激活时的边框和背景色 | `string` | `#409eff` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |

### CheckboxGroup Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 绑定值变化时触发 | `(value: string[] \| number[]) => void` |

### CheckboxGroup Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 自定义内容 | Checkbox / CheckboxButton |
