# TimePicker

Provides time selection input backed by Day.js.

> See the [Playground](../playground.md) for runnable component examples.

---

## Arbitrary Time

Time is selected by scrolling the mouse wheel by default; set `arrow-control` to use arrow buttons instead.

## Time Limits

Use `disabled-hours`, `disabled-minutes`, and `disabled-seconds` to limit selectable times.

## Time Range

Set `is-range` for time-range selection. Range mode also supports `arrow-control`.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值（范围模式时为长度 2 的数组） | `number \| string \| Date \| [Date, Date] \| [string, string] \| [number, number]` | `''` |
| readonly | 是否只读 | `boolean` | `false` |
| disabled | 是否禁用 | `boolean` | `false` |
| editable | 输入框是否可编辑 | `boolean` | `true` |
| clearable | 是否显示清空按钮 | `boolean` | `true` |
| size | 输入框尺寸 | `'large' \| 'default' \| 'small'` | — |
| placeholder | 非范围模式的占位符 | `string` | `''` |
| start-placeholder | 范围模式的开始占位符 | `string` | — |
| end-placeholder | 范围模式的结束占位符 | `string` | — |
| is-range | 是否选择时间范围 | `boolean` | `false` |
| arrow-control | 是否用箭头按钮选时间 | `boolean` | `false` |
| format | 输入框中的时间格式 | `string` | — |
| value-format | 绑定值的格式（不指定则绑定 Date 对象） | `string` | — |
| range-separator | 范围选择时的分隔符 | `string` | `-` |
| default-value | 未选择时默认显示的时间 | `Date \| [Date, Date]` | — |
| prefix-icon | 自定义前缀图标 | `string \| Component` | `Clock` |
| clear-icon | 自定义清空图标 | `string \| Component` | `CircleClose` |
| disabled-hours | 禁止选择的小时数组 | `(role: string, comparingDate?: Dayjs) => number[]` | — |
| disabled-minutes | 禁止选择的分钟数组 | `(hour: number, role: string, comparingDate?: Dayjs) => number[]` | — |
| disabled-seconds | 禁止选择的秒数组 | `(hour: number, minute: number, role: string, comparingDate?: Dayjs) => number[]` | — |
| teleported | 下拉框是否传送到 body | `boolean` | `true` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 用户确认选值时触发 | `(val: ...) => void` |
| blur | 失焦时触发 | `(e: FocusEvent) => void` |
| focus | 聚焦时触发 | `(e: FocusEvent) => void` |
| clear | 点击清空按钮时触发 | `() => void` |
| visible-change | 弹框出现/消失时触发 | `(visibility: boolean) => void` |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| focus | 使组件聚焦 | `() => void` |
| blur | 使组件失焦 | `() => void` |
| handleOpen | 打开时间选择器弹框 | `() => void` |
| handleClose | 关闭时间选择器弹框 | `() => void` |
