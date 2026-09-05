# Progress

Shows the current operation progress so users can understand the live system state.

## Public Preview

This is a preview public component. See [API stability](../api-stability.md#stability-levels)
and the shared [theme and motion contracts](../theme/tokens.md). Provide
progress context text; when the percentage is hidden, expose the state through
nearby text or ARIA. The component displays the supplied progress and does not
estimate asynchronous completion.

> See the [Playground](../playground.md) for runnable component examples.

---

## Linear Progress

`percentage` is required and ranges from 0 to 100. Use `format` for custom text.

## Inline Percentage

Set `text-inside` to place the percentage inside the bar and use `stroke-width` to adjust its height.

## Custom Colors

`color` accepts a color string, a function that returns a color by percentage, or a color-range array.

## Circular Progress

Set `type="circle"` for a circular bar; use `width` to control its diameter.

## Dashboard

Set `type="dashboard"` for a dashboard gauge.

## Indeterminate Progress

Set `indeterminate` for an indeterminate loading state and use `duration` for the animation duration.

## Striped Progress

Set `striped` for stripes, `striped-flow` to animate them, and `duration` for the animation duration.

---

## API

### Attributes

| 属性名                  | 说明                                           | 类型                                                                                    | 默认值  |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- | ------- |
| percentage **（必填）** | 进度百分比（0-100）                            | `number`                                                                                | `0`     |
| type                    | 进度条类型                                     | `'line' \| 'circle' \| 'dashboard'`                                                     | `line`  |
| stroke-width            | 进度条宽度（px）                               | `number`                                                                                | `6`     |
| text-inside             | 百分比文字是否在进度条内（仅 `line` 类型有效） | `boolean`                                                                               | `false` |
| status                  | 进度条状态                                     | `'success' \| 'exception' \| 'warning'`                                                 | —       |
| indeterminate           | 是否为不确定进度                               | `boolean`                                                                               | `false` |
| duration                | 不确定进度或条纹流动的动画时长（s）            | `number`                                                                                | `3`     |
| color                   | 进度条颜色（覆盖 status 颜色）                 | `string \| ((percentage: number) => string) \| { color: string; percentage: number }[]` | `''`    |
| width                   | 环形进度条画布宽度（px）                       | `number`                                                                                | `126`   |
| show-text               | 是否显示进度文字                               | `boolean`                                                                               | `true`  |
| stroke-linecap          | 环形/仪表盘进度条端点形状                      | `'butt' \| 'round' \| 'square'`                                                         | `round` |
| format                  | 自定义文字格式                                 | `(percentage: number) => string`                                                        | —       |
| striped                 | 是否显示条纹                                   | `boolean`                                                                               | `false` |
| striped-flow            | 是否使条纹流动                                 | `boolean`                                                                               | `false` |

### Slots

| 插槽名  | 说明             | 参数                     |
| ------- | ---------------- | ------------------------ |
| default | 自定义进度条内容 | `{ percentage: number }` |
