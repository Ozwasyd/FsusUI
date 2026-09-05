# Message

Provides action feedback; Notification is better suited to passive, system-level notices.

## Public Preview

This preview public service follows [API stability](../api-stability.md#stability-levels)
and the shared [theme and motion contracts](../theme/tokens.md). Do not put the
only explanation of an error in an auto-dismissed message; repeat critical
errors in a readable page region. The service requires browser DOM,
`dangerouslyUseHTMLString` accepts only trusted content, and grouping merges
identical messages only.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Messages appear at the top and close after 3 seconds by default. Call `ElMessage(message)` with text or an options object.

## Types

Set `type` to `info` (default), `success`, `warning`, `error`, or `primary`. Shortcut methods such as `ElMessage.success('...')` are also available.

## Plain Style

Set `plain` to `true` for a plain background.

## Manual Close

Set `showClose` to `true` to show a close button; set `duration` to `0` to disable automatic dismissal.

## HTML Content

Set `dangerouslyUseHTMLString` to `true` to parse `message` as an HTML string.

> Treat HTML as trusted input only; see the [Security Policy](../../SECURITY.md)
> for security handling and reporting.

## Group Identical Messages

Set `grouping` to `true` to combine messages with identical content.

## Close All

Call `ElMessage.closeAll()` to close all message instances manually.

---

## API

### Options

| 选项名                   | 说明                               | 类型                                                                                | 默认值  |
| ------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------- | ------- |
| message                  | 消息文字                           | `string \| VNode \| (() => VNode)`                                                  | `''`    |
| type                     | 消息类型                           | `'primary' \| 'success' \| 'warning' \| 'info' \| 'error'`                          | `info`  |
| plain                    | 是否朴素风格                       | `boolean`                                                                           | `false` |
| icon                     | 自定义图标（覆盖 type 图标）       | `string \| Component`                                                               | —       |
| dangerouslyUseHTMLString | 是否将 message 解析为 HTML         | `boolean`                                                                           | `false` |
| customClass              | 自定义 class                       | `string`                                                                            | `''`    |
| duration                 | 显示时长（ms），设为 0 不自动关闭  | `number`                                                                            | `3000`  |
| showClose                | 是否显示关闭按钮                   | `boolean`                                                                           | `false` |
| onClose                  | 关闭时的回调                       | `() => void`                                                                        | —       |
| offset                   | 距离视口边缘的距离（px）           | `number`                                                                            | `16`    |
| placement                | 弹出位置                           | `'top' \| 'top-left' \| 'top-right' \| 'bottom' \| 'bottom-left' \| 'bottom-right'` | `top`   |
| appendTo                 | 挂载根元素，默认为 `document.body` | `CSSSelector \| HTMLElement`                                                        | —       |
| grouping                 | 合并相同内容的消息                 | `boolean`                                                                           | `false` |

### Methods

| 名称  | 说明               | 类型         |
| ----- | ------------------ | ------------ |
| close | 手动关闭该消息实例 | `() => void` |
