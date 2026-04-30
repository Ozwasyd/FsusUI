# TimeSelect 时间选择

提供固定时间段的下拉选择，与 TimePicker 的区别在于只能选择预设时间段。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

`v-model` 绑定字符串时间值（格式 `HH:mm`）；`start` / `end` / `step` 控制时间列表范围和步长。

## 禁用时间

通过 `disabled-time` 属性传入函数禁止选择特定时间。

## 跨日时间范围

可通过结束时间小于开始时间实现跨日效果。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值（`HH:mm` 格式字符串） | `string` | — |
| disabled | 是否禁用 | `boolean` | `false` |
| editable | 输入框是否可编辑 | `boolean` | `true` |
| clearable | 是否显示清空按钮 | `boolean` | `true` |
| size | 输入框尺寸 | `'large' \| 'default' \| 'small'` | — |
| placeholder | 占位符 | `string` | — |
| start | 开始时间（格式 `HH:mm`） | `string` | `09:00` |
| end | 结束时间（格式 `HH:mm`） | `string` | `18:00` |
| step | 时间步长（格式 `HH:mm`） | `string` | `00:30` |
| min-time | 最小时间，早于该时间的选项将被禁用 | `string` | — |
| max-time | 最大时间，晚于该时间的选项将被禁用 | `string` | — |
| format | 输入框中的格式 | `string` | `HH:mm` |
| effect | Tooltip 主题 | `'dark' \| 'light' \| string` | `light` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 选中值改变时触发 | `(value: string) => void` |
| blur | 失焦时触发 | `(event: FocusEvent) => void` |
| focus | 聚焦时触发 | `(event: FocusEvent) => void` |
| clear | 点击清空时触发 | `() => void` |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| focus | 使组件聚焦 | `() => void` |
| blur | 使组件失焦 | `() => void` |
