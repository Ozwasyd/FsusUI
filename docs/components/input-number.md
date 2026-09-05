# InputNumber

Accepts standard numeric values only and supports a defined range.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Bind a numeric value with `v-model`. The consumer receives `NaN` for an invalid string.

## Disabled

Use `disabled` to disable the control and `min` / `max` to limit its range.

## Step

Set the increment with `step`. With `step-strictly: true`, values must be integer multiples of the step.

## Precision

Set decimal precision with `precision` (a non-negative integer no smaller than the number of decimal places in `step`).

## Sizes

Set the size with `size`: `large`, `default` (default), or `small`.

## Button Position

Set `controls-position="right"` to place the increment and decrement buttons on the right.

## Formatting

Use `formatter` / `parser` for custom display formatting; the input type becomes `text` when either is set.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `number \| null` | — |
| min | 最小值 | `number` | `Number.MIN_SAFE_INTEGER` |
| max | 最大值 | `number` | `Number.MAX_SAFE_INTEGER` |
| step | 步长 | `number` | `1` |
| step-strictly | 是否只能输入步长的整数倍 | `boolean` | `false` |
| precision | 数值精度 | `number` | — |
| size | 组件尺寸 | `'large' \| 'default' \| 'small'` | `default` |
| readonly | 是否只读 | `boolean` | `false` |
| disabled | 是否禁用 | `boolean` | `false` |
| controls | 是否显示增减控制按钮 | `boolean` | `true` |
| controls-position | 控制按钮位置 | `'' \| 'right'` | `''` |
| placeholder | 占位文字 | `string` | — |
| name | 原生 `name` 属性 | `string` | — |
| value-on-clear | 输入框清空时的值 | `number \| null \| 'min' \| 'max'` | — |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| align | 内部输入框文字对齐方式 | `'left' \| 'center' \| 'right'` | `center` |
| formatter | 显示值格式化函数 | `(value: string) => string` | — |
| parser | 从格式化值中提取数值的函数 | `(value: string) => string` | — |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 值改变时触发 | `(currentValue: number \| undefined, oldValue: number \| undefined) => void` |
| blur | 失焦时触发 | `(event: FocusEvent) => void` |
| focus | 聚焦时触发 | `(event: FocusEvent) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| decrease-icon | 自定义减少按钮图标 |
| increase-icon | 自定义增加按钮图标 |
| prefix | 前缀内容 |
| suffix | 后缀内容 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| focus | 使输入框聚焦 | `() => void` |
| blur | 使输入框失焦 | `() => void` |
