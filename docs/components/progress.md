# Progress 进度条

展示操作的当前进度，让用户了解系统实时状态。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 线形进度条

`percentage` 属性为必填，范围 0-100。通过 `format` 自定义文字格式。

## 内部百分比

设置 `text-inside` 将百分比文字放在进度条内部，配合 `stroke-width` 调整高度。

## 自定义颜色

`color` 属性支持颜色字符串、函数（根据百分比返回颜色）或颜色区间数组。

## 环形进度条

设置 `type="circle"` 使用环形进度条；`width` 控制直径大小。

## 仪表盘

设置 `type="dashboard"` 使用仪表盘形式。

## 不确定进度

设置 `indeterminate` 展示加载中的不确定进度；通过 `duration` 控制动画时长。

## 条纹进度

设置 `striped` 显示条纹进度条；`striped-flow` 使条纹流动；`duration` 控制动画时长。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| percentage **（必填）** | 进度百分比（0-100） | `number` | `0` |
| type | 进度条类型 | `'line' \| 'circle' \| 'dashboard'` | `line` |
| stroke-width | 进度条宽度（px） | `number` | `6` |
| text-inside | 百分比文字是否在进度条内（仅 `line` 类型有效） | `boolean` | `false` |
| status | 进度条状态 | `'success' \| 'exception' \| 'warning'` | — |
| indeterminate | 是否为不确定进度 | `boolean` | `false` |
| duration | 不确定进度或条纹流动的动画时长（s） | `number` | `3` |
| color | 进度条颜色（覆盖 status 颜色） | `string \| ((percentage: number) => string) \| { color: string; percentage: number }[]` | `''` |
| width | 环形进度条画布宽度（px） | `number` | `126` |
| show-text | 是否显示进度文字 | `boolean` | `true` |
| stroke-linecap | 环形/仪表盘进度条端点形状 | `'butt' \| 'round' \| 'square'` | `round` |
| format | 自定义文字格式 | `(percentage: number) => string` | — |
| striped | 是否显示条纹 | `boolean` | `false` |
| striped-flow | 是否使条纹流动 | `boolean` | `false` |

### Slots

| 插槽名 | 说明 | 参数 |
|--------|------|------|
| default | 自定义进度条内容 | `{ percentage: number }` |
