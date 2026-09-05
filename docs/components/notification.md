# Notification

Shows a global notification in a screen corner. Unlike Message, Notification is suited to passive, system-level pushes.

## Public Preview

This preview public service follows [API stability](../api-stability.md#stability-levels)
and the shared [theme and motion contracts](../theme/tokens.md). Keep the
message short and self-contained; use Dialog, Drawer, or inline Alert when the
user must act immediately. The service requires browser DOM, and
`dangerouslyUseHTMLString` accepts only trusted content.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Call `ElNotification({ title, message })` to show a notification; it closes after 4500ms by default. Set `duration` to `0` to keep it open.

## Types

Set `type` to `info`, `success`, `warning`, `error`, or `primary`. Shortcut methods such as `ElNotification.success({...})` are also available.

## Custom Position

Use `position` to choose a corner: `top-right` (default), `top-left`, `bottom-right`, or `bottom-left`.

## Offset

Use `offset` to set the distance from the screen edge; notifications in one batch should use the same offset.

## HTML Content

Set `dangerouslyUseHTMLString` to `true` to parse `message` as an HTML string.

> Treat HTML as trusted input only; see the [Security Policy](../../SECURITY.md)
> for security handling and reporting.

## Close All

Call `ElNotification.closeAll()` to close all notification instances manually.

---

## API

### Options

| 选项名                   | 说明                               | 类型                                                             | 默认值      |
| ------------------------ | ---------------------------------- | ---------------------------------------------------------------- | ----------- |
| title                    | 通知标题                           | `string`                                                         | `''`        |
| message                  | 通知内容                           | `string \| VNode \| (() => VNode)`                               | `''`        |
| dangerouslyUseHTMLString | 是否将 message 解析为 HTML         | `boolean`                                                        | `false`     |
| type                     | 通知类型                           | `'primary' \| 'success' \| 'warning' \| 'info' \| 'error' \| ''` | `''`        |
| icon                     | 自定义图标（覆盖 type 图标）       | `string \| Component`                                            | —           |
| customClass              | 自定义 class                       | `string`                                                         | `''`        |
| duration                 | 显示时长（ms），0 不自动关闭       | `number`                                                         | `4500`      |
| position                 | 弹出位置                           | `'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'`   | `top-right` |
| showClose                | 是否显示关闭按钮                   | `boolean`                                                        | `true`      |
| onClose                  | 关闭时的回调                       | `() => void`                                                     | —           |
| onClick                  | 点击通知时的回调                   | `() => void`                                                     | —           |
| offset                   | 距屏幕边缘的距离（px）             | `number`                                                         | `0`         |
| appendTo                 | 挂载根元素，默认为 `document.body` | `CSSSelector \| HTMLElement`                                     | —           |
| zIndex                   | 层级                               | `number`                                                         | `0`         |

### Methods

| 名称  | 说明                 | 类型         |
| ----- | -------------------- | ------------ |
| close | 手动关闭当前通知实例 | `() => void` |
