# Badge 徽章

在按钮或图标上展示数字或状态标记。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `value` 属性设置显示的数字或文字。

## 最大值

通过 `max` 属性设置最大值，超出时显示 `{max}+`（仅 value 为数字时有效，默认 99）。

## 自定义内容

`value` 为字符串时显示自定义文字；也可通过 `content` 插槽完全自定义内容。

## 红点

设置 `is-dot` 为 `true` 显示红点而非数字。

## 偏移量

通过 `offset` 属性 `[left, top]` 设置徽章偏移量。

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
