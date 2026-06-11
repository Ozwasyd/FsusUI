# Notification 通知

在屏幕角落弹出全局通知消息。与 Message 的区别在于，Notification 更适合系统级被动推送。

## Public Preview Notes

| 字段                   | 说明                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------- |
| purpose                | 展示系统级、被动或跨页面的短通知，通常不阻塞当前任务。                                 |
| basic usage            | 调用 `ElNotification({ title, message })` 或类型快捷方法创建通知。                     |
| props / events / slots | 本页 `API` 覆盖公开 options 和 instance methods。                                      |
| accessibility          | 通知文案应短且可独立理解；需要用户立即处理的内容应使用 Dialog、Drawer 或页面内 Alert。 |
| theme token notes      | 跟随公开 surface、文本、边框、阴影、圆角、状态色和 overlay motion token。              |
| known limitations      | 服务 API 依赖浏览器 DOM；`dangerouslyUseHTMLString` 只允许可信内容。                   |
| stability level        | Preview public service。                                                               |

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

调用 `ElNotification({ title, message })` 显示通知，默认 4500ms 后自动关闭。设置 `duration` 为 `0` 则不自动关闭。

## 类型

通过 `type` 设置通知类型：`info`、`success`、`warning`、`error`、`primary`。可直接调用快捷方法如 `ElNotification.success({...})`。

## 自定义位置

通过 `position` 设置弹出角落：`top-right`（默认）、`top-left`、`bottom-right`、`bottom-left`。

## 偏移量

通过 `offset` 设置距屏幕边缘的距离（同一批次的通知应使用相同 offset）。

## HTML 内容

设置 `dangerouslyUseHTMLString` 为 `true` 后，`message` 将被解析为 HTML 字符串。

> **警告**：确保 `message` 内容可信，防止 XSS 攻击。

## 关闭所有

调用 `ElNotification.closeAll()` 手动关闭所有通知实例。

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
