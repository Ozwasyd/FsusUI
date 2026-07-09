# Message 消息提示

操作反馈信息，与 Notification 的区别在于后者常用于系统级被动通知。

## Public Preview Notes

| 字段                   | 说明                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| purpose                | 展示操作完成、失败、警告或提示的短反馈，也可作为 toast 类提示使用。                               |
| basic usage            | 调用 `ElMessage('...')`、`ElMessage.success('...')` 或对象参数创建消息。                          |
| props / events / slots | 本页 `API` 覆盖公开 options 和 instance methods。                                                 |
| accessibility          | 不要把唯一错误说明放在自动消失消息中；关键错误应同时出现在页面内可回读区域。                      |
| theme token notes      | 跟随轻量 toast surface、文本、状态色、紧凑圆角、弱阴影和 overlay motion token。                   |
| known limitations      | 服务 API 依赖浏览器 DOM；`dangerouslyUseHTMLString` 只允许可信内容，grouping 只合并相同 message。 |
| stability level        | Preview public service。                                                                          |

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

默认显示在顶部，3 秒后自动关闭。调用 `ElMessage(message)` 传入文字或对象。

## 类型

通过 `type` 设置消息类型：`info`（默认）、`success`、`warning`、`error`、`primary`。可直接调用快捷方法如 `ElMessage.success('...')`。

## 朴素风格

设置 `plain` 为 `true` 使用朴素背景。

## 可手动关闭

设置 `showClose` 为 `true` 显示关闭按钮；设置 `duration` 为 `0` 不自动关闭。

## 使用 HTML 内容

设置 `dangerouslyUseHTMLString` 为 `true` 后，`message` 将被解析为 HTML 字符串。

> **警告**：启用 HTML 解析时请确保内容可信，防止 XSS 注入攻击。

## 合并相同消息

设置 `grouping` 为 `true` 合并相同内容的消息。

## 关闭所有

调用 `ElMessage.closeAll()` 手动关闭所有消息实例。

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
