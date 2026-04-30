# InputNumber 数字输入框

仅允许输入标准的数字值，可定义范围。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

使用 `v-model` 绑定数字变量。输入非法字符串时，上层会收到 `NaN`。

## 禁用

通过 `disabled` 属性禁用；通过 `min` / `max` 限制取值范围。

## 步长

通过 `step` 属性设置每次增减的步长值。`step-strictly` 设为 `true` 时，输入值只能是步长的整数倍。

## 精度

通过 `precision` 设置精度（须为非负整数，且不能小于 `step` 的小数位数）。

## 尺寸

通过 `size` 设置尺寸：`large`、`default`（默认）、`small`。

## 按钮位置

通过 `controls-position="right"` 将增减按钮置于右侧。

## 格式化

通过 `formatter` / `parser` 自定义显示格式（设置后输入框类型变为 `text`）。

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
