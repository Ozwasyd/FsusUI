# MessageBox 消息弹框

模拟系统的 `alert`、`confirm`、`prompt` 弹框，用于提示用户信息、确认操作或接收输入。

> **提示**：MessageBox 提供的是系统级交互。若需要展示复杂内容，请使用 Dialog 组件。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 消息提示（Alert）

```ts
import { ElMessageBox } from 'element-plus'

ElMessageBox.alert('这是提示内容', '标题', {
  confirmButtonText: '确认',
})
```

## 确认消息（Confirm）

```ts
ElMessageBox.confirm('确认执行此操作吗？', '警告', {
  type: 'warning',
}).then(() => {
  // 用户点击确认
}).catch(() => {
  // 用户取消或关闭
})
```

## 提交内容（Prompt）

```ts
ElMessageBox.prompt('请输入邮箱', '提示', {
  inputPattern: /[\w!#$%&'*+/=?^_`{|}~-]+(?:\.[\w!#$%&'*+/=?^_`{|}~-]+)*@(?:[\w](?:[\w-]*[\w])?\.)+[\w](?:[\w-]*[\w])?/,
  inputErrorMessage: '邮箱格式不正确',
}).then(({ value }) => {
  console.log('输入：', value)
})
```

## HTML 内容

设置 `dangerouslyUseHTMLString: true` 后，`message` 将被解析为 HTML。

> **警告**：确保内容可信，防止 XSS 攻击。

## 区分取消与关闭

设置 `distinguishCancelAndClose: true` 后，Promise reject 回调的参数分别为 `'cancel'`（取消按钮）和 `'close'`（关闭按钮/ESC）。

---

## API

### Options

| 选项名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| title | 标题 | `string` | `''` |
| message | 内容（支持字符串、VNode、函数） | `string \| VNode \| (() => VNode)` | — |
| dangerouslyUseHTMLString | 是否将 message 解析为 HTML | `boolean` | `false` |
| type | 类型（用于图标） | `'primary' \| 'success' \| 'warning' \| 'info' \| 'error'` | `''` |
| icon | 自定义图标（覆盖 type） | `string \| Component` | `''` |
| showClose | 是否显示关闭图标 | `boolean` | `true` |
| modal | 是否显示遮罩 | `boolean` | `true` |
| showCancelButton | 是否显示取消按钮 | `boolean` | `false`（confirm/prompt 为 true） |
| showConfirmButton | 是否显示确认按钮 | `boolean` | `true` |
| cancelButtonText | 取消按钮文字 | `string` | `取消` |
| confirmButtonText | 确认按钮文字 | `string` | `确认` |
| cancelButtonClass | 取消按钮自定义 class | `string` | `''` |
| confirmButtonClass | 确认按钮自定义 class | `string` | `''` |
| closeOnClickModal | 点击遮罩是否关闭（alert 默认 false） | `boolean` | `true` |
| closeOnPressEscape | 按 ESC 是否关闭（alert 默认 false） | `boolean` | `true` |
| beforeClose | 关闭前的钩子，调用 `done()` 完成关闭 | `(action, instance, done) => void` | `null` |
| callback | 关闭回调（不使用 Promise 时） | `(value, action) => any` | `null` |
| distinguishCancelAndClose | 是否区分取消与关闭 | `boolean` | `false` |
| lockScroll | 打开时是否锁定 body 滚动 | `boolean` | `true` |
| showInput | 是否显示输入框（prompt 默认 true） | `boolean` | `false` |
| inputPlaceholder | 输入框占位符 | `string` | `''` |
| inputType | 输入框类型 | `string` | `text` |
| inputValue | 输入框初始值 | `string` | `''` |
| inputPattern | 输入框校验正则 | `RegExp` | `null` |
| inputValidator | 输入框校验函数，返回 false/string 表示校验失败 | `(value) => boolean \| string` | `undefined` |
| inputErrorMessage | 校验失败提示信息 | `string` | `非法输入` |
| center | 是否居中布局 | `boolean` | `false` |
| draggable | 是否可拖拽 | `boolean` | `false` |
| roundButton | 是否使用圆角按钮 | `boolean` | `false` |
| customClass | 弹框自定义 class | `string` | `''` |
| appendTo | 挂载目标元素 | `CSSSelector \| HTMLElement` | — |
