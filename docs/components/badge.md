# Badge

Displays a numeric or status marker on a button or icon.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Set the displayed number or text with `value`.

## Maximum Value

Set the maximum with `max`; values above it display as `{max}+` (numeric
`value` only, default `99`).

## Custom Content

String `value` supplies custom text; the `content` slot can replace the content.

## Dot

Set `is-dot` to `true` to show a dot instead of a number.

## Offset

Set the badge offset with `[left, top]` in `offset`.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| value | 显示值 | `string \| number` | `''` |
| max | 最大值（超出显示 `{max}+`，value 为数字时有效） | `number` | `99` |
| is-dot | 是否显示小圆点 | `boolean` | `false` |
| hidden | 是否隐藏徽章 | `boolean` | `false` |
| type | 类型 | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | `danger` |
| show-zero | value 为 0 时是否显示徽章 | `boolean` | `true` |
| color | 自定义背景色 | `string` | — |
| offset | 徽章偏移量 `[left, top]` | `[number, number]` | `[0, 0]` |
| badge-style | 自定义徽章样式 | `CSSProperties` | — |
| badge-class | 自定义徽章 class | `string` | — |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 被包裹的内容 |
| content | 自定义徽章内容（可访问 `value`） |
