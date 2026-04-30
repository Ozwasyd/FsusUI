# Slider 滑块

通过拖动滑块在一个固定区间内进行选择。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

使用 `v-model` 绑定数值，拖动时实时显示当前值。

## 离散值

通过 `step` 设置步长；开启 `show-stops` 显示刻度点。

## 带输入框

开启 `show-input` 在右侧显示输入框，可通过输入框直接设置值。

## 范围选择

设置 `range` 为 `true` 开启范围模式，绑定值为包含起止两个数值的数组。

## 垂直模式

设置 `vertical` 为 `true` 开启垂直模式（此时必须同时设置 `height`）。

## 刻度标记

通过 `marks` 属性设置刻度标记，key 为数值，value 为标签文字或自定义样式对象。

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
