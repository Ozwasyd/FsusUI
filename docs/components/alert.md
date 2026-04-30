# Alert 提示

页面中的非浮层元素，不会自动消失。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `type` 设置主题类型，默认为 `info`。

## 主题

通过 `effect` 切换主题：`light`（默认）或 `dark`。

## 可关闭

默认可关闭（`closable`）；通过 `close-text` 自定义关闭按钮文字；监听 `close` 事件处理关闭逻辑。

## 带图标

设置 `show-icon` 显示类型图标；通过 `icon` 插槽自定义图标。

## 文字居中

设置 `center` 将内容居中显示。

## 带描述

通过 `description` 属性或默认插槽添加详情描述。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| title | 标题 | `string` | — |
| type | 类型 | `'primary' \| 'success' \| 'warning' \| 'info' \| 'error'` | `info` |
| description | 描述文字 | `string` | — |
| closable | 是否可关闭 | `boolean` | `true` |
| center | 内容是否居中 | `boolean` | `false` |
| close-text | 自定义关闭按钮文字 | `string` | — |
| show-icon | 是否显示图标 | `boolean` | `false` |
| effect | 主题 | `'light' \| 'dark'` | `light` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| close | 关闭时触发 | `(event: MouseEvent) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 描述内容 |
| title | 自定义标题 |
| icon | 自定义图标 |
