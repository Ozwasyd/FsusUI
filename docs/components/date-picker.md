# DatePicker 日期选择器

用于日期的选择输入，基于 Day.js 进行日期处理。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `type` 属性设置选择粒度（默认 `date`），可通过 `shortcuts` 设置快捷选项，通过 `disabled-date` 设置禁用日期。

## 其他选择粒度

支持按周（`week`）、月（`month`）、年（`year`）或多日期（`dates`）选择。

## 日期范围

设置 `type="daterange"` 或 `type="datetimerange"` 选择日期范围。默认左右面板联动，设置 `unlink-panels` 可解除联动。

## 日期格式

- `format`：输入框显示格式
- `value-format`：绑定值格式

格式参考 [Day.js 文档](https://day.js.org/docs/en/display/format)。

> **注意**：格式字符大小写有区别，请严格遵循规范。

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
