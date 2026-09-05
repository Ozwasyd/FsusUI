# DatePicker

Provides date selection input backed by Day.js.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Use `type` to set the selection granularity (default `date`), `shortcuts` for quick options, and `disabled-date` for disabled dates.

## Other Selection Granularities

Supports selection by week (`week`), month (`month`), year (`year`), or multiple dates (`dates`).

## Date Range

Set `type="daterange"` or `type="datetimerange"` to select a date range. The panels are linked by default; set `unlink-panels` to decouple them.

## Date Format

- `format`: input display format
- `value-format`: bound value format

See the [Day.js format documentation](https://day.js.org/docs/en/display/format).

> **Note:** Format tokens are case-sensitive; follow the documented spelling exactly.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值（范围模式时为长度 2 的数组） | `number \| string \| Date \| Array` | `''` |
| readonly | 是否只读 | `boolean` | `false` |
| disabled | 是否禁用 | `boolean` | `false` |
| size | 输入框尺寸 | `'' \| 'large' \| 'default' \| 'small'` | — |
| editable | 输入框是否可编辑 | `boolean` | `true` |
| clearable | 是否显示清空按钮 | `boolean` | `true` |
| placeholder | 非范围模式的占位符 | `string` | `''` |
| start-placeholder | 范围模式的开始占位符 | `string` | — |
| end-placeholder | 范围模式的结束占位符 | `string` | — |
| type | 选择器类型 | `'year' \| 'years' \| 'month' \| 'months' \| 'date' \| 'dates' \| 'datetime' \| 'week' \| 'datetimerange' \| 'daterange' \| 'monthrange' \| 'yearrange'` | `date` |
| format | 输入框中的格式 | `string` | `YYYY-MM-DD` |
| value-format | 绑定值的格式（不指定则绑定 Date 对象） | `string` | — |
| range-separator | 范围选择时的分隔符 | `string` | `-` |
| default-value | 默认日期（未选择时显示的月历） | `Date \| [Date, Date]` | — |
| default-time | 范围选择时起止日期的默认时间部分 | `Date \| [Date, Date]` | — |
| unlink-panels | 范围选择时是否解除两个面板的联动 | `boolean` | `false` |
| single-panel | 范围选择器是否只显示一个面板 | `boolean` | `false` |
| prefix-icon | 自定义前缀图标 | `string \| Component` | — |
| clear-icon | 自定义清空图标 | `string \| Component` | `CircleClose` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| disabled-date | 禁用日期的判断函数 | `(data: Date) => boolean` | — |
| shortcuts | 快捷选项 | `Array<{ text: string, value: Date \| Function }>` | `[]` |
| cell-class-name | 自定义单元格 class 名 | `(data: Date) => string` | — |
| teleported | 下拉框是否传送到 body | `boolean` | `true` |
| placement | 弹框出现位置 | `Placement` | `bottom` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 用户确认选值或点击外部时触发 | `(val: typeof v-model) => void` |
| blur | 失焦时触发 | `(e: FocusEvent) => void` |
| focus | 聚焦时触发 | `(e: FocusEvent) => void` |
| clear | 点击清空按钮时触发 | `() => void` |
| calendar-change | 范围模式下，日历所选日期改变时触发 | `(val: [Date, null \| Date]) => void` |
| panel-change | 点击导航按钮时触发 | `(date: Date \| [Date, Date], mode: 'month' \| 'year') => void` |
| visible-change | 日期选择器弹框出现/消失时触发 | `(visibility: boolean) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义单元格内容 |
| range-separator | 自定义范围分隔符内容 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| focus | 使组件聚焦 | `() => void` |
| blur | 使组件失焦 | `() => void` |
| handleOpen | 打开日期选择器弹框 | `() => void` |
| handleClose | 关闭日期选择器弹框 | `() => void` |
