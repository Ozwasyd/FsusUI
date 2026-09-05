# Slider

Select a value within a fixed range by dragging a slider.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Bind the value with `v-model`; the current value updates while dragging.

## Discrete Values

Set the increment with `step`; enable `show-stops` to show stop marks.

## With Input

Enable `show-input` to show an input on the right and set the value directly.

## Range Selection

Set `range` to `true` for range mode; the bound value is an array with start and end values.

## Vertical Mode

Set `vertical` to `true` for vertical mode; `height` is then required.

## Tick Marks

Use `marks` for scale labels; each key is a number and its value is label text or a custom style object.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `number \| number[]` | `0` |
| min | 最小值 | `number` | `0` |
| max | 最大值 | `number` | `100` |
| disabled | 是否禁用 | `boolean` | `false` |
| step | 步长（可设为 `'mark'` 限制只能选刻度值） | `number \| 'mark'` | `1` |
| show-input | 是否显示输入框（range 为 false 且 step 非 'mark' 时有效） | `boolean` | `false` |
| show-input-controls | 输入框是否显示控制按钮（需 `show-input` 为 true） | `boolean` | `true` |
| size | 滑块尺寸（垂直模式无效） | `'' \| 'large' \| 'default' \| 'small'` | `default` |
| input-size | 输入框尺寸 | `'' \| 'large' \| 'default' \| 'small'` | `default` |
| show-stops | 是否显示间断点（刻度点） | `boolean` | `false` |
| show-tooltip | 是否显示 tooltip | `boolean` | `true` |
| format-tooltip | 格式化 tooltip 的显示值 | `(value: number) => number \| string` | — |
| range | 是否为范围选择 | `boolean` | `false` |
| vertical | 是否垂直模式 | `boolean` | `false` |
| height | 垂直模式时的高度（必填） | `string` | — |
| marks | 刻度标记 | `Record<number, string \| { style: CSSProperties; label: any }>` | — |
| validate-event | 是否触发表单校验 | `boolean` | `true` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 值改变时触发（拖拽时鼠标释放后触发） | `(value: number \| number[]) => void` |
| input | 数据变化时实时触发（拖拽过程中也触发） | `(value: number \| number[]) => void` |
