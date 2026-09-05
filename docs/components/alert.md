# Alert

An inline page element that does not dismiss automatically.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Set the status with `type`; the default is `info`.

## Themes

Use `effect` to choose `light` (default) or `dark`.

## Closable

Alerts are closable by default (`closable`). Set `close-text` for the close
button label and handle dismissal in the `close` event.

## With Icons

Set `show-icon` to display the status icon; use the `icon` slot to customize it.

## Centered Text

Set `center` to center the content.

## With Description

Add a detailed description with the `description` prop or the default slot.

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
